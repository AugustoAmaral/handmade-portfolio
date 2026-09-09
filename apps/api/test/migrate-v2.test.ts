import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { migrateOrderDoc, runMigration } from '../src/lib/migrate-v2'
import { Order } from '../src/models/order'

const v1Physical = {
  stripeSessionId: 'cs_v1_a',
  stripePaymentIntentId: 'pi_a',
  items: [{ productId: 'p1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 }],
  amounts: { itemsCents: 5000, shippingCents: 1500, totalCents: 6500, currency: 'brl' },
  customer: { email: 'a@example.com', name: 'Ana' },
  shippingAddress: { name: 'Ana', address: { line1: 'Rua X, 1', line2: 'ap 2', city: 'BH', state: 'MG', postal_code: '30150-904', country: 'BR' } },
  status: 'fulfilled',
  trackingCode: 'BR1',
  createdAt: new Date('2026-08-25T10:00:00Z'),
  updatedAt: new Date('2026-08-27T10:00:00Z'),
}
const v1Digital = {
  stripeSessionId: 'cs_v1_b',
  items: [{ productId: 'p2', slug: 'doodle', name: { pt: 'Rabisco', en: 'Doodle' }, qty: 1, unitAmountCents: 1500 }],
  amounts: { itemsCents: 1500, shippingCents: 0, totalCents: 1500, currency: 'brl' },
  customer: { email: 'b@example.com' },
  shippingAddress: null,
  status: 'paid',
  createdAt: new Date('2026-08-26T10:00:00Z'),
  updatedAt: new Date('2026-08-26T10:00:00Z'),
}

describe('migrateOrderDoc', () => {
  it('maps a fulfilled physical v1 order to a shipped v2 order', () => {
    const { $set, $unset } = migrateOrderDoc(v1Physical, 1)
    expect($set).toEqual({
      orderNumber: 1,
      status: 'shipped',
      buyer: { name: 'Ana', email: 'a@example.com' },
      shippingAddress: { country: 'BR', postalCode: '30150-904', street: 'Rua X, 1', complement: 'ap 2', city: 'BH', state: 'MG' },
      shippingMethod: 'pac',
      locale: 'en',
      paidAt: new Date('2026-08-25T10:00:00Z'),
      shippedAt: new Date('2026-08-27T10:00:00Z'),
    })
    expect($unset).toEqual({ customer: '' })
  })
  it('maps a paid digital v1 order, filling a name when missing', () => {
    const { $set } = migrateOrderDoc(v1Digital, 2)
    expect($set).toMatchObject({
      orderNumber: 2, status: 'paid', buyer: { name: 'Unknown', email: 'b@example.com' },
      shippingAddress: null, shippingMethod: null, locale: 'en', paidAt: new Date('2026-08-26T10:00:00Z'),
    })
    expect(($set as { shippedAt?: unknown }).shippedAt).toBeUndefined()
  })
  it('infers the international method for a foreign address and keeps oversold', () => {
    const { $set } = migrateOrderDoc({ ...v1Physical, status: 'oversold', shippingAddress: { address: { line1: '1 Main St', city: 'NYC', postal_code: '10001', country: 'US' } } }, 3)
    expect($set).toMatchObject({ status: 'oversold', shippingMethod: 'intl', shippingAddress: { country: 'US', street: '1 Main St', city: 'NYC', postalCode: '10001' } })
  })
})

describe('runMigration', () => {
  it('migrates v1 documents oldest first, numbers them, and leaves v2 documents alone', async () => {
    const col = mongoose.connection.collection('orders')
    await col.insertMany([v1Digital, v1Physical]) // inserted out of order on purpose
    await Order.create({
      orderNumber: 500, status: 'pending', stripeSessionId: 'cs_v2', buyer: { name: 'V2', email: 'v2@example.com' }, locale: 'pt',
      items: [], amounts: { itemsCents: 0, shippingCents: 0, totalCents: 0, currency: 'brl' },
    })

    expect(await runMigration()).toBe(2)

    const a = (await Order.findOne({ stripeSessionId: 'cs_v1_a' }))!
    const b = (await Order.findOne({ stripeSessionId: 'cs_v1_b' }))!
    expect(a.orderNumber).toBe(1) // older
    expect(b.orderNumber).toBe(2)
    expect(a.status).toBe('shipped')
    expect(a.buyer!.email).toBe('a@example.com')
    expect(a.shippingAddress!.street).toBe('Rua X, 1')
    expect((a.toObject() as Record<string, unknown>).customer).toBeUndefined()
    expect((await Order.findOne({ orderNumber: 500 }))!.status).toBe('pending')

    expect(await runMigration()).toBe(0) // idempotent
  })

  it('keeps indexes buildable while legacy documents exist', async () => {
    const col = mongoose.connection.collection('orders')
    await col.insertMany([v1Digital, v1Physical]) // both lack orderNumber, as v1 always did

    // orderNumber is sparse specifically so this doesn't throw with unmigrated documents present.
    await expect(Order.syncIndexes()).resolves.toBeDefined()

    expect(await runMigration()).toBe(2)

    const a = (await Order.findOne({ stripeSessionId: 'cs_v1_a' }))!
    const b = (await Order.findOne({ stripeSessionId: 'cs_v1_b' }))!
    expect(a.orderNumber).toBe(1) // older
    expect(b.orderNumber).toBe(2)
  })
})
