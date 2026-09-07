// One-shot: run once against production after deploying v2.
//   MONGO_URL=... npm run migrate:v2 -w @shop/api
import mongoose from 'mongoose'
import { runMigration } from './lib/migrate-v2.js'

const url = process.env.MONGO_URL
if (!url) {
  console.error('MONGO_URL is required')
  process.exit(1)
}

await mongoose.connect(url)
const migrated = await runMigration()
console.log(`migrated ${migrated} v1 order(s)`)
await mongoose.disconnect()
