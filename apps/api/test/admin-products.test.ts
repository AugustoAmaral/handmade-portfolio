import { MAX_PHOTO_BYTES } from '@shop/shared'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { Product } from '../src/models/product'
import * as images from '../src/lib/images'
import * as r2 from '../src/lib/r2'

vi.mock('../src/lib/r2', () => ({ putObject: vi.fn(), deleteObject: vi.fn() }))
const putObject = vi.mocked(r2.putObject)
const deleteObject = vi.mocked(r2.deleteObject)

// A SPY THAT DELEGATES, not a stub. The webp conversion is real in every test that cares about it —
// the format and the key assertions below run sharp for real — and the size-limit test needs to
// know only WHETHER the route got as far as calling it, because multer rejecting a file and sharp
// failing to decode one are the same 500 from the outside.
vi.mock('../src/lib/images', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/images')>()
  return { toWebp: vi.fn(actual.toWebp) }
})
const toWebp = vi.mocked(images.toWebp)

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
  toWebp.mockClear()
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

  it('creates a product with subtitle, specs and featured, and lists them back', async () => {
    const app = createApp()
    const res = await auth(request(app).post('/api/admin/products').send({
      ...input,
      subtitle: { pt: 'Papel algodão', en: 'Cotton paper' },
      specs: [{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }],
      featured: true,
    }))
    expect(res.status).toBe(201)
    expect(res.body.product.subtitle).toEqual({ pt: 'Papel algodão', en: 'Cotton paper' })
    expect(res.body.product.specs).toHaveLength(1)
    expect(res.body.product.featured).toBe(true)
  })

  it('stores alt text sent with a photo upload', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer()
    const res = await auth(
      request(app).post(`/api/admin/products/${id}/photos`)
        .field('altPt', 'Carta na mesa').field('altEn', 'Letter on a table')
        .attach('photo', png, 'photo.png'),
    )
    expect(res.status).toBe(201)
    expect(res.body.product.photos[0].alt).toEqual({ pt: 'Carta na mesa', en: 'Letter on a table' })
    expect(res.body.product.photos[0].key).toMatch(new RegExp(`^products/${id}/`))
  })

  it('400s on photo upload when altPt is over 200 chars', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer()
    const res = await auth(
      request(app).post(`/api/admin/products/${id}/photos`)
        .field('altPt', 'x'.repeat(201))
        .attach('photo', png, 'photo.png'),
    )
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.fieldErrors.altPt).toBeTruthy()
    expect(putObject).not.toHaveBeenCalled()
  })

  it('404s deleting a photo key the product does not own', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, { $push: { photos: { r2Key: `products/${id}/a.webp` } } })

    const res = await auth(
      request(app).delete(`/api/admin/products/${id}/photos`).query({ key: `products/${id}/not-owned.webp` }),
    )
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('PHOTO_NOT_FOUND')
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('reorders photos and edits alt text through PUT, keeping alt for entries without one', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, {
      $push: { photos: { $each: [
        { r2Key: `products/${id}/a.webp`, alt: { pt: 'A pt', en: 'A en' } },
        { r2Key: `products/${id}/b.webp`, alt: { pt: 'B pt', en: 'B en' } },
      ] } },
    })
    const res = await auth(request(app).put(`/api/admin/products/${id}`).send({
      ...input,
      photos: [{ key: `products/${id}/b.webp`, alt: { pt: 'B novo', en: 'B new' } }, { key: `products/${id}/a.webp` }],
    }))
    expect(res.status).toBe(200)
    expect(res.body.product.photos.map((p: { key: string }) => p.key)).toEqual([`products/${id}/b.webp`, `products/${id}/a.webp`])
    expect(res.body.product.photos[0].alt).toEqual({ pt: 'B novo', en: 'B new' })
    expect(res.body.product.photos[1].alt).toEqual({ pt: 'A pt', en: 'A en' })
  })

  it('400s when the PUT photos list does not match the existing keys exactly', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, { $push: { photos: { r2Key: `products/${id}/a.webp` } } })
    for (const photos of [
      [],                                                                            // drops a photo
      [{ key: `products/${id}/zzz.webp` }],                                          // unknown key
      [{ key: `products/${id}/a.webp` }, { key: `products/${id}/a.webp` }],          // duplicate
    ]) {
      const res = await auth(request(app).put(`/api/admin/products/${id}`).send({ ...input, photos }))
      expect(res.status).toBe(400)
      expect(res.body.error.fieldErrors).toEqual({ photos: ['must_match_existing'] })
    }
  })

  it('leaves photos untouched when PUT omits the photos field', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, { $push: { photos: { r2Key: `products/${id}/a.webp` } } })
    const res = await auth(request(app).put(`/api/admin/products/${id}`).send({ ...input, priceCents: 3500 }))
    expect(res.status).toBe(200)
    expect(res.body.product.photos).toHaveLength(1)
    expect(res.body.product.priceCents).toBe(3500)
  })

  it('accepts a photo a byte under the shared cap and refuses one at it', async () => {
    // THE OTHER END OF `MAX_PHOTO_BYTES`, which the panel enforces in the browser so that nobody
    // ever meets the failure below. Both sides read the constant now; until they did, multer's 8 MB
    // and the web's were two numbers that happened to agree.
    //
    // BOTH DIRECTIONS, AND THE FIRST ONE IS WHAT MAKES THIS ABOUT THE NUMBER. Asserting only that
    // an oversized file fails passes on any cap at all, however small — measured: lowering the
    // constant to 4 MB left a one-sided version of this test green.
    //
    // THE LIMIT IS EXCLUSIVE, WHICH THIS TEST IS HOW WE KNOW. busboy refuses a file of exactly
    // `fileSize`, so 8388607 is the largest that can be sent. The panel's own guard was `>` and
    // therefore passed 8388608 through to the 500 below; it is `>=` now.
    //
    // `toWebp` IS ASSERTED ALONGSIDE THE STATUS AND NOT INSTEAD OF IT. The two upload failures now
    // answer with two different codes, so the code alone already separates them — but the codes are
    // strings and a handler that returned the wrong one for the right reason would still be wrong.
    // Whether the route got as far as the conversion is the MECHANISM: multer refuses an oversized
    // file before the handler runs, and a file it cannot decode gets all the way in. The test below
    // asserts the mirror image of both lines. The at-cap buffer is zeros, so its one call is
    // stubbed — the real conversion is exercised by the webp test above.
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id

    toWebp.mockImplementationOnce(async () => Buffer.from('webp'))
    const underCap = await auth(
      request(app).post(`/api/admin/products/${id}/photos`).attach('photo', Buffer.alloc(MAX_PHOTO_BYTES - 1), 'big.png'),
    )
    expect(underCap.status).toBe(201)
    expect(toWebp).toHaveBeenCalledTimes(1)
    expect(putObject).toHaveBeenCalledTimes(1)

    const over = await auth(
      request(app).post(`/api/admin/products/${id}/photos`).attach('photo', Buffer.alloc(MAX_PHOTO_BYTES), 'huge.png'),
    )
    // 413 AND THE CODE, NOT "NOT A 500". A 4xx alone would be satisfied by every other failure this
    // route has, the two below included, and the status alone would be satisfied by a 413 carrying
    // any code at all. The pinned 500 this replaces was deliberate: the fix could not land without
    // this line going red first.
    expect(over.status).toBe(413)
    expect(over.body.error.code).toBe('PHOTO_TOO_LARGE')
    // The message names the limit, and the number is derived here from the same constant rather
    // than written out — a handler dividing by 1024 once would answer "8192 MB" with nothing red.
    expect(over.body.error.message).toContain(`${MAX_PHOTO_BYTES / 1024 / 1024} MB`)
    // Still one: multer aborted the request before the handler could ask sharp anything. This is
    // the half that a decode failure inverts.
    expect(toWebp).toHaveBeenCalledTimes(1)
    expect(putObject).toHaveBeenCalledTimes(1)
    expect((await Product.findById(id))!.photos).toHaveLength(1)
  })

  it('400s a file it cannot decode as a photo, and says which of the two failures it was', async () => {
    // THE FAILURE THE PANEL CAN ACTUALLY REACH, and the one no plan named. `PhotosEditor` checks
    // the MIME type the BROWSER reports, which browsers derive largely from the extension — so a
    // PDF renamed `.jpg`, a truncated download or a HEIC someone renamed passes the panel's guard,
    // passes multer (which has no `fileFilter`) and dies inside sharp. That is not a `MulterError`
    // and not an `AppError`; before this it was the same `INTERNAL` a crash produces.
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id

    const notAnImage = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n')
    const res = await auth(
      request(app).post(`/api/admin/products/${id}/photos`).attach('photo', notAnImage, 'foto.jpg'),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('PHOTO_UNREADABLE')
    // THE MIRROR OF THE SIZE TEST. The request got all the way to the conversion — real sharp, not
    // a stub — which is what makes this a different failure from the one above rather than the same
    // failure with a different label. Answering `PHOTO_TOO_LARGE` here would pass the two status
    // lines above and fail this one.
    expect(toWebp).toHaveBeenCalledTimes(1)
    // Nothing reached R2 and nothing reached Mongo: a photo that cannot be decoded must not leave a
    // key behind on the product pointing at an object that was never stored.
    expect(putObject).not.toHaveBeenCalled()
    expect((await Product.findById(id))!.photos).toHaveLength(0)
  })

  it('400s a multipart the upload middleware refuses, carrying its reason', async () => {
    // The rest of `MulterError` — a part named something else, a second file, an oversized text
    // field. None of it is reachable from the panel, which posts exactly one part called `photo`,
    // but all of it is reachable over HTTP, and all of it was a 500 saying the server broke about a
    // request the server understood perfectly well.
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id

    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer()
    const res = await auth(
      request(app).post(`/api/admin/products/${id}/photos`).attach('picture', png, 'photo.png'),
    )

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_UPLOAD')
    // multer's own reason is carried through rather than flattened into one sentence: the code is
    // for the panel, the message is for whoever is reading a response by hand.
    expect(res.body.error.message).toContain('Unexpected field')
    expect(toWebp).not.toHaveBeenCalled()
    expect(putObject).not.toHaveBeenCalled()
  })
})
