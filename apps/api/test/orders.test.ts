import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'

beforeEach(async () => {
  await Order.create({
    orderNumber: 413,
    status: 'pending',
    stripeSessionId: 'cs_sum',
    buyer: { name: 'Buyer', email: 'buyer@example.com' },
    shippingAddress: { country: 'BR', postalCode: '30150-904', street: 'Rua X', number: '1', district: 'Centro', city: 'BH', state: 'MG' },
    shippingMethod: 'pac',
    locale: 'pt',
    items: [{ productId: 'x', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 2, unitAmountCents: 5000 }],
    amounts: { itemsCents: 10000, shippingCents: 2200, totalCents: 12200, currency: 'brl' },
  })
})

const get = (orderNumber: string, sessionId?: string) =>
  request(createApp()).get(`/api/orders/${orderNumber}`).query(sessionId === undefined ? {} : { session_id: sessionId })

describe('GET /api/orders/:orderNumber', () => {
  it('returns the public order when the session id matches', async () => {
    const res = await get('413', 'cs_sum')
    expect(res.status).toBe(200)
    expect(res.body.order).toEqual({
      orderNumber: 413,
      status: 'pending',
      items: [{ name: { pt: 'Carta', en: 'Letter' }, qty: 2 }],
      totalCents: 12200,
      currency: 'brl',
      shippingMethod: 'pac',
      eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' },
    })
    expect(JSON.stringify(res.body)).not.toContain('buyer@example.com')
    expect(JSON.stringify(res.body)).not.toContain('Rua X')
  })
  it('404s when the session id is wrong or missing (numbers are not enumerable)', async () => {
    for (const res of [await get('413', 'cs_other'), await get('413'), await get('413', '')]) {
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND')
    }
  })
  it('404s for an unknown or non-numeric order number', async () => {
    expect((await get('999', 'cs_sum')).status).toBe(404)
    expect((await get('abc', 'cs_sum')).status).toBe(404)
  })
})
