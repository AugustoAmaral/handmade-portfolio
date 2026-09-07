import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  MONGO_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(1),
  WEB_ORIGIN: z.string().url(),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
})
export type Env = z.infer<typeof envSchema>

let cached: Env | undefined
export function getEnv(): Env {
  cached ??= envSchema.parse(process.env)
  return cached
}
