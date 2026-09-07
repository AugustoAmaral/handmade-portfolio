// E2e/dev boot: in-memory Mongo, seeded, fixed admin credentials. NEVER deployed.
import bcrypt from 'bcryptjs'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

process.env.PORT ??= '3001'
// In CI an absent secret arrives as '' — treat empty as unset so ??= applies.
if (!process.env.STRIPE_SECRET_KEY) delete process.env.STRIPE_SECRET_KEY
process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_dummy'
process.env.JWT_SECRET ??= 'e2e-secret'
process.env.ADMIN_EMAIL ??= 'admin@example.com'
process.env.ADMIN_PASSWORD_HASH ??= bcrypt.hashSync('admin123', 10)
process.env.WEB_ORIGIN ??= 'http://localhost:5173'
process.env.R2_ACCOUNT_ID ??= 'e2e'
process.env.R2_ACCESS_KEY_ID ??= 'e2e'
process.env.R2_SECRET_ACCESS_KEY ??= 'e2e'
process.env.R2_BUCKET ??= 'e2e'
process.env.R2_PUBLIC_URL ??= 'https://img.example.com'

const mongod = await MongoMemoryServer.create()
process.env.MONGO_URL = mongod.getUri()

const { createApp } = await import('./app.js')
const { seedProducts } = await import('./seed.js')

await mongoose.connect(process.env.MONGO_URL)
await seedProducts()
createApp().listen(Number(process.env.PORT), () => {
  console.log(`e2e api on :${process.env.PORT}`)
})
