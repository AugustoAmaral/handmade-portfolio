import mongoose from 'mongoose'
import { createApp } from './app.js'
import { getEnv } from './env.js'
import { Order } from './models/order.js'
import { Product } from './models/product.js'

const env = getEnv()
await mongoose.connect(env.MONGO_URL)
// Make sure the unique indexes (webhook idempotency gate on Order, slug uniqueness on
// Product) are actually built before we start serving traffic, not lazily in the background.
await Order.init()
await Product.init()
createApp().listen(env.PORT, () => {
  console.log(`api listening on :${env.PORT}`)
})
