import { type CheckoutRequest, type FieldErrors, type TotalsLine, checkoutRules } from '@shop/shared'
import { drawing, letter } from './products'

const buyer: CheckoutRequest['buyer'] = {
  name: 'Marina Bicalho',
  email: 'marina@example.com',
  phone: '+55 31 98812-4407',
}

export const emptyCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }],
  locale: 'pt',
  buyer: { name: '', email: '' },
}

export const brCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }, { slug: drawing.slug, qty: 2 }],
  locale: 'pt',
  buyer,
  shippingAddress: {
    country: 'BR',
    postalCode: '30150-904',
    street: 'Rua Sapucaí',
    number: '388',
    complement: 'ap. 51',
    district: 'Floresta',
    city: 'Belo Horizonte',
    state: 'MG',
  },
  shippingMethod: 'sedex',
  notes: 'É presente, capricha no embrulho.',
}

export const intlCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }],
  locale: 'en',
  buyer: { name: 'Sam Reyes', email: 'sam@example.com' },
  shippingAddress: {
    country: 'US',
    postalCode: '10001',
    street: '350 5th Ave',
    city: 'New York',
    state: 'NY',
  },
  shippingMethod: 'intl',
}

export const digitalCheckout: CheckoutRequest = {
  items: [{ slug: 'carta-digital', qty: 1 }],
  locale: 'pt',
  buyer,
}

/**
 * An incomplete Brazilian address, kept next to the errors it produces so the two cannot drift.
 */
export const incompleteBrCheckout: CheckoutRequest = {
  ...brCheckout,
  shippingAddress: {
    country: 'BR',
    postalCode: '3015',
    street: 'Rua Sapucaí',
    number: '',
    city: 'Belo Horizonte',
    state: '',
  },
  shippingMethod: undefined,
}

// Narrowed rather than cast: `checkoutRules` returns `FieldErrors | null`, and `as FieldErrors`
// would turn a future valid `incompleteBrCheckout` into a `null` wearing the wrong type, which
// surfaces as a confusing TypeError inside whichever story reads a key off it.
const derivedBrCheckoutErrors = checkoutRules(incompleteBrCheckout, true)
if (!derivedBrCheckoutErrors) {
  throw new Error('incompleteBrCheckout must violate the BR rules: brCheckoutErrors is derived from them')
}

/**
 * What the checkout page actually receives from the API after submitting that address. DERIVED
 * from the real rules rather than written by hand: `apps/api/src/routes/checkout.ts:36-37` passes
 * `checkoutRules(...)` straight into the 400 response, so this object's shape is that function's
 * output and nothing else — in particular it never carries `buyer.*` keys, which zod rejects
 * earlier and separately.
 */
export const brCheckoutErrors: FieldErrors = derivedBrCheckoutErrors

export const cartLines: TotalsLine[] = [
  { priceCents: letter.priceCents, qty: 1, type: 'physical' },
  { priceCents: drawing.priceCents, qty: 2, type: 'physical' },
]
