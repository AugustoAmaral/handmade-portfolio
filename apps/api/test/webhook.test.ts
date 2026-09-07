import Stripe from 'stripe'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'
import { Product } from '../src/models/product'

const WEBHOOK_SECRET = 'whsec_testsecret' // matches test/setup.ts
const stripeForSigning = new Stripe('sk_test_dummy')

function signedPost(payload: object) {
  const body = JSON.stringify(payload)
  const signature = stripeForSigning.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET })
  return request(createApp())
    .post('/api/stripe/webhook')
    .set('stripe-signature', signature)
    .set('content-type', 'application/json')
    .send(body)
}

function event(type: string, sessionOverrides: object = {}) {
  return {
    id: 'evt_1',
    type,
    data: {
      object: {
        id: 'cs_test_done',
        object: 'checkout.session',
        payment_intent: 'pi_1',
        payment_status: 'paid',
        amount_subtotal: 16100,
        amount_total: 16100,
        currency: 'brl',
        metadata: { orderId: 'x', orderNumber: '1' },
        ...sessionOverrides,
      },
    },
  }
}

let drawingId: string

beforeEach(async () => {
  await Order.syncIndexes()
  const drawing = await Product.create({
    slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, description: { pt: 'x', en: 'x' },
    priceCents: 12000, type: 'physical', stock: 1, active: true,
  })
  drawingId = String(drawing._id)
  await Order.create({
    orderNumber: 1,
    status: 'pending',
    stripeSessionId: 'cs_test_done',
    buyer: { name: 'Buyer', email: 'buyer@example.com' },
    shippingAddress: { country: 'BR', postalCode: '30150-904', street: 'Rua X', number: '1', district: 'Centro', city: 'BH', state: 'MG' },
    shippingMethod: 'sedex',
    locale: 'en',
    items: [{ productId: drawingId, slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, qty: 1, unitAmountCents: 12000 }],
    amounts: { itemsCents: 12000, shippingCents: 4100, totalCents: 16100, currency: 'brl' },
  })
})

describe('POST /api/stripe/webhook', () => {
  it('rejects an invalid signature', async () => {
    const res = await request(createApp())
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'bad')
      .set('content-type', 'application/json')
      .send('{}')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_SIGNATURE')
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('pending')
  })

  it('confirms the pending order and decrements one-of-one stock', async () => {
    const res = await signedPost(event('checkout.session.completed'))
    expect(res.status).toBe(200)
    const order = (await Order.findOne({ orderNumber: 1 }))!
    expect(order.status).toBe('paid')
    expect(order.paidAt).toBeInstanceOf(Date)
    expect(order.stripePaymentIntentId).toBe('pi_1')
    expect(order.amounts!.totalCents).toBe(16100)
    expect(order.amounts!.shippingCents).toBe(4100) // our breakdown is kept
    expect(order.buyer!.email).toBe('buyer@example.com') // untouched
    expect((await Product.findById(drawingId))!.stock).toBe(0)
  })

  it('takes the charged total from Stripe when it differs, and logs it', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    await signedPost(event('checkout.session.completed', { amount_total: 16000 }))
    expect((await Order.findOne({ orderNumber: 1 }))!.amounts!.totalCents).toBe(16000)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('RECONCILE'), expect.anything())
    warn.mockRestore()
  })

  it('is idempotent: a duplicate delivery does not decrement twice', async () => {
    await signedPost(event('checkout.session.completed'))
    const res = await signedPost(event('checkout.session.completed'))
    expect(res.status).toBe(200)
    expect((await Product.findById(drawingId))!.stock).toBe(0)
    expect(await Order.countDocuments()).toBe(1)
  })

  it('marks the order oversold when stock ran out between checkout and payment', async () => {
    await Product.updateOne({ _id: drawingId }, { stock: 0 })
    await signedPost(event('checkout.session.completed'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('oversold')
  })

  it('does not touch made-to-order products', async () => {
    await Product.updateOne({ _id: drawingId }, { stock: null })
    await signedPost(event('checkout.session.completed'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('paid')
    expect((await Product.findById(drawingId))!.stock).toBeNull()
  })

  it('ignores an unpaid session (async payment methods) and unknown sessions', async () => {
    await signedPost(event('checkout.session.completed', { payment_status: 'unpaid' }))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('pending')
    const res = await signedPost(event('checkout.session.completed', { id: 'cs_unknown' }))
    expect(res.status).toBe(200)
    expect((await Product.findById(drawingId))!.stock).toBe(1)
  })

  it('expires a pending order on checkout.session.expired, but never a paid one', async () => {
    await signedPost(event('checkout.session.expired'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('expired')
    await Order.updateOne({ orderNumber: 1 }, { status: 'paid' })
    await signedPost(event('checkout.session.expired'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('paid')
  })

  it('ignores unrelated event types', async () => {
    const res = await signedPost({ id: 'evt_2', type: 'payment_intent.created', data: { object: {} } })
    expect(res.status).toBe(200)
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('pending')
  })
})
