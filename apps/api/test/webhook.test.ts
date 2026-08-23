import Stripe from 'stripe'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
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

function completedEvent(sessionOverrides: object = {}) {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_done',
        object: 'checkout.session',
        payment_intent: 'pi_1',
        amount_subtotal: 12000,
        amount_total: 13500,
        currency: 'brl',
        total_details: { amount_shipping: 1500 },
        customer_details: { email: 'buyer@example.com', name: 'Buyer' },
        shipping_details: { name: 'Buyer', address: { country: 'BR', line1: 'Rua X, 1' } },
        metadata: {},
        ...sessionOverrides,
      },
    },
  }
}

let drawingId: string

beforeEach(async () => {
  await Order.init()
  const drawing = await Product.create({
    slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, description: { pt: 'x', en: 'x' },
    priceCents: 12000, type: 'physical', stock: 1, active: true,
  })
  drawingId = String(drawing._id)
})

const metadataFor = (qty = 1) => ({
  items: JSON.stringify([{ i: drawingId, s: 'drawing', q: qty, u: 12000 }]),
  destination: 'BR',
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
    expect(await Order.countDocuments()).toBe(0)
  })

  it('creates an order and decrements one-of-one stock', async () => {
    const res = await signedPost(completedEvent({ metadata: metadataFor() }))
    expect(res.status).toBe(200)
    const order = await Order.findOne({ stripeSessionId: 'cs_test_done' })
    expect(order).not.toBeNull()
    expect(order!.status).toBe('paid')
    expect(order!.amounts!.totalCents).toBe(13500)
    expect(order!.amounts!.shippingCents).toBe(1500)
    expect(order!.items[0]!.name!.en).toBe('Drawing')
    expect(order!.customer!.email).toBe('buyer@example.com')
    expect(order!.shippingAddress).toMatchObject({ address: { country: 'BR' } })
    const drawing = await Product.findById(drawingId)
    expect(drawing!.stock).toBe(0)
  })

  it('is idempotent for duplicate events', async () => {
    await signedPost(completedEvent({ metadata: metadataFor() }))
    const res = await signedPost(completedEvent({ metadata: metadataFor() }))
    expect(res.status).toBe(200)
    expect(await Order.countDocuments()).toBe(1)
    const drawing = await Product.findById(drawingId)
    expect(drawing!.stock).toBe(0) // decremented exactly once
  })

  it('marks the order oversold when stock ran out', async () => {
    await Product.updateOne({ _id: drawingId }, { stock: 0 })
    await signedPost(completedEvent({ metadata: metadataFor() }))
    const order = await Order.findOne({ stripeSessionId: 'cs_test_done' })
    expect(order!.status).toBe('oversold')
  })

  it('ignores unrelated event types', async () => {
    const res = await signedPost({ id: 'evt_2', type: 'payment_intent.created', data: { object: {} } })
    expect(res.status).toBe(200)
    expect(await Order.countDocuments()).toBe(0)
  })
})
