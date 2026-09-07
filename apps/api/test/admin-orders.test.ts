import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'

const auth = (r: request.Test) =>
  r.set('Authorization', `Bearer ${jwt.sign({ sub: 'admin' }, 'test-jwt-secret', { expiresIn: '1h' })}`)

const order = (orderNumber: number, status: string, createdAt: string) => ({
  orderNumber,
  status,
  stripeSessionId: `cs_${orderNumber}`,
  buyer: { name: `Buyer ${orderNumber}`, email: `b${orderNumber}@example.com` },
  locale: 'en',
  items: [{ productId: 'x', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 }],
  amounts: { itemsCents: 5000, shippingCents: 0, totalCents: 5000, currency: 'brl' },
  createdAt: new Date(createdAt),
})

const ids: Record<string, string> = {}

beforeEach(async () => {
  for (const [n, status, at] of [
    [1, 'pending', '2026-09-01'], [2, 'paid', '2026-09-02'], [3, 'shipped', '2026-09-03'],
    [4, 'oversold', '2026-09-04'], [5, 'expired', '2026-09-05'],
  ] as const) {
    const doc = await Order.create(order(n, status, at))
    ids[status] = String(doc._id)
  }
})

describe('admin orders', () => {
  it('requires auth', async () => {
    expect((await request(createApp()).get('/api/admin/orders')).status).toBe(401)
    expect((await request(createApp()).patch(`/api/admin/orders/${ids.paid}`).send({ status: 'shipped' })).status).toBe(401)
  })

  it('lists everything except expired by default, newest first, as admin orders', async () => {
    const res = await auth(request(createApp()).get('/api/admin/orders'))
    expect(res.status).toBe(200)
    expect(res.body.orders.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([4, 3, 2, 1])
    expect(res.body.orders[3]).toMatchObject({ id: ids.pending, status: 'pending', buyer: { email: 'b1@example.com' } })
  })

  it('filters by status, including expired and all', async () => {
    const paid = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'paid' }))
    expect(paid.body.orders.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([2])
    const expired = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'expired' }))
    expect(expired.body.orders.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([5])
    const all = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'all' }))
    expect(all.body.orders).toHaveLength(5)
  })

  it('400s on an unknown status filter', async () => {
    const res = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'lost' }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
  })

  it('ships a paid order with a tracking code and stamps shippedAt', async () => {
    const res = await auth(request(createApp()).patch(`/api/admin/orders/${ids.paid}`).send({ status: 'shipped', trackingCode: 'BR123' }))
    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe('shipped')
    expect(res.body.order.trackingCode).toBe('BR123')
    expect(typeof res.body.order.shippedAt).toBe('string')
  })

  it('ships an oversold order (after manual resolution) without a tracking code', async () => {
    const res = await auth(request(createApp()).patch(`/api/admin/orders/${ids.oversold}`).send({ status: 'shipped' }))
    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe('shipped')
    expect(res.body.order.trackingCode).toBeUndefined()
  })

  it('409s on shipping a pending, shipped or expired order', async () => {
    for (const id of [ids.pending, ids.shipped, ids.expired]) {
      const res = await auth(request(createApp()).patch(`/api/admin/orders/${id}`).send({ status: 'shipped' }))
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    }
  })

  it('400s on any other target status and 404s on unknown ids', async () => {
    const bad = await auth(request(createApp()).patch(`/api/admin/orders/${ids.paid}`).send({ status: 'paid' }))
    expect(bad.status).toBe(400)
    const missing = await auth(request(createApp()).patch('/api/admin/orders/000000000000000000000000').send({ status: 'shipped' }))
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('ORDER_NOT_FOUND')
  })
})
