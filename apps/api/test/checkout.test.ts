import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'
import { Product } from '../src/models/product'
import { stripe } from '../src/lib/stripe'

vi.mock('../src/lib/stripe', () => ({
  stripe: { checkout: { sessions: { create: vi.fn(), expire: vi.fn() } } },
}))
const sessionsCreate = vi.mocked(stripe.checkout.sessions.create)
const sessionsExpire = vi.mocked(stripe.checkout.sessions.expire)

const buyer = { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' }
const brAddress = {
  country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388',
  district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
}
const physical = {
  items: [{ slug: 'letter', qty: 2 }], locale: 'pt', buyer,
  shippingAddress: brAddress, shippingMethod: 'sedex', notes: 'For my grandmother',
}
const digital = { items: [{ slug: 'doodle', qty: 1 }], locale: 'en', buyer }

let letterId: string

beforeEach(async () => {
  sessionsCreate.mockReset()
  sessionsCreate.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } as never)
  sessionsExpire.mockReset()
  sessionsExpire.mockResolvedValue({ id: 'cs_test_1' } as never)
  const letter = await Product.create({
    slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, description: { pt: 'x', en: 'x' },
    priceCents: 5000, type: 'physical', stock: null, active: true,
  })
  await Product.create({
    slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, description: { pt: 'x', en: 'x' },
    priceCents: 12000, type: 'physical', stock: 1, active: true,
  })
  await Product.create({
    slug: 'doodle', name: { pt: 'Rabisco', en: 'Doodle' }, description: { pt: 'x', en: 'x' },
    priceCents: 1500, type: 'digital', stock: null, active: true,
  })
  letterId = String(letter._id)
})

const post = (body: object) => request(createApp()).post('/api/checkout').send(body)

describe('POST /api/checkout', () => {
  it('creates a pending order with our totals, then a session priced from the database', async () => {
    const res = await post(physical)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1', orderNumber: 1 })

    const order = (await Order.findOne({ orderNumber: 1 }))!
    expect(order.status).toBe('pending')
    expect(order.stripeSessionId).toBe('cs_test_1')
    expect(order.buyer!.email).toBe('marina@example.com')
    expect(order.shippingAddress!.city).toBe('Belo Horizonte')
    expect(order.shippingMethod).toBe('sedex')
    expect(order.notes).toBe('For my grandmother')
    expect(order.locale).toBe('pt')
    expect(order.items.map((i) => ({ productId: i.productId, slug: i.slug, qty: i.qty, unitAmountCents: i.unitAmountCents }))).toEqual([
      { productId: letterId, slug: 'letter', qty: 2, unitAmountCents: 5000 },
    ])
    expect(order.amounts).toMatchObject({ itemsCents: 10000, shippingCents: 4100, totalCents: 14100, currency: 'brl' })

    const params = sessionsCreate.mock.calls[0]![0]!
    expect(params.line_items![0]).toMatchObject({ quantity: 2, price_data: { currency: 'brl', unit_amount: 5000 } })
    expect(params.line_items![1]).toMatchObject({ quantity: 1, price_data: { unit_amount: 4100 } })
    expect(params.metadata).toEqual({ orderId: String(order._id), orderNumber: '1' })
    expect(params.customer_email).toBe('marina@example.com')
    expect(params.shipping_address_collection).toBeUndefined()
    expect(params.shipping_options).toBeUndefined()
    expect(params.payment_intent_data!.shipping!.address.city).toBe('Belo Horizonte')
    expect(params.success_url).toBe('http://localhost:5173/thanks?order=1&session_id={CHECKOUT_SESSION_ID}')
  })

  it('ignores any price the client sends', async () => {
    await post({ ...physical, items: [{ slug: 'letter', qty: 1, priceCents: 1 }] })
    const params = sessionsCreate.mock.calls[0]![0]!
    expect(params.line_items![0]!.price_data!.unit_amount).toBe(5000)
  })

  it('numbers orders sequentially', async () => {
    await post(physical)
    sessionsCreate.mockResolvedValue({ id: 'cs_test_2', url: 'https://checkout.stripe.com/c/pay/cs_test_2' } as never)
    const res = await post(digital)
    expect(res.body.orderNumber).toBe(2)
  })

  it('stores a digital-only order without address or method and without a shipping line', async () => {
    const res = await post(digital)
    expect(res.status).toBe(200)
    const order = (await Order.findOne({ orderNumber: 1 }))!
    expect(order.shippingAddress).toBeNull()
    expect(order.shippingMethod).toBeNull()
    expect(order.amounts!.shippingCents).toBe(0)
    const params = sessionsCreate.mock.calls[0]![0]!
    expect(params.line_items).toHaveLength(1)
    expect(params.payment_intent_data).toBeUndefined()
  })

  it('rejects a physical cart without address with dotted fieldErrors', async () => {
    const res = await post({ ...physical, shippingAddress: undefined, shippingMethod: undefined })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.fieldErrors).toEqual({ shippingAddress: ['required'], shippingMethod: ['required'] })
    expect(await Order.countDocuments()).toBe(0)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('rejects an international method for a Brazilian address', async () => {
    const res = await post({ ...physical, shippingMethod: 'intl' })
    expect(res.status).toBe(400)
    expect(res.body.error.fieldErrors).toEqual({ shippingMethod: ['not_available'] })
  })

  it('reports zod errors with dotted paths', async () => {
    const res = await post({ ...digital, buyer: { name: 'M', email: 'nope' } })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(Object.keys(res.body.error.fieldErrors).sort()).toEqual(['buyer.email', 'buyer.name'])
  })

  it('rejects an unknown or inactive item', async () => {
    const res = await post({ ...digital, items: [{ slug: 'ghost', qty: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('UNKNOWN_ITEM')
    expect(await Order.countDocuments()).toBe(0)
  })

  it('rejects qty above remaining stock for one-of-one items', async () => {
    const res = await post({ ...physical, items: [{ slug: 'drawing', qty: 2 }] })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('OUT_OF_STOCK')
    expect(await Order.countDocuments()).toBe(0)
  })

  it('deletes the pending order and answers 502 when Stripe fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    sessionsCreate.mockRejectedValue(new Error('stripe down'))
    const res = await post(physical)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('STRIPE_UNAVAILABLE')
    expect(await Order.countDocuments()).toBe(0)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[checkout]'), expect.anything())
    errorSpy.mockRestore()
  })

  it('expires the Stripe session and drops the order when persisting the session id fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Order.create() persists via Document#$save, a reference captured at module load time —
    // it does not go through Order.prototype.save. So the only call this spy ever sees is the
    // route's own explicit `order.save()` after the Stripe session is created.
    const saveSpy = vi.spyOn(Order.prototype, 'save').mockRejectedValueOnce(new Error('mongo down'))

    const res = await post(physical)
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL')
    expect(sessionsExpire).toHaveBeenCalledWith('cs_test_1')
    expect(await Order.countDocuments()).toBe(0)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[checkout]'), expect.anything())

    saveSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
