import { z } from 'zod'
import { CART_MAX_DISTINCT, CART_MAX_QTY } from './shipping.js'

export const localizedTextSchema = z.object({ pt: z.string().min(1), en: z.string().min(1) })
export type LocalizedText = z.infer<typeof localizedTextSchema>

export const cartItemSchema = z.object({
  slug: z.string().min(1),
  qty: z.number().int().min(1).max(CART_MAX_QTY),
})

export const checkoutRequestSchema = z.object({
  items: z
    .array(cartItemSchema)
    .min(1)
    .max(CART_MAX_DISTINCT)
    .refine((items) => new Set(items.map((i) => i.slug)).size === items.length, {
      message: 'Duplicate items in cart',
    }),
  destination: z.enum(['BR', 'INTL']),
  locale: z.enum(['pt', 'en']),
})
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>
export type Destination = CheckoutRequest['destination']

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
