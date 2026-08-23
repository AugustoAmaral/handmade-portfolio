import { randomUUID } from 'node:crypto'
import { productInputSchema } from '@shop/shared'
import { Router } from 'express'
import multer from 'multer'
import { AppError } from '../../errors.js'
import { toWebp } from '../../lib/images.js'
import { deleteObject, putObject } from '../../lib/r2.js'
import { Product, toPublicProduct } from '../../models/product.js'
import { adminGuard } from '../../middleware/auth.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

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
  const input = productInputSchema.parse(req.body)
  const doc = await findProduct(req.params.id)
  doc.set(input)
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
  const webp = await toWebp(req.file.buffer)
  const key = `products/${doc._id}/${randomUUID()}.webp`
  await putObject(key, webp)
  doc.photos.push({ r2Key: key })
  await doc.save()
  res.status(201).json({ product: toPublicProduct(doc) })
})

adminProductsRouter.delete('/api/admin/products/:id/photos', async (req, res) => {
  const key = String(req.query.key ?? '')
  const doc = await findProduct(req.params.id)
  await deleteObject(key)
  doc.photos = doc.photos.filter((p) => p.r2Key !== key) as typeof doc.photos
  await doc.save()
  res.json({ product: toPublicProduct(doc) })
})
