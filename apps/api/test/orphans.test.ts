import { describe, expect, it } from 'vitest'
import { expireOrphanPendingOrders } from '../src/lib/orphans'
import { Order } from '../src/models/order'

const HOUR_MS = 60 * 60 * 1000

const baseOrder = {
  buyer: { name: 'Buyer', email: 'buyer@example.com' },
  locale: 'en' as const,
  items: [] as never[],
  amounts: { itemsCents: 0, shippingCents: 0, totalCents: 0, currency: 'brl' },
}

describe('expireOrphanPendingOrders', () => {
  it('expires a pending order without a Stripe session older than the threshold', async () => {
    await Order.create({
      ...baseOrder,
      orderNumber: 1,
      status: 'pending',
      createdAt: new Date(Date.now() - 2 * HOUR_MS),
    })
    const count = await expireOrphanPendingOrders(new Date(Date.now() - HOUR_MS))
    expect(count).toBe(1)
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('expired')
  })

  it('leaves a recent pending order without a Stripe session untouched', async () => {
    await Order.create({
      ...baseOrder,
      orderNumber: 2,
      status: 'pending',
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    })
    const count = await expireOrphanPendingOrders(new Date(Date.now() - HOUR_MS))
    expect(count).toBe(0)
    expect((await Order.findOne({ orderNumber: 2 }))!.status).toBe('pending')
  })

  it('leaves a pending order that already has a Stripe session id untouched', async () => {
    await Order.create({
      ...baseOrder,
      orderNumber: 3,
      status: 'pending',
      stripeSessionId: 'cs_test_orphan',
      createdAt: new Date(Date.now() - 2 * HOUR_MS),
    })
    const count = await expireOrphanPendingOrders(new Date(Date.now() - HOUR_MS))
    expect(count).toBe(0)
    expect((await Order.findOne({ orderNumber: 3 }))!.status).toBe('pending')
  })

  it('leaves an old paid order without a Stripe session untouched', async () => {
    await Order.create({
      ...baseOrder,
      orderNumber: 4,
      status: 'paid',
      createdAt: new Date(Date.now() - 2 * HOUR_MS),
    })
    const count = await expireOrphanPendingOrders(new Date(Date.now() - HOUR_MS))
    expect(count).toBe(0)
    expect((await Order.findOne({ orderNumber: 4 }))!.status).toBe('paid')
  })
})
