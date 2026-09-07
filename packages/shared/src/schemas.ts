import { z } from 'zod'

export const localizedTextSchema = z.object({ pt: z.string().min(1), en: z.string().min(1) })
export type LocalizedText = z.infer<typeof localizedTextSchema>

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

export const productInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: localizedTextSchema,
  description: localizedTextSchema,
  priceCents: z.number().int().min(100),
  type: z.enum(['physical', 'digital']),
  stock: z.number().int().min(0).nullable(),
  active: z.boolean(),
})
export type ProductInput = z.infer<typeof productInputSchema>

export interface PublicProduct {
  id: string
  slug: string
  name: LocalizedText
  description: LocalizedText
  priceCents: number
  type: 'physical' | 'digital'
  stock: number | null
  photos: { url: string }[]
  active: boolean
}
