import cors from 'cors'
import express from 'express'
import { getEnv } from './env.js'
import { errorHandler, notFoundHandler } from './errors.js'
import { productsRouter } from './routes/products.js'

export function createApp() {
  const app = express()
  app.use(cors({ origin: getEnv().WEB_ORIGIN }))
  // NOTE: the Stripe webhook route (Task 5) mounts BEFORE express.json() — it needs the raw body.
  app.use(express.json())
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use(productsRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
