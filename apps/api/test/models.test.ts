import { describe, expect, it } from 'vitest'
import { Order } from '../src/models/order'
import { Product, toPublicProduct } from '../src/models/product'

describe('models', () => {
  it('enforces unique stripeSessionId on Order', async () => {
    await Order.init()
    const base = {
      stripeSessionId: 'cs_1',
      items: [],
      amounts: { itemsCents: 100, shippingCents: 0, totalCents: 100, currency: 'brl' },
      customer: { email: 'a@b.c', name: 'A' },
      status: 'paid',
    }
    await Order.create(base)
    await expect(Order.create(base)).rejects.toThrow(/duplicate key/)
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
