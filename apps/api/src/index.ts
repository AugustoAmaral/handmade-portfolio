import mongoose from 'mongoose'
import { createApp } from './app.js'
import { getEnv } from './env.js'
import { Order } from './models/order.js'
import { Product } from './models/product.js'

const env = getEnv()
await mongoose.connect(env.MONGO_URL)
// Make sure the unique indexes (webhook idempotency gate on Order, slug uniqueness on
// Product) are actually built before we start serving traffic, not lazily in the background.
// syncIndexes (not init) because v1 left a non-sparse unique index on stripeSessionId in
// production; init() would refuse to change its options, syncIndexes drops and recreates it.
await Order.syncIndexes()
await Product.syncIndexes()
createApp().listen(env.PORT, () => {
  console.log(`api listening on :${env.PORT}`)
})
