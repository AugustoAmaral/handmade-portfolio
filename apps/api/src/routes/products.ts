import { Router } from 'express'
import { AppError } from '../errors.js'
import { Product, toPublicProduct } from '../models/product.js'

export const productsRouter = Router()

productsRouter.get('/api/products', async (_req, res) => {
  const docs = await Product.find({ active: true }).sort({ createdAt: 1 })
  res.json({ products: docs.map(toPublicProduct) })
})

productsRouter.get('/api/products/:slug', async (req, res) => {
  const doc = await Product.findOne({ slug: req.params.slug, active: true })
  if (!doc) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  res.json({ product: toPublicProduct(doc) })
})
