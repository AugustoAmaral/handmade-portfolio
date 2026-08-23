import cors from 'cors'
import express from 'express'
import { getEnv } from './env.js'
import { errorHandler, notFoundHandler } from './errors.js'
import { adminAuthRouter } from './routes/admin/auth.js'
import { adminOrdersRouter } from './routes/admin/orders.js'
import { adminProductsRouter } from './routes/admin/products.js'
import { checkoutRouter } from './routes/checkout.js'
import { ordersRouter } from './routes/orders.js'
import { productsRouter } from './routes/products.js'
import { webhookRouter } from './routes/webhook.js'

export function createApp() {
  const app = express()
  app.use(cors({ origin: getEnv().WEB_ORIGIN }))
  // The Stripe webhook route needs the raw body for signature verification, so it must
  // mount BEFORE express.json().
  app.use(webhookRouter)
  app.use(express.json())
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use(adminAuthRouter)
  app.use(adminOrdersRouter)
  app.use(adminProductsRouter)
  app.use(productsRouter)
  app.use(checkoutRouter)
  app.use(ordersRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
