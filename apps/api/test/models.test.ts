import { describe, expect, it } from 'vitest'
import { Order, toAdminOrder, toPublicOrder } from '../src/models/order'
import { Product, toPublicProduct } from '../src/models/product'

describe('models', () => {
  const pendingOrder = (orderNumber: number) => ({
    orderNumber,
    status: 'pending',
    buyer: { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' },
    shippingAddress: {
      country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388', complement: 'ap. 51',
      district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
    },
    shippingMethod: 'pac',
    notes: 'For my grandmother',
    locale: 'pt',
    items: [{ productId: 'p1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 }],
    amounts: { itemsCents: 5000, shippingCents: 2200, totalCents: 7200, currency: 'brl' },
  })

  it('allows several pending orders without a session id, but rejects a duplicate session id', async () => {
    await Order.syncIndexes()
    await Order.create(pendingOrder(1))
    await Order.create(pendingOrder(2))
    expect(await Order.countDocuments({ stripeSessionId: { $exists: false } })).toBe(2)
    await Order.create({ ...pendingOrder(3), stripeSessionId: 'cs_1' })
    await expect(Order.create({ ...pendingOrder(4), stripeSessionId: 'cs_1' })).rejects.toThrow(/duplicate key/)
  })

  it('rejects a duplicate order number', async () => {
    await Order.syncIndexes()
    await Order.create(pendingOrder(7))
    await expect(Order.create(pendingOrder(7))).rejects.toThrow(/duplicate key/)
  })

  it('defaults status to pending and shipping fields to null for a digital-only order', async () => {
    const doc = await Order.create({
      orderNumber: 9,
      buyer: { name: 'B', email: 'b@example.com' },
      locale: 'en',
      items: [{ productId: 'p2', slug: 'doodle', name: { pt: 'Rabisco', en: 'Doodle' }, qty: 1, unitAmountCents: 1500 }],
      amounts: { itemsCents: 1500, shippingCents: 0, totalCents: 1500, currency: 'brl' },
    })
    expect(doc.status).toBe('pending')
    expect(doc.shippingAddress).toBeNull()
    expect(doc.shippingMethod).toBeNull()
  })

  it('serializes a public order without buyer data and with the ETA of the method', async () => {
    const doc = await Order.create({ ...pendingOrder(10), stripeSessionId: 'cs_pub', status: 'paid' })
    const pub = toPublicOrder(doc)
    expect(pub).toEqual({
      orderNumber: 10,
      status: 'paid',
      items: [{ name: { pt: 'Carta', en: 'Letter' }, qty: 1 }],
      totalCents: 7200,
      currency: 'brl',
      shippingMethod: 'pac',
      eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' },
    })
    expect(JSON.stringify(pub)).not.toContain('marina@example.com')
  })

  it('serializes an admin order with everything', async () => {
    const doc = await Order.create({ ...pendingOrder(11), stripeSessionId: 'cs_adm', trackingCode: 'BR123' })
    const adm = toAdminOrder(doc)
    expect(adm.id).toBe(String(doc._id))
    expect(adm.orderNumber).toBe(11)
    expect(adm.buyer).toEqual({ name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' })
    expect(adm.shippingAddress).toEqual(pendingOrder(11).shippingAddress)
    expect(adm.shippingMethod).toBe('pac')
    expect(adm.notes).toBe('For my grandmother')
    expect(adm.items[0]).toEqual({ productId: 'p1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 })
    expect(adm.amounts).toEqual({ itemsCents: 5000, shippingCents: 2200, totalCents: 7200, currency: 'brl' })
    expect(adm.trackingCode).toBe('BR123')
    expect(adm.stripeSessionId).toBe('cs_adm')
    expect(typeof adm.createdAt).toBe('string')
    expect(adm.paidAt).toBeUndefined()
  })

  it('serializes a product with public photo URLs, keys, alt text and the v2 fields', async () => {
    const doc = await Product.create({
      slug: 'letter',
      name: { pt: 'Carta', en: 'Letter' },
      description: { pt: 'Uma carta', en: 'A letter' },
      subtitle: { pt: 'Papel algodão', en: 'Cotton paper' },
      priceCents: 5000,
      type: 'physical',
      stock: null,
      specs: [{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }],
      photos: [{ r2Key: 'products/x/1.webp', alt: { pt: 'Carta na mesa', en: 'Letter on a table' } }],
      featured: true,
      active: true,
    })
    const pub = toPublicProduct(doc)
    expect(pub.photos).toEqual([
      { key: 'products/x/1.webp', url: 'https://img.test.local/products/x/1.webp', alt: { pt: 'Carta na mesa', en: 'Letter on a table' } },
    ])
    expect(pub.subtitle).toEqual({ pt: 'Papel algodão', en: 'Cotton paper' })
    expect(pub.specs).toEqual([{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }])
    expect(pub.featured).toBe(true)
    expect(pub.id).toBe(String(doc._id))
    expect(pub.stock).toBeNull()
  })

  it('fills v2 defaults for a v1-shaped product document', async () => {
    // Simulates a document written by v1 (no subtitle/specs/featured, photo without alt).
    await Product.collection.insertOne({
      slug: 'old', name: { pt: 'Velho', en: 'Old' }, description: { pt: 'x', en: 'x' },
      priceCents: 1000, type: 'digital', stock: null, photos: [{ r2Key: 'products/o/1.webp' }], active: true,
    })
    const doc = (await Product.findOne({ slug: 'old' }))!
    const pub = toPublicProduct(doc)
    expect(pub.subtitle).toEqual({ pt: '', en: '' })
    expect(pub.specs).toEqual([])
    expect(pub.featured).toBe(false)
    expect(pub.photos[0]!.alt).toEqual({ pt: '', en: '' })
  })
})
