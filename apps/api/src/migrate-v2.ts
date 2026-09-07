// One-shot: run once against production after deploying v2.
//   MONGO_URL=... npm run migrate:v2 -w @shop/api
import mongoose from 'mongoose'
import { getEnv } from './env.js'
import { runMigration } from './lib/migrate-v2.js'

await mongoose.connect(getEnv().MONGO_URL)
const migrated = await runMigration()
console.log(`migrated ${migrated} v1 order(s)`)
await mongoose.disconnect()
