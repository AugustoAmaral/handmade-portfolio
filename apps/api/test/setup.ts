import bcrypt from 'bcryptjs'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll } from 'vitest'

process.env.MONGO_URL = 'set-by-memory-server'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_testsecret'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.ADMIN_EMAIL = 'admin@example.com'
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin123', 10)
process.env.WEB_ORIGIN = 'http://localhost:5173'
process.env.R2_ACCOUNT_ID = 'test-account'
process.env.R2_ACCESS_KEY_ID = 'test-key'
process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
process.env.R2_BUCKET = 'test-bucket'
process.env.R2_PUBLIC_URL = 'https://img.test.local'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGO_URL = mongod.getUri()
  await mongoose.connect(mongod.getUri())
})

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections()
  for (const c of collections) await c.deleteMany({})
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
