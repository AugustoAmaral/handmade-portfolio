import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'

beforeEach(async () => {
  await Order.create({
    stripeSessionId: 'cs_sum',
    items: [{ productId: 'x', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 2, unitAmountCents: 5000 }],
    amounts: { itemsCents: 10000, shippingCents: 1500, totalCents: 11500, currency: 'brl' },
    customer: { email: 'buyer@example.com', name: 'Buyer' },
    status: 'paid',
  })
})

describe('GET /api/orders/summary', () => {
  it('returns a minimal summary without customer data', async () => {
    const res = await request(createApp()).get('/api/orders/summary').query({ session_id: 'cs_sum' })
    expect(res.status).toBe(200)
    expect(res.body.order).toEqual({
      status: 'paid',
      totalCents: 11500,
      currency: 'brl',
      items: [{ name: { pt: 'Carta', en: 'Letter' }, qty: 2 }],
    })
    expect(JSON.stringify(res.body)).not.toContain('buyer@example.com')
  })
  it('404s for an unknown session', async () => {
    const res = await request(createApp()).get('/api/orders/summary').query({ session_id: 'cs_nope' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND')
  })
})
