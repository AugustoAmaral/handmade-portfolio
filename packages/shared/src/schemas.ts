import { z } from 'zod'
import { MAX_SPECS, MIN_PRICE_CENTS } from './limits.js'

export const localizedTextSchema = z.object({ pt: z.string().min(1), en: z.string().min(1) })
export type LocalizedText = z.infer<typeof localizedTextSchema>

// Same shape, but empty strings allowed (subtitle, photo alt).
export const optionalLocalizedTextSchema = z.object({ pt: z.string().max(200), en: z.string().max(200) })

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

export const specSchema = z.object({ key: localizedTextSchema, value: localizedTextSchema })
export type ProductSpec = z.infer<typeof specSchema>

export const productInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: localizedTextSchema,
  description: localizedTextSchema,
  subtitle: optionalLocalizedTextSchema.default({ pt: '', en: '' }),
  priceCents: z.number().int().min(MIN_PRICE_CENTS),
  type: z.enum(['physical', 'digital']),
  stock: z.number().int().min(0).nullable(),
  specs: z.array(specSchema).max(MAX_SPECS).default([]),
  featured: z.boolean().default(false),
  active: z.boolean(),
})
/** What clients send: the v2 fields are optional (defaults apply on parse). */
export type ProductInput = z.input<typeof productInputSchema>
/** What `productInputSchema.parse` returns: every field present. */
export type ParsedProductInput = z.output<typeof productInputSchema>

// PUT may also reorder photos and edit their alt text. Keys must be the product's existing R2 keys.
export const productUpdateSchema = productInputSchema.extend({
  photos: z.array(z.object({ key: z.string().min(1), alt: optionalLocalizedTextSchema.optional() })).optional(),
})
export type ProductUpdateInput = z.input<typeof productUpdateSchema>

export interface ProductPhoto {
  key: string
  url: string
  alt: { pt: string; en: string }
}

export interface PublicProduct {
  id: string
  slug: string
  name: LocalizedText
  description: LocalizedText
  subtitle: { pt: string; en: string }
  priceCents: number
  type: 'physical' | 'digital'
  stock: number | null
  specs: ProductSpec[]
  photos: ProductPhoto[]
  featured: boolean
  active: boolean
}
