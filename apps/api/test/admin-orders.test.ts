import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'

const auth = (r: request.Test) =>
  r.set('Authorization', `Bearer ${jwt.sign({ sub: 'admin' }, 'test-jwt-secret', { expiresIn: '1h' })}`)

let orderId: string

beforeEach(async () => {
  const order = await Order.create({
    stripeSessionId: 'cs_admin',
    items: [{ productId: 'x', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 }],
    amounts: { itemsCents: 5000, shippingCents: 1500, totalCents: 6500, currency: 'brl' },
    customer: { email: 'b@x.com', name: 'B' },
    status: 'paid',
  })
  orderId = String(order._id)
})

describe('admin orders', () => {
  it('requires auth', async () => {
    expect((await request(createApp()).get('/api/admin/orders')).status).toBe(401)
  })
  it('lists orders with customer data', async () => {
    const res = await auth(request(createApp()).get('/api/admin/orders'))
    expect(res.status).toBe(200)
    expect(res.body.orders[0].customer.email).toBe('b@x.com')
  })
  it('marks an order fulfilled with a tracking code', async () => {
    const res = await auth(
      request(createApp()).patch(`/api/admin/orders/${orderId}`).send({ status: 'fulfilled', trackingCode: 'BR123' }),
    )
    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe('fulfilled')
    expect(res.body.order.trackingCode).toBe('BR123')
  })
  it('404s on unknown order', async () => {
    const res = await auth(
      request(createApp()).patch('/api/admin/orders/000000000000000000000000').send({ status: 'fulfilled' }),
    )
    expect(res.status).toBe(404)
  })
})
