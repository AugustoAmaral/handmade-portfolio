import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { Product } from '../src/models/product'
import * as r2 from '../src/lib/r2'

vi.mock('../src/lib/r2', () => ({ putObject: vi.fn(), deleteObject: vi.fn() }))
const putObject = vi.mocked(r2.putObject)
const deleteObject = vi.mocked(r2.deleteObject)

const token = () => jwt.sign({ sub: 'admin' }, 'test-jwt-secret', { expiresIn: '1h' })
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token()}`)

const input = {
  slug: 'new-item',
  name: { pt: 'Novo', en: 'New' },
  description: { pt: 'd', en: 'd' },
  priceCents: 3000,
  type: 'physical',
  stock: 1,
  active: true,
}

beforeEach(() => {
  putObject.mockReset().mockResolvedValue()
  deleteObject.mockReset().mockResolvedValue()
})

describe('admin products', () => {
  it('requires auth on every route', async () => {
    const app = createApp()
    for (const req of [
      request(app).get('/api/admin/products'),
      request(app).post('/api/admin/products').send(input),
    ]) {
      const res = await req
      expect(res.status).toBe(401)
    }
  })

  it('creates, updates and lists products (including inactive)', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    expect(created.status).toBe(201)
    const id = created.body.product.id

    const updated = await auth(request(app).put(`/api/admin/products/${id}`).send({ ...input, active: false }))
    expect(updated.status).toBe(200)
    expect(updated.body.product.active).toBe(false)

    const list = await auth(request(app).get('/api/admin/products'))
    expect(list.body.products).toHaveLength(1)
  })

  it('409s on duplicate slug', async () => {
    await Product.init()
    const app = createApp()
    await auth(request(app).post('/api/admin/products').send(input))
    const dup = await auth(request(app).post('/api/admin/products').send(input))
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('SLUG_TAKEN')
  })

  it('409s on updating a product to another product\'s slug', async () => {
    await Product.init()
    const app = createApp()
    await auth(request(app).post('/api/admin/products').send(input))
    const other = await auth(request(app).post('/api/admin/products').send({ ...input, slug: 'other-item' }))
    const id = other.body.product.id

    const res = await auth(request(app).put(`/api/admin/products/${id}`).send({ ...input, slug: 'new-item' }))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLUG_TAKEN')
  })

  it('uploads a photo: converts to webp, stores under products/{id}/', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer()

    const res = await auth(request(app).post(`/api/admin/products/${id}/photos`).attach('photo', png, 'photo.png'))
    expect(res.status).toBe(201)
    expect(putObject).toHaveBeenCalledTimes(1)
    const [key, body] = putObject.mock.calls[0]!
    expect(key).toMatch(new RegExp(`^products/${id}/[0-9a-f-]+\\.webp$`))
    const meta = await sharp(body).metadata()
    expect(meta.format).toBe('webp')
    expect(res.body.product.photos).toHaveLength(1)
  })

  it('deletes a photo from the product and from R2', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, { $push: { photos: { r2Key: `products/${id}/a.webp` } } })

    const res = await auth(request(app).delete(`/api/admin/products/${id}/photos`).query({ key: `products/${id}/a.webp` }))
    expect(res.status).toBe(200)
    expect(deleteObject).toHaveBeenCalledWith(`products/${id}/a.webp`)
    expect(res.body.product.photos).toHaveLength(0)
  })

  it('deletes a product and cleans up its photos', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, { $push: { photos: { r2Key: `products/${id}/a.webp` } } })

    const res = await auth(request(app).delete(`/api/admin/products/${id}`))
    expect(res.status).toBe(204)
    expect(deleteObject).toHaveBeenCalledWith(`products/${id}/a.webp`)
    expect(await Product.countDocuments()).toBe(0)
  })
})
