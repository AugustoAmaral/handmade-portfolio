import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Product } from '../src/models/product'

const app = () => createApp()

beforeEach(async () => {
  await Product.create([
    {
      slug: 'handwritten-letter',
      name: { pt: 'Carta escrita à mão', en: 'Handwritten letter' },
      description: { pt: 'x', en: 'x' },
      priceCents: 5000,
      type: 'physical',
      stock: null,
      active: true,
    },
    {
      slug: 'hidden',
      name: { pt: 'Oculto', en: 'Hidden' },
      description: { pt: 'x', en: 'x' },
      priceCents: 1000,
      type: 'digital',
      stock: null,
      active: false,
    },
  ])
})

describe('public catalog', () => {
  it('lists only active products', async () => {
    const res = await request(app()).get('/api/products')
    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0].slug).toBe('handwritten-letter')
    expect(res.body.products[0].name.en).toBe('Handwritten letter')
  })
  it('gets one product by slug', async () => {
    const res = await request(app()).get('/api/products/handwritten-letter')
    expect(res.status).toBe(200)
    expect(res.body.product.priceCents).toBe(5000)
  })
  it('404s on inactive or unknown slug with the error contract', async () => {
    for (const slug of ['hidden', 'nope']) {
      const res = await request(app()).get(`/api/products/${slug}`)
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND')
    }
  })
})
