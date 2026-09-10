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
      message: 'duplicate_items',
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

/**
 * The one place a rejected parse becomes `fieldErrors`: keyed by `issue.path.join('.')`, with `_`
 * for an issue that has no path (a whole-object refinement such as `duplicate_items`).
 *
 * It lives here, beside the schema it decodes and beside `checkoutRules`, because the API and the
 * browser BOTH run `checkoutRequestSchema` over the same request and both have to land the result
 * on the same field names. It had drifted into three copies before this was written — the express
 * error handler, the checkout container, and the fixture that derives `buyerCheckoutErrors`. The
 * fixture copy was the dangerous one: every error story on the branch renders that object, so a
 * copy that drifted from the API's would have made the stories agree with each other and with
 * nothing else.
 *
 * The parameter is STRUCTURAL rather than `ZodIssue`, so a caller holding a different zod instance
 * still type-checks. Two copies of zod hoisted side by side is the usual way a shared helper
 * quietly stops accepting the errors it exists to convert.
 */
export function fieldErrorsFromIssues(
  issues: readonly { path: readonly (string | number)[]; message: string }[],
): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_'
    ;(errors[key] ??= []).push(issue.message)
  }
  return errors
}

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
