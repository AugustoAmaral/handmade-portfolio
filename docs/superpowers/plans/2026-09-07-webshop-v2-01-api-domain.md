# Webshop v2 — PR 1: API domain (`feat/v2-api-domain`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the API's domain for v2: richer products, orders created as `pending` before the Stripe redirect and confirmed by the webhook, Brazil + international shipping methods, sequential order numbers, admin order transitions, and a one-shot migration for v1 data.

**Architecture:** `@shop/shared` gains the pure domain (shipping methods, totals, checkout schema + cross-field rules, order vocabulary) so the API and the future web validate identically. The API keeps Express 5 + Mongoose 8 + Stripe-hosted Checkout; `POST /api/checkout` now persists a `pending` order and stores the Stripe session id on it, and the webhook flips `pending → paid` atomically instead of inserting. A pure `buildCheckoutSessionParams` builder isolates the Stripe payload so it is unit-tested without mocks.

**Tech Stack:** TypeScript 5.6, Node 22, Express 5, Mongoose 8.24, Stripe SDK 18.5, zod 3.25, vitest 3 + supertest + mongodb-memory-server.

**Spec:** `docs/superpowers/specs/2026-09-07-webshop-v2-design.md` (sections "Backend", "Delivery: stacked PRs"). This plan is PR 1 of 5; PRs 2–5 get their own plans when they start.

## Global Constraints

- Branch `feat/v2-api-domain` is created from `docs/v2-design` (PR 0) and its PR targets `docs/v2-design`.
- The v1 web app (`apps/web`) is **not touched** in this PR except the e2e skip in Task 16; it is wiped in PR 2. Therefore every export the v1 web imports from `@shop/shared` must keep existing and keep its type compatible: `SHIPPING_BR_CENTS` (1500), `SHIPPING_INTL_CENTS` (6000), `CART_MAX_DISTINCT`, `CART_MAX_QTY`, `formatPrice`, `LocalizedText`, `PublicProduct` (superset only), `ProductInput` (new fields optional).
- `@shop/api` consumes `@shop/shared` from `packages/shared/dist`. After any change under `packages/shared/src`, run `npm run build -w @shop/shared` before running API tests.
- Run vitest with the machine guardrail: `NODE_OPTIONS=--max-old-space-size=4096`, and the workspace scripts already pass `--pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2`. After an API test run, check for orphan workers: `ps ax -o pid,ppid,command | grep -i vitest | grep -v grep` — any worker with `ppid 1` must be killed (`kill <pid>`; they are yours).
- Prices are integers in BRL cents everywhere in shared and API. Currency literal is `'brl'`.
- Order statuses: `pending | paid | shipped | oversold | expired`. Order numbers display as `#MHP-0413` (prefix `MHP`, zero-padded to 4).
- Shipping placeholders (cents): `pac` 2200, `sedex` 4100, `intl` 6000. ETAs: pac `8 a 12 dias úteis` / `8–12 business days`; sedex `3 a 5 dias úteis` / `3–5 business days`; intl `2 a 6 semanas` / `2–6 weeks`.
- Stripe session: **no** `shipping_address_collection`, **no** `shipping_options`. Shipping is one extra line item; the address goes in `payment_intent_data.shipping`.
- Error contract unchanged: `{ error: { code, message, fieldErrors? } }`. New codes: `STRIPE_UNAVAILABLE` (502), `INVALID_TRANSITION` (409). `fieldErrors` keys are dotted paths (`buyer.email`, `shippingAddress.postalCode`); rule messages are stable snake_case codes (`required`, `invalid_cep`, `invalid_state`, `not_allowed`, `not_available`).
- Commits: English, imperative, no trailers (no `Co-Authored-By`). Commit after every task at minimum.
- Code, comments and tests in English.

---

## File map

**`packages/shared/src/`**
- `shipping.ts` (modify) — cart limits, `INTL_ALLOWED_COUNTRIES`, `SHIPPING_METHODS`, `shippingOptionsFor`, `isAllowedCountry`, deprecated v1 constants.
- `totals.ts` (create) — `computeTotals`, `hasPhysicalItems`.
- `checkout.ts` (create) — `cartItemSchema`, `buyerSchema`, `shippingAddressSchema`, `checkoutRequestSchema`, `checkoutRules`, `FieldErrors`.
- `schemas.ts` (modify) — localized text schemas, `loginSchema`, `productInputSchema` (+subtitle/specs/featured), `productUpdateSchema` (+photos), `PublicProduct`, `ProductPhoto`, `ProductSpec`. The v1 checkout schema moves out of this file.
- `orders.ts` (create) — `ORDER_STATUSES`, `OrderStatus`, `formatOrderNumber`, `canTransition`, `PublicOrder`, `AdminOrder` and item/amount types.
- `index.ts` (modify) — re-export everything.

**`apps/api/src/`**
- `models/product.ts` (modify) — new fields, `toPublicProduct` with `key`/`alt`.
- `models/counter.ts` (create) — `nextOrderNumber()`.
- `models/order.ts` (rewrite) — v2 schema, `toPublicOrder`, `toAdminOrder`.
- `lib/checkout-session.ts` (create) — `buildCheckoutSessionParams`, `toStripeAddress`.
- `lib/migrate-v2.ts` (create) — `migrateOrderDoc`, `runMigration`.
- `migrate-v2.ts` (create) — CLI runner.
- `routes/checkout.ts` (rewrite), `routes/webhook.ts` (rewrite), `routes/orders.ts` (rewrite), `routes/admin/orders.ts` (rewrite), `routes/admin/products.ts` (modify).
- `errors.ts` (modify) — dotted-path `fieldErrors` for zod errors.
- `index.ts` (modify) — `syncIndexes` on boot.
- `seed.ts` (modify) — subtitles, specs, featured.
- `package.json` (modify) — `migrate:v2` script.

**Tests:** `packages/shared/test/{shipping,totals,checkout,schemas,orders}.test.ts`; `apps/api/test/{models,counter,checkout-session,checkout,webhook,orders,admin-orders,admin-products,migrate-v2}.test.ts`; `e2e/shop.spec.ts` (skip one test).

---

### Task 1: Shared shipping methods

**Files:**
- Modify: `packages/shared/src/shipping.ts`
- Test: `packages/shared/test/shipping.test.ts`

**Interfaces:**
- Produces: `ShippingMethod = 'pac' | 'sedex' | 'intl'`, `SHIPPING_METHOD_IDS` (readonly tuple), `ShippingMethodInfo { id, cents, scope: 'BR' | 'INTL', name: {pt,en}, eta: {pt,en} }`, `SHIPPING_METHODS: Record<ShippingMethod, ShippingMethodInfo>`, `isAllowedCountry(country: string): boolean`, `shippingOptionsFor(country: string): ShippingMethodInfo[]`. Keeps `CART_MAX_DISTINCT`, `CART_MAX_QTY`, `INTL_ALLOWED_COUNTRIES`, `SHIPPING_BR_CENTS`, `SHIPPING_INTL_CENTS`.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/augustopereira/dev/handmade-portfolio
git switch docs/v2-design && git pull --ff-only
git switch -c feat/v2-api-domain
```

- [ ] **Step 2: Write the failing test**

Create `packages/shared/test/shipping.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { INTL_ALLOWED_COUNTRIES, SHIPPING_METHODS, isAllowedCountry, shippingOptionsFor } from '../src/shipping'

describe('shipping methods', () => {
  it('offers PAC and SEDEX for Brazil, in that order', () => {
    expect(shippingOptionsFor('BR').map((o) => o.id)).toEqual(['pac', 'sedex'])
  })
  it('offers only the international method for an allowed foreign country', () => {
    expect(shippingOptionsFor('US').map((o) => o.id)).toEqual(['intl'])
    expect(shippingOptionsFor('PT')).toEqual([SHIPPING_METHODS.intl])
  })
  it('offers nothing for a country we do not ship to', () => {
    expect(shippingOptionsFor('KP')).toEqual([])
    expect(isAllowedCountry('KP')).toBe(false)
  })
  it('treats Brazil and every curated country as allowed', () => {
    expect(isAllowedCountry('BR')).toBe(true)
    for (const c of INTL_ALLOWED_COUNTRIES) expect(isAllowedCountry(c)).toBe(true)
  })
  it('carries bilingual names and ETAs and BRL cents for each method', () => {
    for (const m of Object.values(SHIPPING_METHODS)) {
      expect(m.cents).toBeGreaterThan(0)
      expect(Number.isInteger(m.cents)).toBe(true)
      expect(m.name.pt.length).toBeGreaterThan(0)
      expect(m.name.en.length).toBeGreaterThan(0)
      expect(m.eta.pt.length).toBeGreaterThan(0)
      expect(m.eta.en.length).toBeGreaterThan(0)
    }
    expect(SHIPPING_METHODS.pac.scope).toBe('BR')
    expect(SHIPPING_METHODS.intl.scope).toBe('INTL')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /Users/augustopereira/dev/handmade-portfolio && NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/shipping.test.ts`
Expected: FAIL — `shippingOptionsFor` / `SHIPPING_METHODS` are not exported.

- [ ] **Step 4: Implement**

Replace `packages/shared/src/shipping.ts` with:

```ts
export const CART_MAX_DISTINCT = 5
export const CART_MAX_QTY = 5

// Curated list — Correios reaches 200+ countries, this is where Augusto is willing to ship.
export const INTL_ALLOWED_COUNTRIES = [
  'US', 'CA', 'MX', 'AR', 'CL', 'CO', 'UY', 'PY', 'PE',
  'GB', 'IE', 'PT', 'ES', 'FR', 'DE', 'IT', 'NL', 'BE', 'AT', 'CH',
  'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR',
  'AU', 'NZ', 'JP', 'KR', 'SG',
] as const

export const SHIPPING_METHOD_IDS = ['pac', 'sedex', 'intl'] as const
export type ShippingMethod = (typeof SHIPPING_METHOD_IDS)[number]
export type ShippingScope = 'BR' | 'INTL'

export interface ShippingMethodInfo {
  id: ShippingMethod
  cents: number
  scope: ShippingScope
  name: { pt: string; en: string }
  eta: { pt: string; en: string }
}

// Placeholder prices until Augusto runs the Correios simulator (spec: "Open items").
export const SHIPPING_METHODS: Record<ShippingMethod, ShippingMethodInfo> = {
  pac: {
    id: 'pac', cents: 2200, scope: 'BR',
    name: { pt: 'Correios PAC', en: 'Correios PAC' },
    eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' },
  },
  sedex: {
    id: 'sedex', cents: 4100, scope: 'BR',
    name: { pt: 'Correios SEDEX', en: 'Correios SEDEX' },
    eta: { pt: '3 a 5 dias úteis', en: '3–5 business days' },
  },
  intl: {
    id: 'intl', cents: 6000, scope: 'INTL',
    name: { pt: 'Internacional (Correios)', en: 'International (Correios)' },
    eta: { pt: '2 a 6 semanas', en: '2–6 weeks' },
  },
}

export function isAllowedCountry(country: string): boolean {
  return country === 'BR' || (INTL_ALLOWED_COUNTRIES as readonly string[]).includes(country)
}

export function shippingOptionsFor(country: string): ShippingMethodInfo[] {
  if (country === 'BR') return [SHIPPING_METHODS.pac, SHIPPING_METHODS.sedex]
  if (isAllowedCountry(country)) return [SHIPPING_METHODS.intl]
  return []
}

/** @deprecated v1 flat rates, still imported by the v1 web app. Removed in PR 2 together with that app. */
export const SHIPPING_BR_CENTS = 1500
/** @deprecated see SHIPPING_BR_CENTS */
export const SHIPPING_INTL_CENTS = 6000
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/shipping.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/shipping.ts packages/shared/test/shipping.test.ts
git commit -m "feat(shared): shipping methods PAC, SEDEX and international"
```

---

### Task 2: Shared totals

**Files:**
- Create: `packages/shared/src/totals.ts`
- Test: `packages/shared/test/totals.test.ts`

**Interfaces:**
- Consumes: `SHIPPING_METHODS`, `ShippingMethod` (Task 1).
- Produces: `TotalsLine { priceCents: number; qty: number; type: 'physical' | 'digital' }`, `Totals { itemsCents; shippingCents; totalCents }`, `hasPhysicalItems(lines: readonly { type }[]): boolean`, `computeTotals(lines: readonly TotalsLine[], method: ShippingMethod | null): Totals`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/totals.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeTotals, hasPhysicalItems } from '../src/totals'

const letter = { priceCents: 5000, qty: 2, type: 'physical' as const }
const doodle = { priceCents: 1500, qty: 1, type: 'digital' as const }

describe('computeTotals', () => {
  it('sums items and adds the chosen method for a physical cart', () => {
    expect(computeTotals([letter, doodle], 'sedex')).toEqual({ itemsCents: 11500, shippingCents: 4100, totalCents: 15600 })
  })
  it('charges no shipping for a digital-only cart even if a method is passed', () => {
    expect(computeTotals([doodle], 'pac')).toEqual({ itemsCents: 1500, shippingCents: 0, totalCents: 1500 })
  })
  it('charges no shipping when no method is chosen yet', () => {
    expect(computeTotals([letter], null)).toEqual({ itemsCents: 10000, shippingCents: 0, totalCents: 10000 })
  })
  it('returns zeros for an empty cart', () => {
    expect(computeTotals([], 'pac')).toEqual({ itemsCents: 0, shippingCents: 0, totalCents: 0 })
  })
})

describe('hasPhysicalItems', () => {
  it('is true when at least one line is physical', () => {
    expect(hasPhysicalItems([doodle, letter])).toBe(true)
    expect(hasPhysicalItems([doodle])).toBe(false)
    expect(hasPhysicalItems([])).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/totals.test.ts`
Expected: FAIL — cannot find module `../src/totals`.

- [ ] **Step 3: Implement**

Create `packages/shared/src/totals.ts`:

```ts
import { SHIPPING_METHODS, type ShippingMethod } from './shipping.js'

export interface TotalsLine {
  priceCents: number
  qty: number
  type: 'physical' | 'digital'
}

export interface Totals {
  itemsCents: number
  shippingCents: number
  totalCents: number
}

export function hasPhysicalItems(lines: readonly { type: 'physical' | 'digital' }[]): boolean {
  return lines.some((l) => l.type === 'physical')
}

// Display math for the web and the pre-Stripe order snapshot for the API. Never a source of
// prices: callers pass priceCents they loaded from the catalog (web) or from Mongo (API).
export function computeTotals(lines: readonly TotalsLine[], method: ShippingMethod | null): Totals {
  const itemsCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0)
  const shippingCents = method && hasPhysicalItems(lines) ? SHIPPING_METHODS[method].cents : 0
  return { itemsCents, shippingCents, totalCents: itemsCents + shippingCents }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/totals.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/totals.ts packages/shared/test/totals.test.ts
git commit -m "feat(shared): computeTotals and hasPhysicalItems"
```

---

### Task 3: Shared checkout request schema and cross-field rules

**Files:**
- Create: `packages/shared/src/checkout.ts`
- Modify: `packages/shared/src/schemas.ts` (remove the v1 `cartItemSchema`, `checkoutRequestSchema`, `CheckoutRequest`, `Destination`)
- Modify: `packages/shared/src/index.ts`
- Delete: `packages/shared/test/schemas.test.ts` (its content is replaced by Task 3's and Task 4's tests)
- Test: `packages/shared/test/checkout.test.ts`

**Interfaces:**
- Consumes: `CART_MAX_DISTINCT`, `CART_MAX_QTY`, `SHIPPING_METHOD_IDS`, `isAllowedCountry`, `shippingOptionsFor` (Task 1).
- Produces: `cartItemSchema`, `CartItem`, `buyerSchema`, `Buyer { name; email; phone? }`, `shippingAddressSchema`, `ShippingAddress { country; postalCode; street; number?; complement?; district?; city; state? }`, `shippingMethodSchema`, `checkoutRequestSchema`, `CheckoutRequest`, `FieldErrors = Record<string, string[]>`, `checkoutRules(req: Pick<CheckoutRequest, 'shippingAddress' | 'shippingMethod'>, hasPhysical: boolean): FieldErrors | null`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/checkout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { checkoutRequestSchema, checkoutRules } from '../src/checkout'

const buyer = { name: 'Marina Bicalho', email: 'marina@example.com' }
const brAddress = {
  country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388', complement: 'ap. 51',
  district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
}
const usAddress = { country: 'US', postalCode: '10001', street: '350 5th Ave', city: 'New York', state: 'NY' }
const base = { items: [{ slug: 'letter', qty: 1 }], locale: 'pt', buyer }

describe('checkoutRequestSchema', () => {
  it('accepts a minimal digital-only request', () => {
    const parsed = checkoutRequestSchema.parse(base)
    expect(parsed.buyer.email).toBe('marina@example.com')
    expect(parsed.shippingAddress).toBeUndefined()
  })
  it('accepts a full physical request and uppercases the country', () => {
    const parsed = checkoutRequestSchema.parse({
      ...base, shippingAddress: { ...brAddress, country: 'br' }, shippingMethod: 'pac',
      notes: 'For my grandmother', giftMessage: 'Happy 80th', referral: 'Twitter',
    })
    expect(parsed.shippingAddress!.country).toBe('BR')
    expect(parsed.shippingMethod).toBe('pac')
  })
  it('rejects qty over 5, more than 5 distinct items and duplicate slugs', () => {
    expect(() => checkoutRequestSchema.parse({ ...base, items: [{ slug: 'letter', qty: 6 }] })).toThrow()
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => ({ slug, qty: 1 }))
    expect(() => checkoutRequestSchema.parse({ ...base, items: six })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, items: [{ slug: 'a', qty: 1 }, { slug: 'a', qty: 2 }] })).toThrow()
  })
  it('rejects a bad e-mail, a one-letter name, an unknown method and oversized notes', () => {
    expect(() => checkoutRequestSchema.parse({ ...base, buyer: { ...buyer, email: 'nope' } })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, buyer: { ...buyer, name: 'M' } })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, shippingMethod: 'drone' })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, notes: 'x'.repeat(1001) })).toThrow()
  })
  it('does not allow CPF or any unknown buyer field to sneak in', () => {
    const parsed = checkoutRequestSchema.parse({ ...base, buyer: { ...buyer, cpf: '000' } })
    expect((parsed.buyer as Record<string, unknown>).cpf).toBeUndefined()
  })
})

