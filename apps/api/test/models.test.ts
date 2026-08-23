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

  it('serializes a product with public photo URLs', async () => {
    const doc = await Product.create({
      slug: 'letter',
      name: { pt: 'Carta', en: 'Letter' },
      description: { pt: 'Uma carta', en: 'A letter' },
      priceCents: 5000,
      type: 'physical',
      stock: null,
      photos: [{ r2Key: 'products/x/1.webp' }],
      active: true,
    })
    const pub = toPublicProduct(doc)
    expect(pub.photos).toEqual([{ url: 'https://img.test.local/products/x/1.webp' }])
    expect(pub.id).toBe(String(doc._id))
    expect(pub.stock).toBeNull()
  })
})
