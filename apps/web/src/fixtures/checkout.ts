import { type CheckoutRequest, type FieldErrors, type TotalsLine, checkoutRequestSchema, checkoutRules } from '@shop/shared'
import { deepFreeze } from './freeze'
import { drawing, letter } from './products'

const buyer: CheckoutRequest['buyer'] = {
  name: 'Marina Bicalho',
  email: 'marina@example.com',
  phone: '+55 31 98812-4407',
}

/**
 * Initial form state, deliberately NOT schema-valid: it is typed `CheckoutRequest` for the form's
 * benefit but fails `checkoutRequestSchema` on the empty name and email. Never feed it to
 * `.parse` — render it, fill it in, then parse.
 */
export const emptyCheckout: CheckoutRequest = deepFreeze({
  items: [{ slug: letter.slug, qty: 1 }],
  locale: 'pt',
  buyer: { name: '', email: '' },
})

export const brCheckout: CheckoutRequest = deepFreeze({
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
})

export const intlCheckout: CheckoutRequest = deepFreeze({
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
})

export const digitalCheckout: CheckoutRequest = deepFreeze({
  items: [{ slug: 'carta-digital', qty: 1 }],
  locale: 'pt',
  buyer,
})

/**
 * An incomplete Brazilian address, kept next to the errors it produces so the two cannot drift.
 */
export const incompleteBrCheckout: CheckoutRequest = deepFreeze({
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
})

// Narrowed rather than cast: `checkoutRules` returns `FieldErrors | null`, and `as FieldErrors`
// would turn a future non-violating input into a null wearing the wrong type, surfacing as an
// obscure TypeError inside whichever story reads a key off it.
const derivedBrCheckoutErrors = checkoutRules(incompleteBrCheckout, true)
if (!derivedBrCheckoutErrors) {
  throw new Error('incompleteBrCheckout must violate the BR rules: brCheckoutErrors is derived from them')
}

/**
 * The cross-field-rule half of what the checkout page can receive. DERIVED from the real rules
 * rather than written by hand: `apps/api/src/routes/checkout.ts:36-37` passes `checkoutRules(...)`
 * straight into the 400 response, so this object's shape is that function's output and nothing
 * else. It carries no `buyer.*` key — not because the page can never receive one, but because the
 * rules never produce one; see `buyerCheckoutErrors` for the other half.
 */
export const brCheckoutErrors: FieldErrors = deepFreeze(derivedBrCheckoutErrors)

// The OTHER shape the page can receive, derived the same way rather than hand-written.
// `apps/api/src/errors.ts:26-33` turns a ZodError into `fieldErrors` keyed by
// `issue.path.join('.')` — the SAME response field and the SAME key shape as the rules produce,
// so `{ 'buyer.name': [...] }` is a payload the checkout page really does get. What never happens
// is the two arriving MIXED: the parse at `routes/checkout.ts:21` runs before the rules at :36,
// so a request with a bad buyer is rejected before `checkoutRules` is ever called.
const buyerParse = checkoutRequestSchema.safeParse(emptyCheckout)
if (buyerParse.success) {
  throw new Error('emptyCheckout must fail the schema: buyerCheckoutErrors is derived from its issues')
}
const zodFieldErrors: FieldErrors = {}
for (const issue of buyerParse.error.issues) {
  const key = issue.path.length ? issue.path.join('.') : '_'
  ;(zodFieldErrors[key] ??= []).push(issue.message)
}

/**
 * NOTE for the checkout UI: the values here are raw English prose straight from zod ("String must
 * contain at least 2 character(s)"), while `brCheckoutErrors` carries stable codes (`invalid_cep`,
 * `required`). A single code-keyed translation table cannot render both, and this shop is
 * bilingual — that is a PR 3/PR 5 decision, flagged here so it is not discovered late.
 */
export const buyerCheckoutErrors: FieldErrors = deepFreeze(zodFieldErrors)

export const cartLines: TotalsLine[] = deepFreeze([
  { priceCents: letter.priceCents, qty: 1, type: 'physical' },
  { priceCents: drawing.priceCents, qty: 2, type: 'physical' },
])
