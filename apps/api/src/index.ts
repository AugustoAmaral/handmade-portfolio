import mongoose from 'mongoose'
import { createApp } from './app.js'
import { getEnv } from './env.js'

const env = getEnv()
await mongoose.connect(env.MONGO_URL)
createApp().listen(env.PORT, () => {
  console.log(`api listening on :${env.PORT}`)
})
