import { randomUUID } from 'node:crypto'
import { MAX_PHOTO_BYTES, productInputSchema, productUpdateSchema } from '@shop/shared'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { AppError } from '../../errors.js'
import { toWebp } from '../../lib/images.js'
import { deleteObject, putObject } from '../../lib/r2.js'
import { Product, toPublicProduct } from '../../models/product.js'
import { adminGuard } from '../../middleware/auth.js'

// The limit the PANEL also enforces, from `@shop/shared`. It refuses an oversized file before
// sending it, which is the only useful message anyone gets: a file that reaches here throws a
// `MulterError`, which `errorHandler` does not know and answers 500 for.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES } })

const altSchema = z.object({ altPt: z.string().max(200).optional(), altEn: z.string().max(200).optional() })

export const adminProductsRouter = Router()
adminProductsRouter.use('/api/admin/products', adminGuard)

async function findProduct(id: string) {
  const doc = await Product.findById(id).catch(() => null)
  if (!doc) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  return doc
}

adminProductsRouter.get('/api/admin/products', async (_req, res) => {
  const docs = await Product.find().sort({ createdAt: 1 })
  res.json({ products: docs.map(toPublicProduct) })
})

adminProductsRouter.post('/api/admin/products', async (req, res) => {
  const input = productInputSchema.parse(req.body)
  try {
    const doc = await Product.create(input)
    res.status(201).json({ product: toPublicProduct(doc) })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError(409, 'SLUG_TAKEN', 'Slug already in use')
    throw err
  }
})

adminProductsRouter.put('/api/admin/products/:id', async (req, res) => {
  const { photos, ...input } = productUpdateSchema.parse(req.body)
  const doc = await findProduct(req.params.id)
  doc.set(input)
  if (photos) {
    // Reorder + alt edit only. Adding goes through POST /photos, removing through DELETE /photos,
    // so the list must be a permutation of what exists — anything else would orphan R2 objects.
    const existing = new Map(doc.photos.map((p) => [p.r2Key, p]))
    const keys = photos.map((p) => p.key)
    const matches = keys.length === existing.size && new Set(keys).size === keys.length && keys.every((k) => existing.has(k))
    if (!matches) throw new AppError(400, 'VALIDATION', 'photos must list every existing photo exactly once', { photos: ['must_match_existing'] })
    doc.set(
      'photos',
      photos.map((p) => ({
        r2Key: p.key,
        alt: p.alt ?? { pt: existing.get(p.key)!.alt?.pt ?? '', en: existing.get(p.key)!.alt?.en ?? '' },
      })),
    )
  }
  try {
    await doc.save()
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError(409, 'SLUG_TAKEN', 'Slug already in use')
    throw err
  }
  res.json({ product: toPublicProduct(doc) })
})

adminProductsRouter.delete('/api/admin/products/:id', async (req, res) => {
  const doc = await findProduct(req.params.id)
  await Promise.allSettled(doc.photos.map((p) => deleteObject(p.r2Key)))
  await doc.deleteOne()
  res.status(204).end()
})

adminProductsRouter.post('/api/admin/products/:id/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) throw new AppError(400, 'VALIDATION', 'Missing photo file')
  // Passing an untyped multer middleware alongside the handler makes TS fall back to the
  // generic ParamsDictionary overload (id: string | string[]) instead of inferring the
  // precise route param type from the literal path.
  const doc = await findProduct(req.params.id as string)
  const { altPt, altEn } = altSchema.parse(req.body ?? {})
  const webp = await toWebp(req.file.buffer)
  const key = `products/${doc._id}/${randomUUID()}.webp`
  await putObject(key, webp)
  const alt = { pt: altPt ?? '', en: altEn ?? '' }
  doc.photos.push({ r2Key: key, alt })
  await doc.save()
  res.status(201).json({ product: toPublicProduct(doc) })
})

adminProductsRouter.delete('/api/admin/products/:id/photos', async (req, res) => {
  const key = String(req.query.key ?? '')
  const doc = await findProduct(req.params.id)
  if (!doc.photos.some((p) => p.r2Key === key)) throw new AppError(404, 'PHOTO_NOT_FOUND', 'Photo not found on this product')
  await deleteObject(key)
  doc.photos = doc.photos.filter((p) => p.r2Key !== key) as typeof doc.photos
  await doc.save()
  res.json({ product: toPublicProduct(doc) })
})
