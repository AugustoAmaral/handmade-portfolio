import { z } from 'zod'
import {
  CART_MAX_DISTINCT,
  CART_MAX_QTY,
  SHIPPING_METHOD_IDS,
  isAllowedCountry,
  shippingOptionsFor,
} from './shipping.js'

export const cartItemSchema = z.object({
  slug: z.string().min(1),
  qty: z.number().int().min(1).max(CART_MAX_QTY),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const buyerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
})
export type Buyer = z.infer<typeof buyerSchema>

export const shippingAddressSchema = z.object({
  country: z.string().trim().toUpperCase().length(2),
  postalCode: z.string().trim().min(3).max(12),
  street: z.string().trim().min(1).max(160),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).optional(),
})
export type ShippingAddress = z.infer<typeof shippingAddressSchema>

export const shippingMethodSchema = z.enum(SHIPPING_METHOD_IDS)

export const checkoutRequestSchema = z.object({
  items: z
    .array(cartItemSchema)
    .min(1)
    .max(CART_MAX_DISTINCT)
    .refine((items) => new Set(items.map((i) => i.slug)).size === items.length, {
      message: 'Duplicate items in cart',
    }),
  locale: z.enum(['pt', 'en']),
  buyer: buyerSchema,
  shippingAddress: shippingAddressSchema.optional(),
  shippingMethod: shippingMethodSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  giftMessage: z.string().trim().max(200).optional(),
  referral: z.string().trim().max(100).optional(),
})
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

export type FieldErrors = Record<string, string[]>

const BR_POSTAL_CODE = /^\d{5}-?\d{3}$/
const BR_STATE = /^[A-Za-z]{2}$/

// Cross-field rules that depend on the cart's contents (physical vs digital). Pure and shared:
// the API runs it after loading products, the web runs it against the loaded catalog, so both
// sides reject exactly the same requests. Messages are stable codes the web translates.
export function checkoutRules(
  req: Pick<CheckoutRequest, 'shippingAddress' | 'shippingMethod'>,
  hasPhysical: boolean,
): FieldErrors | null {
  if (!hasPhysical) return null
  const errors: FieldErrors = {}
  const address = req.shippingAddress

  if (!address) {
    errors['shippingAddress'] = ['required']
  } else {
    if (!isAllowedCountry(address.country)) errors['shippingAddress.country'] = ['not_allowed']
    if (address.country === 'BR') {
      if (!BR_POSTAL_CODE.test(address.postalCode)) errors['shippingAddress.postalCode'] = ['invalid_cep']
      if (!address.number) errors['shippingAddress.number'] = ['required']
      if (!address.district) errors['shippingAddress.district'] = ['required']
      if (!address.state || !BR_STATE.test(address.state)) errors['shippingAddress.state'] = ['invalid_state']
    }
  }

  if (!req.shippingMethod) {
    errors['shippingMethod'] = ['required']
  } else if (address && !shippingOptionsFor(address.country).some((o) => o.id === req.shippingMethod)) {
    errors['shippingMethod'] = ['not_available']
  }

  return Object.keys(errors).length > 0 ? errors : null
}