describe('checkoutRules', () => {
  it('has no rules for a digital-only cart', () => {
    expect(checkoutRules({}, false)).toBeNull()
    expect(checkoutRules({ shippingAddress: usAddress, shippingMethod: 'pac' }, false)).toBeNull()
  })
  it('requires address and method for a physical cart', () => {
    expect(checkoutRules({}, true)).toEqual({ shippingAddress: ['required'], shippingMethod: ['required'] })
  })
  it('accepts a valid Brazilian address with PAC or SEDEX', () => {
    expect(checkoutRules({ shippingAddress: brAddress, shippingMethod: 'pac' }, true)).toBeNull()
    expect(checkoutRules({ shippingAddress: brAddress, shippingMethod: 'sedex' }, true)).toBeNull()
  })
  it('enforces CEP, number, district and 2-letter state for Brazil', () => {
    const errors = checkoutRules({
      shippingAddress: { ...brAddress, postalCode: '123', number: undefined, district: undefined, state: 'Minas' },
      shippingMethod: 'pac',
    }, true)
    expect(errors).toEqual({
      'shippingAddress.postalCode': ['invalid_cep'],
      'shippingAddress.number': ['required'],
      'shippingAddress.district': ['required'],
      'shippingAddress.state': ['invalid_state'],
    })
  })
  it('accepts CEP with or without the dash', () => {
    expect(checkoutRules({ shippingAddress: { ...brAddress, postalCode: '30150904' }, shippingMethod: 'pac' }, true)).toBeNull()
  })
  it('rejects a Brazilian method for a foreign address and vice versa', () => {
    expect(checkoutRules({ shippingAddress: usAddress, shippingMethod: 'sedex' }, true)).toEqual({ shippingMethod: ['not_available'] })
    expect(checkoutRules({ shippingAddress: brAddress, shippingMethod: 'intl' }, true)).toEqual({ shippingMethod: ['not_available'] })
  })
  it('accepts the international method for an allowed country', () => {
    expect(checkoutRules({ shippingAddress: usAddress, shippingMethod: 'intl' }, true)).toBeNull()
  })
  it('rejects a country we do not ship to', () => {
    const errors = checkoutRules({ shippingAddress: { ...usAddress, country: 'KP' }, shippingMethod: 'intl' }, true)
    expect(errors).toEqual({ 'shippingAddress.country': ['not_allowed'], shippingMethod: ['not_available'] })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/checkout.test.ts`
Expected: FAIL — cannot find module `../src/checkout`.

- [ ] **Step 3: Implement the checkout module**

Create `packages/shared/src/checkout.ts`:

```ts
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
```

- [ ] **Step 4: Remove the v1 checkout schema from `schemas.ts` and re-export**

Replace `packages/shared/src/schemas.ts` with (product parts are extended in Task 4; this step only removes the v1 checkout pieces):

```ts
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
```

Replace `packages/shared/src/index.ts` with:

```ts
export * from './checkout.js'
export * from './money.js'
export * from './schemas.js'
export * from './shipping.js'
export * from './totals.js'
```

Delete the v1 test that covered the old checkout schema:

```bash
git rm packages/shared/test/schemas.test.ts
```

- [ ] **Step 5: Run the shared suite to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared`
Expected: PASS — shipping, totals, checkout and money tests.

- [ ] **Step 6: Build shared and typecheck the whole repo**

Run: `npm run build -w @shop/shared && npm run typecheck`
Expected: `@shop/api` fails to compile (`routes/checkout.ts` imports `checkoutRequestSchema` and destructures `destination`, which no longer exists) — that is expected and is fixed in Task 10. `@shop/web` must typecheck clean (it never imported the checkout schema). If `@shop/web` fails, stop: something the v1 web relies on was removed.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/checkout.ts packages/shared/src/schemas.ts packages/shared/src/index.ts
git commit -m "feat(shared): v2 checkout request schema and cross-field rules"
```

---

### Task 4: Shared product schema extensions

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Test: `packages/shared/test/schemas.test.ts` (new content)

**Interfaces:**
- Produces: `optionalLocalizedTextSchema`, `specSchema`, `ProductSpec { key: LocalizedText; value: LocalizedText }`, `productInputSchema` (+ `subtitle` default `{pt:'',en:''}`, `specs` default `[]`, `featured` default `false`), `ProductInput = z.input<...>` (new fields optional — the v1 web's `ProductForm` state still typechecks), `ParsedProductInput = z.output<...>`, `productUpdateSchema = productInputSchema.extend({ photos?: [{ key, alt? }] })`, `ProductUpdateInput`, `ProductPhoto { key; url; alt: {pt,en} }`, `PublicProduct` (+ `subtitle`, `specs`, `featured`, `photos: ProductPhoto[]`).

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { productInputSchema, productUpdateSchema } from '../src/schemas'

const minimal = {
  slug: 'letter',
  name: { pt: 'Carta', en: 'Letter' },
  description: { pt: 'd', en: 'd' },
  priceCents: 5000,
  type: 'physical',
  stock: null,
  active: true,
}

describe('productInputSchema', () => {
  it('defaults subtitle, specs and featured so v1 payloads still parse', () => {
    expect(productInputSchema.parse(minimal)).toEqual({
      ...minimal,
      subtitle: { pt: '', en: '' },
      specs: [],
      featured: false,
    })
  })
  it('accepts subtitle, specs and featured', () => {
    const parsed = productInputSchema.parse({
      ...minimal,
      subtitle: { pt: 'Papel algodão · 2 folhas', en: 'Cotton paper · 2 sheets' },
      specs: [{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }],
      featured: true,
    })
    expect(parsed.specs).toHaveLength(1)
    expect(parsed.featured).toBe(true)
  })
  it('rejects a spec row missing a language and more than 12 rows', () => {
    expect(() =>
      productInputSchema.parse({ ...minimal, specs: [{ key: { pt: 'Formato', en: '' }, value: { pt: 'A5', en: 'A5' } }] }),
    ).toThrow()
    const rows = Array.from({ length: 13 }, () => ({ key: { pt: 'k', en: 'k' }, value: { pt: 'v', en: 'v' } }))
    expect(() => productInputSchema.parse({ ...minimal, specs: rows })).toThrow()
  })
  it('keeps the v1 constraints (slug charset, min price, non-negative stock)', () => {
    expect(() => productInputSchema.parse({ ...minimal, slug: 'Bad Slug' })).toThrow()
    expect(() => productInputSchema.parse({ ...minimal, priceCents: 50 })).toThrow()
    expect(() => productInputSchema.parse({ ...minimal, stock: -1 })).toThrow()
  })
})

describe('productUpdateSchema', () => {
  it('accepts an optional photos list with key and optional alt', () => {
    const parsed = productUpdateSchema.parse({
      ...minimal,
      photos: [{ key: 'products/1/a.webp', alt: { pt: 'Carta', en: 'Letter' } }, { key: 'products/1/b.webp' }],
    })
    expect(parsed.photos).toHaveLength(2)
    expect(parsed.photos![1]!.alt).toBeUndefined()
  })
  it('rejects a photo entry without key', () => {
    expect(() => productUpdateSchema.parse({ ...minimal, photos: [{ alt: { pt: 'x', en: 'x' } }] })).toThrow()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/schemas.test.ts`
Expected: FAIL — `productUpdateSchema` not exported; defaults missing.

- [ ] **Step 3: Implement**

Replace `packages/shared/src/schemas.ts` with:

```ts
import { z } from 'zod'

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
  priceCents: z.number().int().min(100),
  type: z.enum(['physical', 'digital']),
  stock: z.number().int().min(0).nullable(),
  specs: z.array(specSchema).max(12).default([]),
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
```

- [ ] **Step 4: Run the test, build, typecheck the v1 web**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/schemas.test.ts && npm run build -w @shop/shared && npm run typecheck -w @shop/web`
Expected: shared test PASS (6 tests); `@shop/web` typecheck clean (`ProductInput` is the input type, so the v1 form's 7-field state object still fits; `PublicProduct.photos` is a superset).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/test/schemas.test.ts
git commit -m "feat(shared): product subtitle, specs, featured and photo alt schemas"
```

---

### Task 5: Shared order vocabulary and types

**Files:**
- Create: `packages/shared/src/orders.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/orders.test.ts`

**Interfaces:**
- Consumes: `LocalizedText` (Task 4), `Buyer`, `ShippingAddress` (Task 3), `ShippingMethod` (Task 1).
- Produces: `ORDER_STATUSES`, `OrderStatus`, `ORDER_NUMBER_PREFIX = 'MHP'`, `formatOrderNumber(n): string`, `ADMIN_ORDER_TRANSITIONS`, `canTransition(from, to): boolean`, `OrderItemSnapshot`, `OrderAmounts`, `PublicOrder`, `AdminOrder`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/orders.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ORDER_STATUSES, canTransition, formatOrderNumber } from '../src/orders'

describe('orders vocabulary', () => {
  it('formats order numbers zero-padded to four digits with the MHP prefix', () => {
    expect(formatOrderNumber(1)).toBe('#MHP-0001')
    expect(formatOrderNumber(413)).toBe('#MHP-0413')
    expect(formatOrderNumber(12345)).toBe('#MHP-12345')
  })
  it('lists the five statuses', () => {
    expect(ORDER_STATUSES).toEqual(['pending', 'paid', 'shipped', 'oversold', 'expired'])
  })
  it('only allows the admin to ship paid or oversold orders', () => {
    expect(canTransition('paid', 'shipped')).toBe(true)
    expect(canTransition('oversold', 'shipped')).toBe(true)
    expect(canTransition('pending', 'shipped')).toBe(false)
    expect(canTransition('shipped', 'shipped')).toBe(false)
    expect(canTransition('expired', 'shipped')).toBe(false)
    expect(canTransition('paid', 'paid')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared -- test/orders.test.ts`
Expected: FAIL — cannot find module `../src/orders`.

- [ ] **Step 3: Implement**

Create `packages/shared/src/orders.ts`:

```ts
import type { Buyer, ShippingAddress } from './checkout.js'
import type { LocalizedText } from './schemas.js'
import type { ShippingMethod } from './shipping.js'

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'oversold', 'expired'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_NUMBER_PREFIX = 'MHP'
export function formatOrderNumber(n: number): string {
  return `#${ORDER_NUMBER_PREFIX}-${String(n).padStart(4, '0')}`
}

// Admin-driven transitions only. Webhook transitions (pending→paid, pending→expired,
// paid→oversold) are enforced in the API by atomic conditional updates, not by this table.
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: [],
  paid: ['shipped'],
  shipped: [],
  oversold: ['shipped'],
  expired: [],
}
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_ORDER_TRANSITIONS[from].includes(to)
}

export interface OrderItemSnapshot {
  productId: string
  slug: string
  name: LocalizedText
  qty: number
  unitAmountCents: number
}

export interface OrderAmounts {
  itemsCents: number
  shippingCents: number
  totalCents: number
  currency: string
}

/** What the thank-you page sees. No buyer data. */
export interface PublicOrder {
  orderNumber: number
  status: OrderStatus
  items: { name: LocalizedText; qty: number }[]
  totalCents: number
  currency: string
  shippingMethod: ShippingMethod | null
  eta: LocalizedText | null
}

/** What the admin sees. */
export interface AdminOrder {
  id: string
  orderNumber: number
  status: OrderStatus
  createdAt: string
  paidAt?: string
  shippedAt?: string
  buyer: Buyer
  shippingAddress: ShippingAddress | null
  shippingMethod: ShippingMethod | null
  notes?: string
  giftMessage?: string
  referral?: string
  locale: 'pt' | 'en'
  items: OrderItemSnapshot[]
  amounts: OrderAmounts
  trackingCode?: string
  stripeSessionId?: string
  stripePaymentIntentId?: string
}
```

Add the export to `packages/shared/src/index.ts` (keep alphabetical):

```ts
export * from './checkout.js'
export * from './money.js'
export * from './orders.js'
export * from './schemas.js'
export * from './shipping.js'
export * from './totals.js'
```

- [ ] **Step 4: Run the shared suite and build**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/shared && npm run build -w @shop/shared`
Expected: PASS (all shared tests), build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/orders.ts packages/shared/src/index.ts packages/shared/test/orders.test.ts
git commit -m "feat(shared): order statuses, number format, admin transitions and types"
```

---

### Task 6: Product model fields and public serializer

**Files:**
- Modify: `apps/api/src/models/product.ts`
- Test: `apps/api/test/models.test.ts` (product cases), `apps/api/test/products.test.ts`

**Interfaces:**
- Consumes: `PublicProduct`, `ProductPhoto`, `ProductSpec` (Task 4).
- Produces: `Product` model with `subtitle{pt,en}`, `specs[]`, `photos[].alt{pt,en}`, `featured`; `toPublicProduct(doc): PublicProduct` returning `photos[].key`, `photos[].alt`, `subtitle`, `specs`, `featured`.

- [ ] **Step 1: Write the failing tests**

In `apps/api/test/models.test.ts`, replace the product test with these two (leave the Order test alone for now — Task 8 rewrites it):

```ts
  it('serializes a product with public photo URLs, keys, alt text and the v2 fields', async () => {
    const doc = await Product.create({
      slug: 'letter',
      name: { pt: 'Carta', en: 'Letter' },
      description: { pt: 'Uma carta', en: 'A letter' },
      subtitle: { pt: 'Papel algodão', en: 'Cotton paper' },
      priceCents: 5000,
      type: 'physical',
      stock: null,
      specs: [{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }],
      photos: [{ r2Key: 'products/x/1.webp', alt: { pt: 'Carta na mesa', en: 'Letter on a table' } }],
      featured: true,
      active: true,
    })
    const pub = toPublicProduct(doc)
    expect(pub.photos).toEqual([
      { key: 'products/x/1.webp', url: 'https://img.test.local/products/x/1.webp', alt: { pt: 'Carta na mesa', en: 'Letter on a table' } },
    ])
    expect(pub.subtitle).toEqual({ pt: 'Papel algodão', en: 'Cotton paper' })
    expect(pub.specs).toEqual([{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }])
    expect(pub.featured).toBe(true)
    expect(pub.id).toBe(String(doc._id))
    expect(pub.stock).toBeNull()
  })

  it('fills v2 defaults for a v1-shaped product document', async () => {
    // Simulates a document written by v1 (no subtitle/specs/featured, photo without alt).
    await Product.collection.insertOne({
      slug: 'old', name: { pt: 'Velho', en: 'Old' }, description: { pt: 'x', en: 'x' },
      priceCents: 1000, type: 'digital', stock: null, photos: [{ r2Key: 'products/o/1.webp' }], active: true,
    })
    const doc = (await Product.findOne({ slug: 'old' }))!
    const pub = toPublicProduct(doc)
    expect(pub.subtitle).toEqual({ pt: '', en: '' })
    expect(pub.specs).toEqual([])
    expect(pub.featured).toBe(false)
    expect(pub.photos[0]!.alt).toEqual({ pt: '', en: '' })
  })
```

In `apps/api/test/products.test.ts`, add to the first seeded product `subtitle: { pt: 'Papel algodão', en: 'Cotton paper' }, featured: true,` and add this test inside `describe('public catalog')`:

```ts
  it('exposes subtitle, specs, featured and photo keys in the public payload', async () => {
    const res = await request(app()).get('/api/products/handwritten-letter')
    expect(res.body.product.subtitle).toEqual({ pt: 'Papel algodão', en: 'Cotton paper' })
    expect(res.body.product.specs).toEqual([])
    expect(res.body.product.featured).toBe(true)
    expect(res.body.product.photos).toEqual([])
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/models.test.ts test/products.test.ts`
Expected: FAIL — `subtitle`/`specs`/`featured` are stripped by the strict schema (`toEqual` mismatches).

- [ ] **Step 3: Implement**

Replace `apps/api/src/models/product.ts` with:

```ts
import type { PublicProduct } from '@shop/shared'
import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { getEnv } from '../env.js'

const photoSchema = new Schema(
  {
    r2Key: { type: String, required: true },
    alt: { pt: { type: String, default: '' }, en: { type: String, default: '' } },
  },
  { _id: false },
)

const specSchema = new Schema(
  {
    key: { pt: { type: String, required: true }, en: { type: String, required: true } },
    value: { pt: { type: String, required: true }, en: { type: String, required: true } },
  },
  { _id: false },
)

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { pt: { type: String, required: true }, en: { type: String, required: true } },
    description: { pt: { type: String, required: true }, en: { type: String, required: true } },
    subtitle: { pt: { type: String, default: '' }, en: { type: String, default: '' } },
    priceCents: { type: Number, required: true },
    type: { type: String, enum: ['physical', 'digital'], required: true },
    stock: { type: Number, default: null },
    specs: { type: [specSchema], default: [] },
    photos: { type: [photoSchema], default: [] },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export type ProductDoc = mongoose.HydratedDocument<InferSchemaType<typeof productSchema>>
export const Product = mongoose.model('Product', productSchema)

export function toPublicProduct(doc: ProductDoc): PublicProduct {
  const base = getEnv().R2_PUBLIC_URL
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: { pt: doc.name!.pt!, en: doc.name!.en! },
    description: { pt: doc.description!.pt!, en: doc.description!.en! },
    subtitle: { pt: doc.subtitle?.pt ?? '', en: doc.subtitle?.en ?? '' },
    priceCents: doc.priceCents,
    type: doc.type,
    stock: doc.stock ?? null,
    specs: (doc.specs ?? []).map((s) => ({
      key: { pt: s.key!.pt!, en: s.key!.en! },
      value: { pt: s.value!.pt!, en: s.value!.en! },
    })),
    photos: (doc.photos ?? []).map((p) => ({
      key: p.r2Key,
      url: `${base}/${p.r2Key}`,
      alt: { pt: p.alt?.pt ?? '', en: p.alt?.en ?? '' },
    })),
    featured: doc.featured ?? false,
    active: doc.active,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/models.test.ts test/products.test.ts`
Expected: the two product tests in `models.test.ts` and all of `products.test.ts` PASS. The Order test in `models.test.ts` still passes (v1 model untouched until Task 8). Note: `admin-products.test.ts` still passes too — its `$push: { photos: { r2Key } }` gets default alt.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/models/product.ts apps/api/test/models.test.ts apps/api/test/products.test.ts
git commit -m "feat(api): product subtitle, specs, featured flag and photo alt text"
```

---

### Task 7: Sequential order numbers

**Files:**
- Create: `apps/api/src/models/counter.ts`
- Test: `apps/api/test/counter.test.ts`

**Interfaces:**
- Produces: `Counter` model (`_id: string`, `seq: number`), `nextOrderNumber(): Promise<number>` — first call returns 1, strictly increasing, safe under concurrency.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/counter.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Counter, nextOrderNumber } from '../src/models/counter'

describe('nextOrderNumber', () => {
  it('starts at 1 and increments', async () => {
    expect(await nextOrderNumber()).toBe(1)
    expect(await nextOrderNumber()).toBe(2)
    expect(await nextOrderNumber()).toBe(3)
  })
  it('hands out distinct numbers under concurrency, including the very first upsert', async () => {
    const numbers = await Promise.all(Array.from({ length: 20 }, () => nextOrderNumber()))
    expect(new Set(numbers).size).toBe(20)
    expect(Math.max(...numbers)).toBe(20)
    expect(await Counter.countDocuments()).toBe(1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/counter.test.ts`
Expected: FAIL — cannot find module `../src/models/counter`.

- [ ] **Step 3: Implement**

Create `apps/api/src/models/counter.ts`:

```ts
import mongoose, { Schema } from 'mongoose'

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
})

export const Counter = mongoose.model('Counter', counterSchema)

const ORDER_COUNTER_ID = 'order'

// Atomic $inc with upsert. Two concurrent first calls can race on the upsert and one of them
// gets E11000 on the _id index — retry once; the second attempt finds the document.
export async function nextOrderNumber(): Promise<number> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const doc = await Counter.findOneAndUpdate(
        { _id: ORDER_COUNTER_ID },
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
      )
      return doc!.seq
    } catch (err) {
      if ((err as { code?: number }).code !== 11000 || attempt === 1) throw err
    }
  }
  throw new Error('unreachable')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/counter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/models/counter.ts apps/api/test/counter.test.ts
git commit -m "feat(api): atomic sequential order number counter"
```

---

### Task 8: Order model v2 and serializers

**Files:**
- Rewrite: `apps/api/src/models/order.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/models.test.ts` (order cases)

**Interfaces:**
- Consumes: `ORDER_STATUSES`, `OrderStatus`, `PublicOrder`, `AdminOrder`, `SHIPPING_METHODS`, `ShippingMethod`, `ShippingAddress` (Tasks 1, 3, 5).
- Produces: `Order` model with the v2 schema (`orderNumber` unique, `stripeSessionId` unique sparse, `shippingAddress` subdocument or `null`, `buyer`, `items`, `amounts`, `notes`, `giftMessage`, `referral`, `locale`, `trackingCode`, `paidAt`, `shippedAt`), `OrderDoc`, `toPublicOrder(doc): PublicOrder`, `toAdminOrder(doc): AdminOrder`.

- [ ] **Step 1: Write the failing tests**

In `apps/api/test/models.test.ts`, replace the `enforces unique stripeSessionId on Order` test with these, and add the imports `toAdminOrder, toPublicOrder` from `'../src/models/order'`:

```ts
  const pendingOrder = (orderNumber: number) => ({
    orderNumber,
    status: 'pending',
    buyer: { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' },
    shippingAddress: {
      country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388', complement: 'ap. 51',
      district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
    },
    shippingMethod: 'pac',
    notes: 'For my grandmother',
    locale: 'pt',
    items: [{ productId: 'p1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 }],
    amounts: { itemsCents: 5000, shippingCents: 2200, totalCents: 7200, currency: 'brl' },
  })

  it('allows several pending orders without a session id, but rejects a duplicate session id', async () => {
    await Order.syncIndexes()
    await Order.create(pendingOrder(1))
    await Order.create(pendingOrder(2))
    expect(await Order.countDocuments({ stripeSessionId: { $exists: false } })).toBe(2)
    await Order.create({ ...pendingOrder(3), stripeSessionId: 'cs_1' })
    await expect(Order.create({ ...pendingOrder(4), stripeSessionId: 'cs_1' })).rejects.toThrow(/duplicate key/)
  })

  it('rejects a duplicate order number', async () => {
    await Order.syncIndexes()
    await Order.create(pendingOrder(7))
    await expect(Order.create(pendingOrder(7))).rejects.toThrow(/duplicate key/)
  })

  it('defaults status to pending and shipping fields to null for a digital-only order', async () => {
    const doc = await Order.create({
      orderNumber: 9,
      buyer: { name: 'B', email: 'b@example.com' },
      locale: 'en',
      items: [{ productId: 'p2', slug: 'doodle', name: { pt: 'Rabisco', en: 'Doodle' }, qty: 1, unitAmountCents: 1500 }],
      amounts: { itemsCents: 1500, shippingCents: 0, totalCents: 1500, currency: 'brl' },
    })
    expect(doc.status).toBe('pending')
    expect(doc.shippingAddress).toBeNull()
    expect(doc.shippingMethod).toBeNull()
  })

  it('serializes a public order without buyer data and with the ETA of the method', async () => {
    const doc = await Order.create({ ...pendingOrder(10), stripeSessionId: 'cs_pub', status: 'paid' })
    const pub = toPublicOrder(doc)
    expect(pub).toEqual({
      orderNumber: 10,
      status: 'paid',
      items: [{ name: { pt: 'Carta', en: 'Letter' }, qty: 1 }],
      totalCents: 7200,
      currency: 'brl',
      shippingMethod: 'pac',
      eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' },
    })
    expect(JSON.stringify(pub)).not.toContain('marina@example.com')
  })

  it('serializes an admin order with everything', async () => {
    const doc = await Order.create({ ...pendingOrder(11), stripeSessionId: 'cs_adm', trackingCode: 'BR123' })
    const adm = toAdminOrder(doc)
    expect(adm.id).toBe(String(doc._id))
    expect(adm.orderNumber).toBe(11)
    expect(adm.buyer).toEqual({ name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' })
    expect(adm.shippingAddress).toEqual(pendingOrder(11).shippingAddress)
    expect(adm.shippingMethod).toBe('pac')
    expect(adm.notes).toBe('For my grandmother')
    expect(adm.items[0]).toEqual({ productId: 'p1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 })
    expect(adm.amounts).toEqual({ itemsCents: 5000, shippingCents: 2200, totalCents: 7200, currency: 'brl' })
    expect(adm.trackingCode).toBe('BR123')
    expect(adm.stripeSessionId).toBe('cs_adm')
    expect(typeof adm.createdAt).toBe('string')
    expect(adm.paidAt).toBeUndefined()
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/models.test.ts`
Expected: FAIL — v1 schema requires `stripeSessionId`, has no `orderNumber`, `toPublicOrder`/`toAdminOrder` do not exist.

- [ ] **Step 3: Implement the model**

Replace `apps/api/src/models/order.ts` with:

```ts
import {
  ORDER_STATUSES,
  SHIPPING_METHODS,
  type AdminOrder,
  type OrderStatus,
  type PublicOrder,
  type ShippingAddress,
  type ShippingMethod,
} from '@shop/shared'
import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const localized = { pt: { type: String, required: true }, en: { type: String, required: true } }

const shippingAddressSchema = new Schema(
  {
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    street: { type: String, required: true },
    number: String,
    complement: String,
    district: String,
    city: { type: String, required: true },
    state: String,
  },
  { _id: false },
)

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    slug: { type: String, required: true },
    name: localized,
    qty: { type: Number, required: true },
    unitAmountCents: { type: Number, required: true },
  },
  { _id: false },
)

const orderSchema = new Schema(
  {
    orderNumber: { type: Number, required: true, unique: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'pending' },
    // Set right after the Stripe session is created; pending orders briefly have none, hence sparse.
    stripeSessionId: { type: String, unique: true, sparse: true },
    stripePaymentIntentId: String,
    buyer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
    },
    shippingAddress: { type: shippingAddressSchema, default: null },
    // 'pac' | 'sedex' | 'intl' | null — validated by zod at the API boundary.
    shippingMethod: { type: String, default: null },
    notes: String,
    giftMessage: String,
    referral: String,
    locale: { type: String, enum: ['pt', 'en'], required: true },
    items: { type: [orderItemSchema], default: [] },
    amounts: {
      itemsCents: { type: Number, required: true },
      shippingCents: { type: Number, required: true },
      totalCents: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    trackingCode: String,
    paidAt: Date,
    shippedAt: Date,
  },
  { timestamps: true },
)

export type OrderDoc = mongoose.HydratedDocument<InferSchemaType<typeof orderSchema>>
export const Order = mongoose.model('Order', orderSchema)

function addressOf(doc: OrderDoc): ShippingAddress | null {
  const a = doc.shippingAddress
  if (!a) return null
  return {
    country: a.country,
    postalCode: a.postalCode,
    street: a.street,
    number: a.number ?? undefined,
    complement: a.complement ?? undefined,
    district: a.district ?? undefined,
    city: a.city,
    state: a.state ?? undefined,
  }
}

function methodOf(doc: OrderDoc): ShippingMethod | null {
  return (doc.shippingMethod as ShippingMethod | null | undefined) ?? null
}

export function toPublicOrder(doc: OrderDoc): PublicOrder {
  const method = methodOf(doc)
  return {
    orderNumber: doc.orderNumber,
    status: doc.status as OrderStatus,
    items: doc.items.map((i) => ({ name: { pt: i.name!.pt!, en: i.name!.en! }, qty: i.qty })),
    totalCents: doc.amounts!.totalCents,
    currency: doc.amounts!.currency,
    shippingMethod: method,
    eta: method ? SHIPPING_METHODS[method].eta : null,
  }
}

export function toAdminOrder(doc: OrderDoc): AdminOrder {
  return {
    id: String(doc._id),
    orderNumber: doc.orderNumber,
    status: doc.status as OrderStatus,
    createdAt: doc.createdAt.toISOString(),
    paidAt: doc.paidAt?.toISOString(),
    shippedAt: doc.shippedAt?.toISOString(),
    buyer: { name: doc.buyer!.name!, email: doc.buyer!.email!, phone: doc.buyer!.phone ?? undefined },
    shippingAddress: addressOf(doc),
    shippingMethod: methodOf(doc),
    notes: doc.notes ?? undefined,
    giftMessage: doc.giftMessage ?? undefined,
    referral: doc.referral ?? undefined,
    locale: doc.locale as 'pt' | 'en',
    items: doc.items.map((i) => ({
      productId: i.productId,
      slug: i.slug,
      name: { pt: i.name!.pt!, en: i.name!.en! },
      qty: i.qty,
      unitAmountCents: i.unitAmountCents,
    })),
    amounts: {
      itemsCents: doc.amounts!.itemsCents,
      shippingCents: doc.amounts!.shippingCents,
      totalCents: doc.amounts!.totalCents,
      currency: doc.amounts!.currency,
    },
    trackingCode: doc.trackingCode ?? undefined,
    stripeSessionId: doc.stripeSessionId ?? undefined,
    stripePaymentIntentId: doc.stripePaymentIntentId ?? undefined,
  }
}
```

If `InferSchemaType` types `doc.createdAt` as possibly undefined, use `doc.createdAt!.toISOString()`; timestamps are always set by Mongoose.

- [ ] **Step 4: Sync indexes on boot**

In `apps/api/src/index.ts`, replace the two `init()` lines with:

```ts
// syncIndexes (not init) because v1 left a non-sparse unique index on stripeSessionId in
// production; init() would refuse to change its options, syncIndexes drops and recreates it.
await Order.syncIndexes()
await Product.syncIndexes()
```

- [ ] **Step 5: Run the model tests to verify they pass**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/models.test.ts`
Expected: PASS (7 tests). Other API suites (`webhook`, `orders`, `admin-orders`) now fail — expected, rewritten in Tasks 11–13.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/models/order.ts apps/api/src/index.ts apps/api/test/models.test.ts
git commit -m "feat(api): v2 order model with order numbers, buyer, address and serializers"
```

---

### Task 9: Pure Stripe session builder

**Files:**
- Create: `apps/api/src/lib/checkout-session.ts`
- Test: `apps/api/test/checkout-session.test.ts`

**Interfaces:**
- Consumes: `Buyer`, `ShippingAddress` (Task 3), `ShippingMethodInfo` (Task 1).
- Produces: `SessionLine { name: string; unitAmountCents: number; qty: number }`, `SessionInput { orderId; orderNumber; locale; buyer; lines; shipping: null | { method: ShippingMethodInfo; address: ShippingAddress }; webOrigin }`, `buildCheckoutSessionParams(input): Stripe.Checkout.SessionCreateParams`, `toStripeAddress(a: ShippingAddress): Stripe.AddressParam`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/checkout-session.test.ts`:

```ts
import { SHIPPING_METHODS } from '@shop/shared'
import { describe, expect, it } from 'vitest'
import { buildCheckoutSessionParams, toStripeAddress } from '../src/lib/checkout-session'

const buyer = { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' }
const address = {
  country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388', complement: 'ap. 51',
  district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
}
const base = {
  orderId: '65f0c0ffee0000000000abcd',
  orderNumber: 413,
  locale: 'pt' as const,
  buyer,
  lines: [{ name: 'Carta escrita à mão', unitAmountCents: 5000, qty: 2 }],
  webOrigin: 'https://shop.example.com',
}

describe('buildCheckoutSessionParams', () => {
  it('builds a card-only session with DB prices, buyer email, order metadata and our URLs', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: null })
    expect(p.mode).toBe('payment')
    expect(p.payment_method_types).toEqual(['card'])
    expect(p.locale).toBe('pt')
    expect(p.customer_email).toBe('marina@example.com')
    expect(p.client_reference_id).toBe(base.orderId)
    expect(p.metadata).toEqual({ orderId: base.orderId, orderNumber: '413' })
    expect(p.line_items).toEqual([
      { quantity: 2, price_data: { currency: 'brl', unit_amount: 5000, product_data: { name: 'Carta escrita à mão' } } },
    ])
    expect(p.success_url).toBe('https://shop.example.com/thanks?order=413&session_id={CHECKOUT_SESSION_ID}')
    expect(p.cancel_url).toBe('https://shop.example.com/checkout')
  })

  it('never asks Stripe to collect an address or offer shipping options', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: { method: SHIPPING_METHODS.sedex, address } })
    expect(p.shipping_address_collection).toBeUndefined()
    expect(p.shipping_options).toBeUndefined()
  })

  it('adds shipping as a line item and passes the collected address to the payment intent', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: { method: SHIPPING_METHODS.sedex, address } })
    expect(p.line_items).toHaveLength(2)
    expect(p.line_items![1]).toEqual({
      quantity: 1,
      price_data: { currency: 'brl', unit_amount: 4100, product_data: { name: 'Frete · Correios SEDEX' } },
    })
    expect(p.payment_intent_data).toEqual({
      shipping: {
        name: 'Marina Bicalho',
        phone: '+55 31 98812-4407',
        address: {
          country: 'BR', postal_code: '30150-904', line1: 'Rua Sapucaí, 388', line2: 'ap. 51 - Floresta',
          city: 'Belo Horizonte', state: 'MG',
        },
      },
    })
  })

  it('labels the shipping line in English for the en locale', () => {
    const p = buildCheckoutSessionParams({ ...base, locale: 'en', shipping: { method: SHIPPING_METHODS.intl, address: { ...address, country: 'US' } } })
    expect(p.line_items![1]!.price_data!.product_data!.name).toBe('Shipping · International (Correios)')
  })

  it('omits digital-only shipping entirely', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: null })
    expect(p.line_items).toHaveLength(1)
    expect(p.payment_intent_data).toBeUndefined()
  })
})

describe('toStripeAddress', () => {
  it('joins street and number, and complement and district, dropping empties', () => {
    expect(toStripeAddress({ country: 'US', postalCode: '10001', street: '350 5th Ave', city: 'New York', state: 'NY' })).toEqual({
      country: 'US', postal_code: '10001', line1: '350 5th Ave', line2: undefined, city: 'New York', state: 'NY',
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/checkout-session.test.ts`
Expected: FAIL — cannot find module `../src/lib/checkout-session`.

- [ ] **Step 3: Implement**

Create `apps/api/src/lib/checkout-session.ts`:

```ts
import type { Buyer, ShippingAddress, ShippingMethodInfo } from '@shop/shared'
import type Stripe from 'stripe'

export interface SessionLine {
  name: string
  unitAmountCents: number
  qty: number
}

export interface SessionInput {
  orderId: string
  orderNumber: number
  locale: 'pt' | 'en'
  buyer: Buyer
  lines: SessionLine[]
  shipping: null | { method: ShippingMethodInfo; address: ShippingAddress }
  webOrigin: string
}

const SHIPPING_LABEL = { pt: 'Frete', en: 'Shipping' } as const

export function toStripeAddress(a: ShippingAddress): Stripe.AddressParam {
  const line2 = [a.complement, a.district].filter(Boolean).join(' - ')
  return {
    country: a.country,
    postal_code: a.postalCode,
    line1: a.number ? `${a.street}, ${a.number}` : a.street,
    line2: line2 || undefined,
    city: a.city,
    state: a.state,
  }
}

// Pure: everything Stripe needs, nothing read from the outside. Prices arrive already looked up
// from Mongo by the caller. Stripe requires shipping_address_collection to use shipping_options,
// and the address is ours now, so shipping is an ordinary line item and the address travels on
// the PaymentIntent (shows on the receipt and in the dashboard).
export function buildCheckoutSessionParams(input: SessionInput): Stripe.Checkout.SessionCreateParams {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((l) => ({
    quantity: l.qty,
    price_data: { currency: 'brl', unit_amount: l.unitAmountCents, product_data: { name: l.name } },
  }))

  if (input.shipping) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'brl',
        unit_amount: input.shipping.method.cents,
        product_data: { name: `${SHIPPING_LABEL[input.locale]} · ${input.shipping.method.name[input.locale]}` },
      },
    })
  }

  return {
    mode: 'payment',
    payment_method_types: ['card'],
    locale: input.locale,
    customer_email: input.buyer.email,
    client_reference_id: input.orderId,
    metadata: { orderId: input.orderId, orderNumber: String(input.orderNumber) },
    line_items: lineItems,
    success_url: `${input.webOrigin}/thanks?order=${input.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.webOrigin}/checkout`,
    ...(input.shipping && {
      payment_intent_data: {
        shipping: {
          name: input.buyer.name,
          phone: input.buyer.phone,
          address: toStripeAddress(input.shipping.address),
        },
      },
    }),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/checkout-session.test.ts`
Expected: PASS (6 tests). If `toEqual` on `payment_intent_data` fails only because `phone: undefined` appears for a buyer without phone, that is fine — the test buyer has a phone.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/checkout-session.ts apps/api/test/checkout-session.test.ts
git commit -m "feat(api): pure Stripe checkout session builder"
```

---

### Task 10: `POST /api/checkout` creates a pending order

**Files:**
- Rewrite: `apps/api/src/routes/checkout.ts`
- Modify: `apps/api/src/errors.ts` (dotted-path `fieldErrors`)
- Test: `apps/api/test/checkout.test.ts` (rewrite)

**Interfaces:**
- Consumes: `checkoutRequestSchema`, `checkoutRules`, `computeTotals`, `hasPhysicalItems`, `SHIPPING_METHODS` (shared); `Product`, `Order`, `nextOrderNumber`, `buildCheckoutSessionParams`, `stripe`, `AppError`.
- Produces: `POST /api/checkout` → `200 { url, orderNumber }`; `400 UNKNOWN_ITEM | OUT_OF_STOCK | VALIDATION(fieldErrors)`; `502 STRIPE_UNAVAILABLE`. Side effect: one `Order` in `pending` with `stripeSessionId` set.

- [ ] **Step 1: Write the failing tests**

Replace `apps/api/test/checkout.test.ts` with:

```ts
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'
import { Product } from '../src/models/product'
import { stripe } from '../src/lib/stripe'

vi.mock('../src/lib/stripe', () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}))
const sessionsCreate = vi.mocked(stripe.checkout.sessions.create)

const buyer = { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' }
const brAddress = {
  country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388',
  district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
}
const physical = {
  items: [{ slug: 'letter', qty: 2 }], locale: 'pt', buyer,
  shippingAddress: brAddress, shippingMethod: 'sedex', notes: 'For my grandmother',
}
const digital = { items: [{ slug: 'doodle', qty: 1 }], locale: 'en', buyer }

let letterId: string

beforeEach(async () => {
  sessionsCreate.mockReset()
  sessionsCreate.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } as never)
  const letter = await Product.create({
    slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, description: { pt: 'x', en: 'x' },
    priceCents: 5000, type: 'physical', stock: null, active: true,
  })
  await Product.create({
    slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, description: { pt: 'x', en: 'x' },
    priceCents: 12000, type: 'physical', stock: 1, active: true,
  })
  await Product.create({
    slug: 'doodle', name: { pt: 'Rabisco', en: 'Doodle' }, description: { pt: 'x', en: 'x' },
    priceCents: 1500, type: 'digital', stock: null, active: true,
  })
  letterId = String(letter._id)
})

const post = (body: object) => request(createApp()).post('/api/checkout').send(body)

describe('POST /api/checkout', () => {
  it('creates a pending order with our totals, then a session priced from the database', async () => {
    const res = await post(physical)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1', orderNumber: 1 })

    const order = (await Order.findOne({ orderNumber: 1 }))!
    expect(order.status).toBe('pending')
    expect(order.stripeSessionId).toBe('cs_test_1')
    expect(order.buyer!.email).toBe('marina@example.com')
    expect(order.shippingAddress!.city).toBe('Belo Horizonte')
    expect(order.shippingMethod).toBe('sedex')
    expect(order.notes).toBe('For my grandmother')
    expect(order.locale).toBe('pt')
    expect(order.items.map((i) => ({ productId: i.productId, slug: i.slug, qty: i.qty, unitAmountCents: i.unitAmountCents }))).toEqual([
      { productId: letterId, slug: 'letter', qty: 2, unitAmountCents: 5000 },
    ])
    expect(order.amounts).toMatchObject({ itemsCents: 10000, shippingCents: 4100, totalCents: 14100, currency: 'brl' })

    const params = sessionsCreate.mock.calls[0]![0]!
    expect(params.line_items![0]).toMatchObject({ quantity: 2, price_data: { currency: 'brl', unit_amount: 5000 } })
    expect(params.line_items![1]).toMatchObject({ quantity: 1, price_data: { unit_amount: 4100 } })
    expect(params.metadata).toEqual({ orderId: String(order._id), orderNumber: '1' })
    expect(params.customer_email).toBe('marina@example.com')
    expect(params.shipping_address_collection).toBeUndefined()
    expect(params.shipping_options).toBeUndefined()
    expect(params.payment_intent_data!.shipping!.address.city).toBe('Belo Horizonte')
    expect(params.success_url).toBe('http://localhost:5173/thanks?order=1&session_id={CHECKOUT_SESSION_ID}')
  })

  it('ignores any price the client sends', async () => {
    await post({ ...physical, items: [{ slug: 'letter', qty: 1, priceCents: 1 }] })
    const params = sessionsCreate.mock.calls[0]![0]!
    expect(params.line_items![0]!.price_data!.unit_amount).toBe(5000)
  })

  it('numbers orders sequentially', async () => {
    await post(physical)
    sessionsCreate.mockResolvedValue({ id: 'cs_test_2', url: 'https://checkout.stripe.com/c/pay/cs_test_2' } as never)
    const res = await post(digital)
    expect(res.body.orderNumber).toBe(2)
  })

  it('stores a digital-only order without address or method and without a shipping line', async () => {
    const res = await post(digital)
    expect(res.status).toBe(200)
    const order = (await Order.findOne({ orderNumber: 1 }))!
    expect(order.shippingAddress).toBeNull()
    expect(order.shippingMethod).toBeNull()
    expect(order.amounts!.shippingCents).toBe(0)
    const params = sessionsCreate.mock.calls[0]![0]!
    expect(params.line_items).toHaveLength(1)
    expect(params.payment_intent_data).toBeUndefined()
  })

  it('rejects a physical cart without address with dotted fieldErrors', async () => {
    const res = await post({ ...physical, shippingAddress: undefined, shippingMethod: undefined })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.fieldErrors).toEqual({ shippingAddress: ['required'], shippingMethod: ['required'] })
    expect(await Order.countDocuments()).toBe(0)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('rejects an international method for a Brazilian address', async () => {
    const res = await post({ ...physical, shippingMethod: 'intl' })
    expect(res.status).toBe(400)
    expect(res.body.error.fieldErrors).toEqual({ shippingMethod: ['not_available'] })
  })

  it('reports zod errors with dotted paths', async () => {
    const res = await post({ ...digital, buyer: { name: 'M', email: 'nope' } })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(Object.keys(res.body.error.fieldErrors).sort()).toEqual(['buyer.email', 'buyer.name'])
  })

  it('rejects an unknown or inactive item', async () => {
    const res = await post({ ...digital, items: [{ slug: 'ghost', qty: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('UNKNOWN_ITEM')
    expect(await Order.countDocuments()).toBe(0)
  })

  it('rejects qty above remaining stock for one-of-one items', async () => {
    const res = await post({ ...physical, items: [{ slug: 'drawing', qty: 2 }] })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('OUT_OF_STOCK')
    expect(await Order.countDocuments()).toBe(0)
  })

  it('deletes the pending order and answers 502 when Stripe fails', async () => {
    sessionsCreate.mockRejectedValue(new Error('stripe down'))
    const res = await post(physical)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('STRIPE_UNAVAILABLE')
    expect(await Order.countDocuments()).toBe(0)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/checkout.test.ts`
Expected: FAIL — the route still expects `destination` (and the API does not compile against the new shared until this task).

- [ ] **Step 3: Make zod field errors dotted**

In `apps/api/src/errors.ts`, replace the `ZodError` branch with:

```ts
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of err.issues) {
      const key = issue.path.length ? issue.path.join('.') : '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid request', fieldErrors } })
    return
  }
```

- [ ] **Step 4: Rewrite the route**

Replace `apps/api/src/routes/checkout.ts` with:

```ts
import {
  SHIPPING_METHODS,
  checkoutRequestSchema,
  checkoutRules,
  computeTotals,
  hasPhysicalItems,
} from '@shop/shared'
import { Router } from 'express'
import { getEnv } from '../env.js'
import { AppError } from '../errors.js'
import { buildCheckoutSessionParams } from '../lib/checkout-session.js'
import { stripe } from '../lib/stripe.js'
import { nextOrderNumber } from '../models/counter.js'
import { Order } from '../models/order.js'
import { Product } from '../models/product.js'

export const checkoutRouter = Router()

checkoutRouter.post('/api/checkout', async (req, res) => {
  const body = checkoutRequestSchema.parse(req.body)
  const env = getEnv()

  // Prices and stock come from Mongo. The client only tells us slugs and quantities.
  const products = await Product.find({ slug: { $in: body.items.map((i) => i.slug) }, active: true })
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const lines = body.items.map((item) => {
    const product = bySlug.get(item.slug)
    if (!product) throw new AppError(400, 'UNKNOWN_ITEM', `Unknown item: ${item.slug}`)
    if (product.stock != null && item.qty > product.stock)
      throw new AppError(400, 'OUT_OF_STOCK', `Not enough stock for: ${item.slug}`)
    return { product, qty: item.qty }
  })

  const physical = hasPhysicalItems(lines.map((l) => ({ type: l.product.type })))
  const ruleErrors = checkoutRules(body, physical)
  if (ruleErrors) throw new AppError(400, 'VALIDATION', 'Invalid checkout details', ruleErrors)

  const method = physical ? body.shippingMethod! : null
  const address = physical ? body.shippingAddress! : null
  const totals = computeTotals(
    lines.map((l) => ({ priceCents: l.product.priceCents, qty: l.qty, type: l.product.type })),
    method,
  )

  const orderNumber = await nextOrderNumber()
  const order = await Order.create({
    orderNumber,
    status: 'pending',
    buyer: body.buyer,
    shippingAddress: address,
    shippingMethod: method,
    notes: body.notes,
    giftMessage: body.giftMessage,
    referral: body.referral,
    locale: body.locale,
    items: lines.map((l) => ({
      productId: String(l.product._id),
      slug: l.product.slug,
      name: { pt: l.product.name!.pt!, en: l.product.name!.en! },
      qty: l.qty,
      unitAmountCents: l.product.priceCents,
    })),
    amounts: { ...totals, currency: 'brl' },
  })

  let session
  try {
    session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        orderId: String(order._id),
        orderNumber,
        locale: body.locale,
        buyer: body.buyer,
        lines: lines.map((l) => ({ name: l.product.name![body.locale]!, unitAmountCents: l.product.priceCents, qty: l.qty })),
        shipping: method && address ? { method: SHIPPING_METHODS[method], address } : null,
        webOrigin: env.WEB_ORIGIN,
      }),
    )
  } catch (err) {
    // No session means the buyer can never pay this order; drop it rather than leave a ghost.
    await Order.deleteOne({ _id: order._id })
    console.error('[checkout] stripe session creation failed', { orderNumber, err })
    throw new AppError(502, 'STRIPE_UNAVAILABLE', 'Payment provider unavailable, please try again')
  }

  order.stripeSessionId = session.id
  await order.save()
  res.json({ url: session.url, orderNumber })
})
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build -w @shop/shared && NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/checkout.test.ts test/checkout-session.test.ts`
Expected: PASS (10 + 6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/checkout.ts apps/api/src/errors.ts apps/api/test/checkout.test.ts
git commit -m "feat(api): checkout creates a pending order before the Stripe redirect"
```

---

### Task 11: Webhook confirms, expires and guards stock

**Files:**
- Rewrite: `apps/api/src/routes/webhook.ts`
- Test: `apps/api/test/webhook.test.ts` (rewrite)

**Interfaces:**
- Consumes: `Order`, `Product`, `stripe`, `getEnv`.
- Produces: `checkout.session.completed` (paid) → `pending → paid` atomically, `paidAt`, `stripePaymentIntentId`, `amounts.totalCents`/`currency` from Stripe, stock decrement with `oversold` fallback; `checkout.session.expired` → `pending → expired`. Duplicate deliveries are no-ops. Unknown sessions are no-ops.

- [ ] **Step 1: Write the failing tests**

Replace `apps/api/test/webhook.test.ts` with:

```ts
import Stripe from 'stripe'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'
import { Product } from '../src/models/product'

const WEBHOOK_SECRET = 'whsec_testsecret' // matches test/setup.ts
const stripeForSigning = new Stripe('sk_test_dummy')

function signedPost(payload: object) {
  const body = JSON.stringify(payload)
  const signature = stripeForSigning.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET })
  return request(createApp())
    .post('/api/stripe/webhook')
    .set('stripe-signature', signature)
    .set('content-type', 'application/json')
    .send(body)
}

function event(type: string, sessionOverrides: object = {}) {
  return {
    id: 'evt_1',
    type,
    data: {
      object: {
        id: 'cs_test_done',
        object: 'checkout.session',
        payment_intent: 'pi_1',
        payment_status: 'paid',
        amount_subtotal: 16100,
        amount_total: 16100,
        currency: 'brl',
        metadata: { orderId: 'x', orderNumber: '1' },
        ...sessionOverrides,
      },
    },
  }
}

let drawingId: string

beforeEach(async () => {
  await Order.syncIndexes()
  const drawing = await Product.create({
    slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, description: { pt: 'x', en: 'x' },
    priceCents: 12000, type: 'physical', stock: 1, active: true,
  })
  drawingId = String(drawing._id)
  await Order.create({
    orderNumber: 1,
    status: 'pending',
    stripeSessionId: 'cs_test_done',
    buyer: { name: 'Buyer', email: 'buyer@example.com' },
    shippingAddress: { country: 'BR', postalCode: '30150-904', street: 'Rua X', number: '1', district: 'Centro', city: 'BH', state: 'MG' },
    shippingMethod: 'sedex',
    locale: 'en',
    items: [{ productId: drawingId, slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, qty: 1, unitAmountCents: 12000 }],
    amounts: { itemsCents: 12000, shippingCents: 4100, totalCents: 16100, currency: 'brl' },
  })
})

describe('POST /api/stripe/webhook', () => {
  it('rejects an invalid signature', async () => {
    const res = await request(createApp())
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'bad')
      .set('content-type', 'application/json')
      .send('{}')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_SIGNATURE')
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('pending')
  })

  it('confirms the pending order and decrements one-of-one stock', async () => {
    const res = await signedPost(event('checkout.session.completed'))
    expect(res.status).toBe(200)
    const order = (await Order.findOne({ orderNumber: 1 }))!
    expect(order.status).toBe('paid')
    expect(order.paidAt).toBeInstanceOf(Date)
    expect(order.stripePaymentIntentId).toBe('pi_1')
    expect(order.amounts!.totalCents).toBe(16100)
    expect(order.amounts!.shippingCents).toBe(4100) // our breakdown is kept
    expect(order.buyer!.email).toBe('buyer@example.com') // untouched
    expect((await Product.findById(drawingId))!.stock).toBe(0)
  })

  it('takes the charged total from Stripe when it differs, and logs it', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    await signedPost(event('checkout.session.completed', { amount_total: 16000 }))
    expect((await Order.findOne({ orderNumber: 1 }))!.amounts!.totalCents).toBe(16000)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('RECONCILE'), expect.anything())
    warn.mockRestore()
  })

  it('is idempotent: a duplicate delivery does not decrement twice', async () => {
    await signedPost(event('checkout.session.completed'))
    const res = await signedPost(event('checkout.session.completed'))
    expect(res.status).toBe(200)
    expect((await Product.findById(drawingId))!.stock).toBe(0)
    expect(await Order.countDocuments()).toBe(1)
  })

  it('marks the order oversold when stock ran out between checkout and payment', async () => {
    await Product.updateOne({ _id: drawingId }, { stock: 0 })
    await signedPost(event('checkout.session.completed'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('oversold')
  })

  it('does not touch made-to-order products', async () => {
    await Product.updateOne({ _id: drawingId }, { stock: null })
    await signedPost(event('checkout.session.completed'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('paid')
    expect((await Product.findById(drawingId))!.stock).toBeNull()
  })

  it('ignores an unpaid session (async payment methods) and unknown sessions', async () => {
    await signedPost(event('checkout.session.completed', { payment_status: 'unpaid' }))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('pending')
    const res = await signedPost(event('checkout.session.completed', { id: 'cs_unknown' }))
    expect(res.status).toBe(200)
    expect((await Product.findById(drawingId))!.stock).toBe(1)
  })

  it('expires a pending order on checkout.session.expired, but never a paid one', async () => {
    await signedPost(event('checkout.session.expired'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('expired')
    await Order.updateOne({ orderNumber: 1 }, { status: 'paid' })
    await signedPost(event('checkout.session.expired'))
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('paid')
  })

  it('ignores unrelated event types', async () => {
    const res = await signedPost({ id: 'evt_2', type: 'payment_intent.created', data: { object: {} } })
    expect(res.status).toBe(200)
    expect((await Order.findOne({ orderNumber: 1 }))!.status).toBe('pending')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/webhook.test.ts`
Expected: FAIL — the v1 handler tries to `Order.create` (missing `orderNumber`, etc.).

- [ ] **Step 3: Rewrite the webhook**

Replace `apps/api/src/routes/webhook.ts` with:

```ts
import express, { Router } from 'express'
import type Stripe from 'stripe'
import { getEnv } from '../env.js'
import { stripe } from '../lib/stripe.js'
import { Order } from '../models/order.js'
import { Product } from '../models/product.js'

export const webhookRouter = Router()

webhookRouter.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'] as string,
      getEnv().STRIPE_WEBHOOK_SECRET,
    )
  } catch {
    res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid Stripe signature' } })
    return
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
  } else if (event.type === 'checkout.session.expired') {
    await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)
  }
  res.json({ received: true })
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Card only (see checkout-session.ts), but async methods can be flipped on in the Stripe
  // dashboard without a deploy and fire this event with payment_status 'unpaid'.
  if (session.payment_status !== 'paid') return

  const update: Record<string, unknown> = { status: 'paid', paidAt: new Date() }
  if (typeof session.payment_intent === 'string') update.stripePaymentIntentId = session.payment_intent
  if (session.amount_total != null) update['amounts.totalCents'] = session.amount_total
  if (session.currency) update['amounts.currency'] = session.currency

  // The idempotency gate: only a pending order flips to paid, and only once. A duplicate
  // delivery (Stripe retries aggressively) finds nothing to update and stops here.
  const before = await Order.findOneAndUpdate(
    { stripeSessionId: session.id, status: 'pending' },
    { $set: update },
    { new: false },
  )
  if (!before) return

  if (session.amount_total != null && session.amount_total !== before.amounts!.totalCents) {
    console.error('[webhook] RECONCILE: Stripe charged a different total than the order snapshot', {
      orderNumber: before.orderNumber,
      snapshotCents: before.amounts!.totalCents,
      chargedCents: session.amount_total,
    })
  }

  const products = await Product.find({ _id: { $in: before.items.map((i) => i.productId) } })
  const byId = new Map(products.map((p) => [String(p._id), p]))

  for (const item of before.items) {
    const product = byId.get(item.productId)
    if (!product || product.stock === null) continue // made to order: nothing to decrement
    try {
      const decremented = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
      )
      if (!decremented) {
        await Order.updateOne({ _id: before._id }, { $set: { status: 'oversold' } })
      }
    } catch (err) {
      // The order is already paid at this point, so a 500 would only make Stripe retry into
      // the no-op above. Known v1 gap kept: no transactions on Atlas M0, so a crash between the
      // status flip and this loop leaves a paid order with stock never adjusted. Log loudly.
      console.error('[webhook] RECONCILE: stock decrement failed after order was paid', {
        orderNumber: before.orderNumber,
        productId: item.productId,
        err,
      })
    }
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  await Order.updateOne({ stripeSessionId: session.id, status: 'pending' }, { $set: { status: 'expired' } })
}
```

Note `{ new: false }` returns the document *before* the update, which is what we need to compare the snapshot total and to know the items; the update itself already happened atomically.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/webhook.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/webhook.ts apps/api/test/webhook.test.ts
git commit -m "feat(api): webhook confirms pending orders and expires abandoned sessions"
```

---

### Task 12: Public order lookup for the thank-you page

**Files:**
- Rewrite: `apps/api/src/routes/orders.ts`
- Test: `apps/api/test/orders.test.ts` (rewrite)

**Interfaces:**
- Consumes: `Order`, `toPublicOrder`, `AppError`.
- Produces: `GET /api/orders/:orderNumber?session_id=` → `200 { order: PublicOrder }` or `404 ORDER_NOT_FOUND`. `session_id` must match the order's `stripeSessionId`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/api/test/orders.test.ts` with:

```ts
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'

beforeEach(async () => {
  await Order.create({
    orderNumber: 413,
    status: 'pending',
    stripeSessionId: 'cs_sum',
    buyer: { name: 'Buyer', email: 'buyer@example.com' },
    shippingAddress: { country: 'BR', postalCode: '30150-904', street: 'Rua X', number: '1', district: 'Centro', city: 'BH', state: 'MG' },
    shippingMethod: 'pac',
    locale: 'pt',
    items: [{ productId: 'x', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 2, unitAmountCents: 5000 }],
    amounts: { itemsCents: 10000, shippingCents: 2200, totalCents: 12200, currency: 'brl' },
  })
})

const get = (orderNumber: string, sessionId?: string) =>
  request(createApp()).get(`/api/orders/${orderNumber}`).query(sessionId === undefined ? {} : { session_id: sessionId })

describe('GET /api/orders/:orderNumber', () => {
  it('returns the public order when the session id matches', async () => {
    const res = await get('413', 'cs_sum')
    expect(res.status).toBe(200)
    expect(res.body.order).toEqual({
      orderNumber: 413,
      status: 'pending',
      items: [{ name: { pt: 'Carta', en: 'Letter' }, qty: 2 }],
      totalCents: 12200,
      currency: 'brl',
      shippingMethod: 'pac',
      eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' },
    })
    expect(JSON.stringify(res.body)).not.toContain('buyer@example.com')
    expect(JSON.stringify(res.body)).not.toContain('Rua X')
  })
  it('404s when the session id is wrong or missing (numbers are not enumerable)', async () => {
    for (const res of [await get('413', 'cs_other'), await get('413'), await get('413', '')]) {
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND')
    }
  })
  it('404s for an unknown or non-numeric order number', async () => {
    expect((await get('999', 'cs_sum')).status).toBe(404)
    expect((await get('abc', 'cs_sum')).status).toBe(404)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/orders.test.ts`
Expected: FAIL — route is `/api/orders/summary` (404 NOT_FOUND for the new path).

- [ ] **Step 3: Rewrite the route**

Replace `apps/api/src/routes/orders.ts` with:

```ts
import { Router } from 'express'
import { AppError } from '../errors.js'
import { Order, toPublicOrder } from '../models/order.js'

export const ordersRouter = Router()

// The Stripe session id only ever reaches the buyer's browser (success_url), so it acts as the
// order's password: knowing an order number alone reveals nothing.
ordersRouter.get('/api/orders/:orderNumber', async (req, res) => {
  const orderNumber = Number(req.params.orderNumber)
  const sessionId = String(req.query.session_id ?? '')
  if (!Number.isInteger(orderNumber) || !sessionId) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const order = await Order.findOne({ orderNumber, stripeSessionId: sessionId })
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  res.json({ order: toPublicOrder(order) })
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/orders.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/orders.ts apps/api/test/orders.test.ts
git commit -m "feat(api): public order lookup by number guarded by the session id"
```

---

### Task 13: Admin orders — filter and ship transition

**Files:**
- Rewrite: `apps/api/src/routes/admin/orders.ts`
- Test: `apps/api/test/admin-orders.test.ts` (rewrite)

**Interfaces:**
- Consumes: `ORDER_STATUSES`, `canTransition` (shared); `Order`, `toAdminOrder`, `adminGuard`, `AppError`.
- Produces: `GET /api/admin/orders?status=<status|all>` → `200 { orders: AdminOrder[] }` newest first, default hides `expired`, unknown status → `400 VALIDATION`; `PATCH /api/admin/orders/:id` body `{ status: 'shipped', trackingCode? }` → `200 { order: AdminOrder }`, `404 ORDER_NOT_FOUND`, `409 INVALID_TRANSITION`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/api/test/admin-orders.test.ts` with:

```ts
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { Order } from '../src/models/order'

const auth = (r: request.Test) =>
  r.set('Authorization', `Bearer ${jwt.sign({ sub: 'admin' }, 'test-jwt-secret', { expiresIn: '1h' })}`)

const order = (orderNumber: number, status: string, createdAt: string) => ({
  orderNumber,
  status,
  stripeSessionId: `cs_${orderNumber}`,
  buyer: { name: `Buyer ${orderNumber}`, email: `b${orderNumber}@example.com` },
  locale: 'en',
  items: [{ productId: 'x', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 }],
  amounts: { itemsCents: 5000, shippingCents: 0, totalCents: 5000, currency: 'brl' },
  createdAt: new Date(createdAt),
})

const ids: Record<string, string> = {}

beforeEach(async () => {
  for (const [n, status, at] of [
    [1, 'pending', '2026-09-01'], [2, 'paid', '2026-09-02'], [3, 'shipped', '2026-09-03'],
    [4, 'oversold', '2026-09-04'], [5, 'expired', '2026-09-05'],
  ] as const) {
    const doc = await Order.create(order(n, status, at))
    ids[status] = String(doc._id)
  }
})

describe('admin orders', () => {
  it('requires auth', async () => {
    expect((await request(createApp()).get('/api/admin/orders')).status).toBe(401)
    expect((await request(createApp()).patch(`/api/admin/orders/${ids.paid}`).send({ status: 'shipped' })).status).toBe(401)
  })

  it('lists everything except expired by default, newest first, as admin orders', async () => {
    const res = await auth(request(createApp()).get('/api/admin/orders'))
    expect(res.status).toBe(200)
    expect(res.body.orders.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([4, 3, 2, 1])
    expect(res.body.orders[3]).toMatchObject({ id: ids.pending, status: 'pending', buyer: { email: 'b1@example.com' } })
  })

  it('filters by status, including expired and all', async () => {
    const paid = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'paid' }))
    expect(paid.body.orders.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([2])
    const expired = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'expired' }))
    expect(expired.body.orders.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([5])
    const all = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'all' }))
    expect(all.body.orders).toHaveLength(5)
  })

  it('400s on an unknown status filter', async () => {
    const res = await auth(request(createApp()).get('/api/admin/orders').query({ status: 'lost' }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
  })

  it('ships a paid order with a tracking code and stamps shippedAt', async () => {
    const res = await auth(request(createApp()).patch(`/api/admin/orders/${ids.paid}`).send({ status: 'shipped', trackingCode: 'BR123' }))
    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe('shipped')
    expect(res.body.order.trackingCode).toBe('BR123')
    expect(typeof res.body.order.shippedAt).toBe('string')
  })

  it('ships an oversold order (after manual resolution) without a tracking code', async () => {
    const res = await auth(request(createApp()).patch(`/api/admin/orders/${ids.oversold}`).send({ status: 'shipped' }))
    expect(res.status).toBe(200)
    expect(res.body.order.status).toBe('shipped')
    expect(res.body.order.trackingCode).toBeUndefined()
  })

  it('409s on shipping a pending, shipped or expired order', async () => {
    for (const id of [ids.pending, ids.shipped, ids.expired]) {
      const res = await auth(request(createApp()).patch(`/api/admin/orders/${id}`).send({ status: 'shipped' }))
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    }
  })

  it('400s on any other target status and 404s on unknown ids', async () => {
    const bad = await auth(request(createApp()).patch(`/api/admin/orders/${ids.paid}`).send({ status: 'paid' }))
    expect(bad.status).toBe(400)
    const missing = await auth(request(createApp()).patch('/api/admin/orders/000000000000000000000000').send({ status: 'shipped' }))
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('ORDER_NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/admin-orders.test.ts`
Expected: FAIL — v1 route accepts `fulfilled`, has no filter, returns raw documents.

- [ ] **Step 3: Rewrite the route**

Replace `apps/api/src/routes/admin/orders.ts` with:

```ts
import { ORDER_STATUSES, canTransition } from '@shop/shared'
import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../errors.js'
import { adminGuard } from '../../middleware/auth.js'
import { Order, toAdminOrder } from '../../models/order.js'

// `as const` keeps the spread a readonly tuple, which is what z.enum accepts.
const listQuerySchema = z.object({ status: z.enum([...ORDER_STATUSES, 'all'] as const).optional() })
const patchSchema = z.object({
  status: z.literal('shipped'),
  trackingCode: z.string().trim().min(1).max(60).optional(),
})

export const adminOrdersRouter = Router()
adminOrdersRouter.use('/api/admin/orders', adminGuard)

adminOrdersRouter.get('/api/admin/orders', async (req, res) => {
  const { status } = listQuerySchema.parse(req.query)
  const filter = status === 'all' ? {} : status ? { status } : { status: { $ne: 'expired' } }
  const orders = await Order.find(filter).sort({ createdAt: -1 })
  res.json({ orders: orders.map(toAdminOrder) })
})

adminOrdersRouter.patch('/api/admin/orders/:id', async (req, res) => {
  const patch = patchSchema.parse(req.body)
  const order = await Order.findById(req.params.id).catch(() => null)
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (!canTransition(order.status, patch.status))
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot move an order from ${order.status} to ${patch.status}`)
  order.status = patch.status
  order.shippedAt = new Date()
  if (patch.trackingCode) order.trackingCode = patch.trackingCode
  await order.save()
  res.json({ order: toAdminOrder(order) })
})
```

If TypeScript complains that `order.status` is `string` rather than `OrderStatus` in `canTransition`, cast: `canTransition(order.status as OrderStatus, patch.status)` and import the type from `@shop/shared`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/admin-orders.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/admin/orders.ts apps/api/test/admin-orders.test.ts
git commit -m "feat(api): admin order list filter and ship transition"
```

---

### Task 14: Admin products — alt text on upload, photos on update

**Files:**
- Modify: `apps/api/src/routes/admin/products.ts`
- Test: `apps/api/test/admin-products.test.ts` (extend)

**Interfaces:**
- Consumes: `productInputSchema`, `productUpdateSchema` (Task 4); `Product`, `toPublicProduct`.
- Produces: `POST /api/admin/products/:id/photos` multipart `photo` + optional text fields `altPt`, `altEn`; `PUT /api/admin/products/:id` accepts `photos: [{ key, alt? }]` which must list every existing key exactly once (else `400 VALIDATION` with `fieldErrors.photos = ['must_match_existing']`); create/update accept `subtitle`, `specs`, `featured`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/test/admin-products.test.ts`, inside `describe('admin products')`:

```ts
  it('creates a product with subtitle, specs and featured, and lists them back', async () => {
    const app = createApp()
    const res = await auth(request(app).post('/api/admin/products').send({
      ...input,
      subtitle: { pt: 'Papel algodão', en: 'Cotton paper' },
      specs: [{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }],
      featured: true,
    }))
    expect(res.status).toBe(201)
    expect(res.body.product.subtitle).toEqual({ pt: 'Papel algodão', en: 'Cotton paper' })
    expect(res.body.product.specs).toHaveLength(1)
    expect(res.body.product.featured).toBe(true)
  })

  it('stores alt text sent with a photo upload', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer()
    const res = await auth(
      request(app).post(`/api/admin/products/${id}/photos`)
        .field('altPt', 'Carta na mesa').field('altEn', 'Letter on a table')
        .attach('photo', png, 'photo.png'),
    )
    expect(res.status).toBe(201)
    expect(res.body.product.photos[0].alt).toEqual({ pt: 'Carta na mesa', en: 'Letter on a table' })
    expect(res.body.product.photos[0].key).toMatch(new RegExp(`^products/${id}/`))
  })

  it('reorders photos and edits alt text through PUT, keeping alt for entries without one', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, {
      $push: { photos: { $each: [
        { r2Key: `products/${id}/a.webp`, alt: { pt: 'A pt', en: 'A en' } },
        { r2Key: `products/${id}/b.webp`, alt: { pt: 'B pt', en: 'B en' } },
      ] } },
    })
    const res = await auth(request(app).put(`/api/admin/products/${id}`).send({
      ...input,
      photos: [{ key: `products/${id}/b.webp`, alt: { pt: 'B novo', en: 'B new' } }, { key: `products/${id}/a.webp` }],
    }))
    expect(res.status).toBe(200)
    expect(res.body.product.photos.map((p: { key: string }) => p.key)).toEqual([`products/${id}/b.webp`, `products/${id}/a.webp`])
    expect(res.body.product.photos[0].alt).toEqual({ pt: 'B novo', en: 'B new' })
    expect(res.body.product.photos[1].alt).toEqual({ pt: 'A pt', en: 'A en' })
  })

  it('400s when the PUT photos list does not match the existing keys exactly', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, { $push: { photos: { r2Key: `products/${id}/a.webp` } } })
    for (const photos of [
      [],                                                                            // drops a photo
      [{ key: `products/${id}/zzz.webp` }],                                          // unknown key
      [{ key: `products/${id}/a.webp` }, { key: `products/${id}/a.webp` }],          // duplicate
    ]) {
      const res = await auth(request(app).put(`/api/admin/products/${id}`).send({ ...input, photos }))
      expect(res.status).toBe(400)
      expect(res.body.error.fieldErrors).toEqual({ photos: ['must_match_existing'] })
    }
  })

  it('leaves photos untouched when PUT omits the photos field', async () => {
    const app = createApp()
    const created = await auth(request(app).post('/api/admin/products').send(input))
    const id = created.body.product.id
    await Product.updateOne({ _id: id }, { $push: { photos: { r2Key: `products/${id}/a.webp` } } })
    const res = await auth(request(app).put(`/api/admin/products/${id}`).send({ ...input, priceCents: 3500 }))
    expect(res.status).toBe(200)
    expect(res.body.product.photos).toHaveLength(1)
    expect(res.body.product.priceCents).toBe(3500)
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/admin-products.test.ts`
Expected: the five new tests FAIL (alt not stored; `photos` in body is ignored/stripped). The v1 tests still pass.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/admin/products.ts`:

Change the import line to:

```ts
import { productInputSchema, productUpdateSchema } from '@shop/shared'
```

Replace the `put` handler with:

```ts
adminProductsRouter.put('/api/admin/products/:id', async (req, res) => {
  const { photos, ...input } = productUpdateSchema.parse(req.body)
  const doc = await findProduct(req.params.id)
  doc.set(input)
  if (photos) {
    // Reorder + alt edit only. Adding goes through POST /photos, removing through DELETE /photos,
    // so the list must be a permutation of what exists — anything else would orphan R2 objects.
    const existing = new Map(doc.photos.map((p) => [p.r2Key, p]))
    const keys = photos.map((p) => p.key)
    const matches = keys.length === existing.size && new Set(keys).size === keys.length && keys.every((k) => existing.has(k))
    if (!matches) throw new AppError(400, 'VALIDATION', 'photos must list every existing photo exactly once', { photos: ['must_match_existing'] })
    doc.set(
      'photos',
      photos.map((p) => ({
        r2Key: p.key,
        alt: p.alt ?? { pt: existing.get(p.key)!.alt?.pt ?? '', en: existing.get(p.key)!.alt?.en ?? '' },
      })),
    )
  }
  try {
    await doc.save()
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError(409, 'SLUG_TAKEN', 'Slug already in use')
    throw err
  }
  res.json({ product: toPublicProduct(doc) })
})
```

In the photo upload handler, replace `doc.photos.push({ r2Key: key })` with:

```ts
  const body = (req.body ?? {}) as Record<string, unknown>
  const alt = {
    pt: typeof body.altPt === 'string' ? body.altPt.slice(0, 200) : '',
    en: typeof body.altEn === 'string' ? body.altEn.slice(0, 200) : '',
  }
  doc.photos.push({ r2Key: key, alt })
```

The `post` (create) handler needs no change: `productInputSchema.parse` now returns `subtitle`, `specs`, `featured` with defaults and `Product.create(input)` stores them.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/admin-products.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/admin/products.ts apps/api/test/admin-products.test.ts
git commit -m "feat(api): photo alt text on upload and photo reorder/alt edit on product update"
```

---

### Task 15: One-shot migration of v1 orders

**Files:**
- Create: `apps/api/src/lib/migrate-v2.ts`
- Create: `apps/api/src/migrate-v2.ts`
- Modify: `apps/api/package.json` (script)
- Test: `apps/api/test/migrate-v2.test.ts`

**Interfaces:**
- Consumes: `nextOrderNumber` (Task 7), `Order` (Task 8).
- Produces: `migrateOrderDoc(raw: Record<string, unknown>, orderNumber: number): { $set: Record<string, unknown>; $unset: Record<string, ''> }` (pure), `runMigration(): Promise<number>` (migrates every order without `orderNumber`, oldest first, then `Order.syncIndexes()`), npm script `migrate:v2`.

v1 order shape (for reference): `{ stripeSessionId, stripePaymentIntentId?, items[], amounts, customer: { email?, name? }, shippingAddress: null | { name?, address?: { line1?, line2?, city?, state?, postal_code?, country? } }, status: 'paid' | 'fulfilled' | 'oversold', trackingCode?, createdAt, updatedAt }`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/migrate-v2.test.ts`:

```ts
import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { migrateOrderDoc, runMigration } from '../src/lib/migrate-v2'
import { Order } from '../src/models/order'

const v1Physical = {
  stripeSessionId: 'cs_v1_a',
  stripePaymentIntentId: 'pi_a',
  items: [{ productId: 'p1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, qty: 1, unitAmountCents: 5000 }],
  amounts: { itemsCents: 5000, shippingCents: 1500, totalCents: 6500, currency: 'brl' },
  customer: { email: 'a@example.com', name: 'Ana' },
  shippingAddress: { name: 'Ana', address: { line1: 'Rua X, 1', line2: 'ap 2', city: 'BH', state: 'MG', postal_code: '30150-904', country: 'BR' } },
  status: 'fulfilled',
  trackingCode: 'BR1',
  createdAt: new Date('2026-08-25T10:00:00Z'),
  updatedAt: new Date('2026-08-27T10:00:00Z'),
}
const v1Digital = {
  stripeSessionId: 'cs_v1_b',
  items: [{ productId: 'p2', slug: 'doodle', name: { pt: 'Rabisco', en: 'Doodle' }, qty: 1, unitAmountCents: 1500 }],
  amounts: { itemsCents: 1500, shippingCents: 0, totalCents: 1500, currency: 'brl' },
  customer: { email: 'b@example.com' },
  shippingAddress: null,
  status: 'paid',
  createdAt: new Date('2026-08-26T10:00:00Z'),
  updatedAt: new Date('2026-08-26T10:00:00Z'),
}

describe('migrateOrderDoc', () => {
  it('maps a fulfilled physical v1 order to a shipped v2 order', () => {
    const { $set, $unset } = migrateOrderDoc(v1Physical, 1)
    expect($set).toEqual({
      orderNumber: 1,
      status: 'shipped',
      buyer: { name: 'Ana', email: 'a@example.com' },
      shippingAddress: { country: 'BR', postalCode: '30150-904', street: 'Rua X, 1', complement: 'ap 2', city: 'BH', state: 'MG' },
      shippingMethod: 'pac',
      locale: 'en',
      paidAt: new Date('2026-08-25T10:00:00Z'),
      shippedAt: new Date('2026-08-27T10:00:00Z'),
    })
    expect($unset).toEqual({ customer: '' })
  })
  it('maps a paid digital v1 order, filling a name when missing', () => {
    const { $set } = migrateOrderDoc(v1Digital, 2)
    expect($set).toMatchObject({
      orderNumber: 2, status: 'paid', buyer: { name: 'Unknown', email: 'b@example.com' },
      shippingAddress: null, shippingMethod: null, locale: 'en', paidAt: new Date('2026-08-26T10:00:00Z'),
    })
    expect(($set as { shippedAt?: unknown }).shippedAt).toBeUndefined()
  })
  it('infers the international method for a foreign address and keeps oversold', () => {
    const { $set } = migrateOrderDoc({ ...v1Physical, status: 'oversold', shippingAddress: { address: { line1: '1 Main St', city: 'NYC', postal_code: '10001', country: 'US' } } }, 3)
    expect($set).toMatchObject({ status: 'oversold', shippingMethod: 'intl', shippingAddress: { country: 'US', street: '1 Main St', city: 'NYC', postalCode: '10001' } })
  })
})

describe('runMigration', () => {
  it('migrates v1 documents oldest first, numbers them, and leaves v2 documents alone', async () => {
    const col = mongoose.connection.collection('orders')
    await col.insertMany([v1Digital, v1Physical]) // inserted out of order on purpose
    await Order.create({
      orderNumber: 500, status: 'pending', stripeSessionId: 'cs_v2', buyer: { name: 'V2', email: 'v2@example.com' }, locale: 'pt',
      items: [], amounts: { itemsCents: 0, shippingCents: 0, totalCents: 0, currency: 'brl' },
    })

    expect(await runMigration()).toBe(2)

    const a = (await Order.findOne({ stripeSessionId: 'cs_v1_a' }))!
    const b = (await Order.findOne({ stripeSessionId: 'cs_v1_b' }))!
    expect(a.orderNumber).toBe(1) // older
    expect(b.orderNumber).toBe(2)
    expect(a.status).toBe('shipped')
    expect(a.buyer!.email).toBe('a@example.com')
    expect(a.shippingAddress!.street).toBe('Rua X, 1')
    expect((a.toObject() as Record<string, unknown>).customer).toBeUndefined()
    expect((await Order.findOne({ orderNumber: 500 }))!.status).toBe('pending')

    expect(await runMigration()).toBe(0) // idempotent
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/migrate-v2.test.ts`
Expected: FAIL — cannot find module `../src/lib/migrate-v2`.

- [ ] **Step 3: Implement the pure mapper and the runner**

Create `apps/api/src/lib/migrate-v2.ts`:

```ts
import mongoose from 'mongoose'
import { nextOrderNumber } from '../models/counter.js'
import { Order } from '../models/order.js'

type Raw = Record<string, unknown>

interface V1StripeAddress {
  name?: string
  address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

// Pure mapping from a v1 order document to the $set/$unset that turn it into a v2 document.
// v1 stored the address exactly as Stripe returned it and had no shipping method; the method is
// inferred from the country (BR → pac, anything else → intl) because v1 only had two flat rates.
export function migrateOrderDoc(raw: Raw, orderNumber: number): { $set: Raw; $unset: Record<string, ''> } {
  const customer = (raw.customer ?? {}) as { email?: string; name?: string }
  const v1Address = raw.shippingAddress as V1StripeAddress | null | undefined
  const a = v1Address?.address
  const shippingAddress = a
    ? {
        country: a.country ?? 'BR',
        postalCode: a.postal_code ?? '',
        street: a.line1 ?? '',
        ...(str(a.line2) && { complement: a.line2 }),
        city: a.city ?? '',
        ...(str(a.state) && { state: a.state }),
      }
    : null
  const v1Status = raw.status as string
  const status = v1Status === 'fulfilled' ? 'shipped' : v1Status
  const createdAt = raw.createdAt as Date | undefined
  const updatedAt = raw.updatedAt as Date | undefined

  const $set: Raw = {
    orderNumber,
    status,
    buyer: { name: str(customer.name) ?? 'Unknown', email: str(customer.email) ?? 'unknown@example.com' },
    shippingAddress,
    shippingMethod: shippingAddress ? (shippingAddress.country === 'BR' ? 'pac' : 'intl') : null,
    locale: 'en',
    ...(createdAt && { paidAt: createdAt }),
    ...(status === 'shipped' && updatedAt && { shippedAt: updatedAt }),
  }
  return { $set, $unset: { customer: '' } }
}

// Idempotent: only documents without an orderNumber are touched. Oldest first so numbers follow
// purchase order. Uses the raw collection because the v1 shape does not validate against the
// v2 schema.
export async function runMigration(): Promise<number> {
  const col = mongoose.connection.collection('orders')
  const legacy = await col.find({ orderNumber: { $exists: false } }).sort({ createdAt: 1 }).toArray()
  for (const raw of legacy) {
    const orderNumber = await nextOrderNumber()
    const { $set, $unset } = migrateOrderDoc(raw as Raw, orderNumber)
    await col.updateOne({ _id: raw._id }, { $set, $unset })
  }
  await Order.syncIndexes()
  return legacy.length
}
```

Create `apps/api/src/migrate-v2.ts`:

```ts
// One-shot: run once against production after deploying v2.
//   MONGO_URL=... npm run migrate:v2 -w @shop/api
import mongoose from 'mongoose'
import { getEnv } from './env.js'
import { runMigration } from './lib/migrate-v2.js'

await mongoose.connect(getEnv().MONGO_URL)
const migrated = await runMigration()
console.log(`migrated ${migrated} v1 order(s)`)
await mongoose.disconnect()
```

Add to `apps/api/package.json` `scripts`:

```json
    "migrate:v2": "tsx src/migrate-v2.ts",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/api -- test/migrate-v2.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/migrate-v2.ts apps/api/src/migrate-v2.ts apps/api/package.json apps/api/test/migrate-v2.test.ts
git commit -m "feat(api): one-shot migration of v1 orders to the v2 shape"
```

---

### Task 16: Seed, e2e skip, full verification, PR

**Files:**
- Modify: `apps/api/src/seed.ts`
- Modify: `e2e/shop.spec.ts`

**Interfaces:**
- Produces: seed products with `subtitle`, `specs`, `featured` (letter); e2e checkout test skipped until PR 5.

- [ ] **Step 1: Extend the seed**

In `apps/api/src/seed.ts`, replace the four entries of `SEED_PRODUCTS` with (slugs and names unchanged — the e2e suite clicks on them):

```ts
export const SEED_PRODUCTS: ProductInput[] = [
  {
    slug: 'handwritten-letter',
    name: { pt: 'Exhibit 001 — Carta escrita à mão', en: 'Exhibit 001 — Handwritten letter' },
    subtitle: { pt: 'Papel algodão · 2 folhas', en: 'Cotton paper · 2 sheets' },
    description: {
      pt: 'Uma carta escrita à mão por mim, sobre o que você quiser (ou sobre nada). Enviada pelo correio, de verdade.',
      en: 'A letter handwritten by me, about whatever you want (or about nothing). Shipped by actual mail.',
    },
    priceCents: 5000,
    type: 'physical',
    stock: null,
    specs: [
      { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5, 2 folhas', en: 'A5, 2 sheets' } },
      { key: { pt: 'Papel', en: 'Paper' }, value: { pt: 'Algodão 180g', en: '180gsm cotton' } },
      { key: { pt: 'Prazo', en: 'Lead time' }, value: { pt: '5 dias úteis', en: '5 business days' } },
    ],
    featured: true,
    active: true,
  },
  {
    slug: 'original-pencil-drawing',
    name: { pt: 'Exhibit 002 — Desenho original a lápis', en: 'Exhibit 002 — Original pencil drawing' },
    subtitle: { pt: 'A5 · original', en: 'A5 · original' },
    description: {
      pt: 'Um desenho original, peça única. Quando vender, acabou.',
      en: 'An original drawing, one of one. When it sells, it is gone.',
    },
    priceCents: 12000,
    type: 'physical',
    stock: 1,
    specs: [
      { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5 (14,8 × 21 cm)', en: 'A5 (5.8 × 8.3 in)' } },
      { key: { pt: 'Peça', en: 'Edition' }, value: { pt: 'Original, única', en: 'One of one' } },
    ],
    active: true,
  },
  {
    slug: 'digital-letter',
    name: { pt: 'Exhibit 003 — Carta digital', en: 'Exhibit 003 — Digital letter' },
    subtitle: { pt: 'Escaneada · por e-mail', en: 'Scanned · by e-mail' },
    description: {
      pt: 'A mesma carta à mão, escaneada e enviada por email. Sem frete, sem espera de correio.',
      en: 'The same handwritten letter, scanned and emailed to you. No shipping, no postal wait.',
    },
    priceCents: 2000,
    type: 'digital',
    stock: null,
    specs: [{ key: { pt: 'Entrega', en: 'Delivery' }, value: { pt: 'PDF por e-mail', en: 'PDF by e-mail' } }],
    active: true,
  },
  {
    slug: 'digital-doodle',
    name: { pt: 'Exhibit 004 — Rabisco digital', en: 'Exhibit 004 — Digital doodle' },
    subtitle: { pt: 'Feito pra você · por e-mail', en: 'Made for you · by e-mail' },
    description: {
      pt: 'Um rabisco feito especialmente pra você, entregue por email.',
      en: 'A doodle made especially for you, delivered by email.',
    },
    priceCents: 1500,
    type: 'digital',
    stock: null,
    active: true,
  },
]
```

- [ ] **Step 2: Skip the e2e checkout test until the web is rewritten**

In `e2e/shop.spec.ts`, replace the first line inside `test('checkout reaches Stripe', ...)` with:

```ts
  // The v1 web still posts the v1 checkout body; the checkout is rewritten in PR 3 and this
  // test comes back in PR 5 (feat/v2-e2e-docs).
  test.skip(true, 'v1 web checkout is incompatible with the v2 API; re-enabled in PR 5')
```

Keep the rest of the test body as is.

- [ ] **Step 3: Full verification**

Run, from the repo root:

```bash
npm run build -w @shop/shared
npm run typecheck
NODE_OPTIONS=--max-old-space-size=4096 npm test
npm run build
npm run e2e
```

Expected: typecheck clean for all three workspaces (the v1 web compiles against the new shared); all shared, API and v1 web tests pass; build succeeds; e2e reports 2 passed, 1 skipped. Then check for orphans and kill any vitest worker whose parent is `1`:

```bash
ps ax -o pid,ppid,command | grep -i vitest | grep -v grep
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/seed.ts e2e/shop.spec.ts
git commit -m "chore: v2 seed content and skip v1 checkout e2e until the web rewrite"
```

- [ ] **Step 5: Push and open the stacked draft PR**

```bash
git push -u origin feat/v2-api-domain
gh pr create --draft --base docs/v2-design --head feat/v2-api-domain \
  --title "feat(api): v2 domain — pending orders, shipping methods, richer products" \
  --body "$(cat <<'EOF'
PR 1 of the v2 stack (spec: docs/superpowers/specs/2026-09-07-webshop-v2-design.md, plan: docs/superpowers/plans/2026-09-07-webshop-v2-01-api-domain.md). Stacked on #2.

What changes:
- shared: shipping methods (PAC, SEDEX, international), computeTotals, v2 checkout schema + cross-field rules, product subtitle/specs/featured/photo alt, order statuses and types.
- api: orders are created as `pending` in POST /api/checkout (with a sequential #MHP-0001 number) and the webhook flips them to `paid` atomically; `checkout.session.expired` marks them `expired`. Shipping is a Stripe line item and the collected address rides on the PaymentIntent (Stripe requires address collection to use shipping_options, and the address is ours now). Admin can ship paid/oversold orders; admin product update can reorder photos and edit alt text.
- one-shot `npm run migrate:v2 -w @shop/api` for v1 orders; `syncIndexes` on boot replaces the v1 non-sparse session index.

The v1 web app is untouched and still compiles (shared keeps its v1 exports); its checkout no longer matches the API, so the checkout e2e test is skipped until PR 5. The web is rewritten in PRs 2–4.
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** Product fields (T4, T6), shipping (T1), Order model and statuses (T5, T8), checkout schema/rules (T3), `POST /api/checkout` flow incl. Stripe failure cleanup (T10), session params incl. no address collection and line-item shipping (T9), `GET /api/orders/:orderNumber` guarded by session id (T12), webhook completed/expired/duplicate/oversold (T11), admin orders filter + transitions (T13), admin products alt/photos (T14), migration (T15), seed (T16), `syncIndexes` on boot (T8), dotted `fieldErrors` (T10). Deploy-note edits to `docs/deploy.md` are deferred to PR 5 per the spec's stack table.
- **Spec deviation recorded:** `amounts.itemsCents/shippingCents` are ours; only `totalCents`/`currency` come from Stripe (spec amended the same day).
- **Type consistency:** `Buyer`, `ShippingAddress`, `ShippingMethod`, `ShippingMethodInfo`, `OrderStatus`, `PublicOrder`, `AdminOrder`, `FieldErrors`, `checkoutRules(req, hasPhysical)`, `computeTotals(lines, method)`, `buildCheckoutSessionParams(SessionInput)`, `nextOrderNumber()`, `toPublicOrder`, `toAdminOrder`, `toPublicProduct`, `migrateOrderDoc`, `runMigration` are used with the same names and shapes across tasks.
