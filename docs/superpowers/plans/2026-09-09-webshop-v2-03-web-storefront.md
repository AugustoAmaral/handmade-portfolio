# Webshop v2 — PR 3: Web storefront (`feat/v2-web-storefront`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 storefront with the approved v2 design — a stateful `app/` layer that owns cart, language, data fetching and navigation, and a pure `ui/` layer of shop components and full pages that render from fixtures alone, so every screen from atom to page is a Storybook story with no network mocks anywhere.

**Architecture:** Everything is built additively first, alongside the still-working v1 app, and the v1 app is deleted in a single late task once its replacement compiles and passes. `src/app/**` is the only place with state, effects, IO and the router; `src/ui/**` stays pure and stateless (the PR 2 architecture test already enforces this, recursively, on every new folder). Pages under `src/ui/pages/` take fully-resolved props and are what stories render; containers under `src/app/routes/` are thin and are what the router renders.

**Tech Stack:** React 18.3, react-router 7, @tanstack/react-query 5, Vite 7, Tailwind 4 (`@theme` tokens from PR 2), Storybook 10.6 with `@storybook/addon-vitest` and `@storybook/addon-a11y`, Vitest 3.2.7 (`unit` jsdom project + `storybook` Chromium project), react-i18next 15 via the dedicated `src/copy/` instance, `@shop/shared` for schemas, shipping, totals and money.

**Spec:** `docs/superpowers/specs/2026-09-07-webshop-v2-design.md` (sections "Scope by screen", "Frontend", "Storybook and testing"). This plan is PR 3 of 5. PR 1 (`feat/v2-api-domain`) and PR 2 (`feat/v2-web-foundation`) are merged into `docs/v2-design`.

**Visual source of truth:** `design-claude-design/My Handmade Portfolio.dc.html`, extracted into `docs/superpowers/plans/2026-09-09-webshop-v2-03-prototype-extract.md` — **read that companion file before Tasks 5–10.** It carries the verbatim pt-BR copy, the token mapping, per-component structure notes, and the list of things the design does NOT provide (no semantics, no error/loading/empty states, no mailto address, no reduced-motion handling) which are therefore designed here rather than transcribed.

One finding from the extraction reshapes those tasks: **the prototype contains zero Tailwind and zero semantic HTML.** It is 100% inline styles with raw hex, and nothing in it is a `<button>`, `<a href>`, `<nav>`, `<header>`, `<main>`, `<form>` or `<label>`. Every class string in the plan and the extract is a derivation to be checked against the inline style it came from, and every accessible name, role and keyboard interaction is new work.

## Global Constraints

- Branch `feat/v2-web-storefront` is created from `docs/v2-design`; its PR targets `docs/v2-design`.
- **The wipe is narrow and happens once, in Task 12.** Delete exactly `src/main.tsx`, `src/App.tsx`, `src/components/`, `src/i18n/`, `src/lib/`, `src/pages/`, and the six v1 test files (`admin-login.test.tsx`, `api.test.ts`, `cart-page.test.tsx`, `cart.test.tsx`, `i18n.test.ts`, `storefront.test.tsx`, `thanks.test.tsx`). KEEP `src/ui/`, `src/copy/`, `src/fixtures/`, the tokens in `src/index.css`, and `test/{setup,storage,copy,fixtures,routes,ui-boundaries}.ts`. The spec's original "the existing `apps/web/src` is discarded" refers to the v1 APP, not the directory — taken literally it destroys PR 2's output. This is spec:14, already amended.
- **`src/ui/**` is pure and STATELESS.** `test/ui-boundaries.test.ts` walks it recursively and fails on: any import that is not `react`, `react-dom`, `react-i18next`, `@shop/shared` or a relative path resolving inside `src/ui`; any of `useState`, `useReducer`, `useEffect`, `useLayoutEffect`, `useRef`; any of `window.`, `document.`, `localStorage`, `sessionStorage`, `fetch(`. `*.stories.tsx` files are exempt. This applies to `ui/shop/**` and `ui/pages/**` from the moment they exist — do not plan a component around local state.
- **Only `app/` changes the language.** `useLang` persists to `localStorage['shop_lang']` and calls `i18n.changeLanguage`. `LangToggle` receives `onToggle`.
- **UI components take `lang` as a PROP from the container. They must NOT read `i18n.resolvedLanguage`.** ⚠️ Amended after Task 3 measured it: `resolvedLanguage` is **`undefined` whenever the app is in English**. `src/copy/i18n.ts` ships `resources: { pt: … }` only — English keys render themselves — and i18next resolves only to a language that HAS translations. Verified directly: `lng=pt → resolvedLanguage=pt`, `lng=en → resolvedLanguage=undefined`. So `product.name[resolvedLanguage]` is `product.name[undefined]` → `undefined` → an empty name on every English page. `formatPrice` is typed `(cents, locale: 'pt' | 'en')` and `resolvedLanguage` is `string | undefined`, so TypeScript rejects it — and the natural way to silence that (`as 'pt' | 'en'`) is exactly what turns a compile error into a silent runtime blank. Inside `app/`, where the current language is genuinely needed from the instance, use `i18n.language`, which is always the language actually set. The `*Props` interfaces in this plan already take `lang: 'pt' | 'en'`; that was right and this constraint was wrong.
- **i18n keys ARE the English sentence:** `t('Add to bag')`. Only `pt.json` is maintained; in English the key renders itself. `test/copy.test.ts` scans `t('literal')` call sites in `src/ui` and fails on any key missing from `pt.json`, so **every task that adds a `t()` call also adds its `pt.json` entry in the same commit.** Six keys were planted in PR 2 for this PR and must be used, not re-added: `Add to bag`, `Your bag is empty.`, `Ship to: Brazil`, `{{count}} in stock`, `Made to order`, `Sold out`. `Photo of {{name}}` is dead by design (ImageFrame takes `alt` as a prop) — delete it in Task 12 or use it, do not leave it unexamined.
- **Navigation is `<a href>` built from `ui/routes.ts`.** No UI component imports the router. `LinkInterceptor` at the app root upgrades same-origin clicks. Callbacks only where something happens before or instead of navigating (`onAddToCart`, `onInc`, `onSubmit`).
- **Prices are integer BRL cents** and always formatted through `formatPrice(cents, lang)`. Client-side totals are display-only; the API re-prices from Mongo.
- Design tokens (already in `index.css`, do not redefine): `--color-paper #f4f0e6`, `--color-paper-2 #efe9db`, `--color-paper-3 #e6dfcd`, `--color-ink #1a1713`, `--color-accent #a63d20`; `--font-display 'Instrument Serif'`, `--font-body Newsreader`, `--font-mono 'IBM Plex Mono'`.
- **Accessibility is a gate, not a review comment.** `.storybook/preview.tsx` sets `a11y: { test: 'error' }`, so every new story must pass axe. Page-scale rules that never fired on isolated primitives WILL fire now: `region` (all content in landmarks), `heading-order`, `landmark-unique`, `page-has-heading-one`. Fix the component; never disable the rule.
- **Contrast floors, measured not eyeballed:** 4.5:1 for normal text, 3:1 for text ≥24px and for focus indicators (WCAG 2.2 SC 2.4.11). PR 2 had to raise three opacities and rewrite the focus ring for exactly this. Muted text below `opacity-65` on paper does not clear AA.
- **Every new assertion must be proved able to fail** by mutating what it guards, and the proof reported. An assertion that cannot fail is deleted, not kept "for coverage". PR 2 shipped ten of them before this standard was enforced.
- Run vitest with `NODE_OPTIONS=--max-old-space-size=4096`. The machine guardrail lives at the ROOT of `apps/web/vitest.config.ts` (`maxWorkers: 2`, `minWorkers: 1`, `poolOptions.forks.{minForks:1,maxForks:2}`) — **never move it inside a project, where it is silently ignored.** After a run check orphans: `ps ax -o pid,ppid,command | grep -i vitest | grep -v grep`, kill any with ppid 1.
- Commits in English, conventional-commit noun-phrase subjects, **no trailers** (no `Co-Authored-By`, no `Claude-Session`). The branch below has zero across 47 commits; keep it that way.
- Code, comments, tests and story names in English. Only `pt.json` values and fixture content are pt-BR.

---

## The two problems the spec does not solve

Both are real, both bite in Task 12, and both are decided here so no implementer has to invent an answer.

**1. The admin dies between PR 3 and PR 4.** Deleting `src/pages/admin/` removes the admin app, and PR 4 is what rebuilds it. `App.tsx` in this PR therefore registers **shop routes only**; `/admin*` is unrouted and renders the not-found branch. This is safe because these PRs merge into `docs/v2-design`, not `main` — production keeps serving v1 until PR 5 lands. `ui/routes.ts` keeps its `admin*` builders; they are strings, and PR 4 consumes them.

**2. The e2e suite breaks the moment the v1 app is gone.** `e2e/shop.spec.ts` drives `/cart` (removed in v2) and the v1 admin login. CI runs e2e on every PR, so this PR cannot leave it red and cannot defer it to PR 5. Task 12 therefore: rewrites test 1 for the v2 flow (catalog → product → add to bag → drawer shows the line and totals), **skips** test 2 with `test.skip(true, 'admin is rebuilt in PR 4')` exactly as test 3 is already skipped for PR 5, and leaves test 3 untouched. Do not delete the skipped tests: a skipped test with a reason is a tracked commitment, a deleted one is forgotten work.

---

## File map

Created under `apps/web/src/app/` (STATEFUL — router, IO, state; not covered by the purity test):

| File | Responsibility |
|---|---|
| `api/client.ts` | `ApiError`, `api<T>(path, init)` — base URL, JSON headers, error envelope unwrapping |
| `api/queries.ts` | react-query hooks: `useProducts`, `useProduct(slug)`, `useOrder(orderNumber, sessionId)`, `useCheckout()` mutation |
| `state/useCart.ts` | `shop_cart` localStorage, add/setQty/remove/clear, `CART_MAX_*` limits, `count` |
| `state/useLang.ts` | `shop_lang` localStorage + `navigator.language` fallback, calls `i18n.changeLanguage` |
| `LinkInterceptor.tsx` | capture-phase click → `navigate()` for plain same-origin anchors only |
| `ShopShellContainer.tsx` | cart + drawer state + language, wraps the shop routes via `<Outlet/>` |
| `routes/HomeRoute.tsx` | catalog query → `HomePage` |
| `routes/ProductRoute.tsx` | product query + selected photo state → `ProductPage` |
| `routes/AboutRoute.tsx` | `AboutPage` (no data) |
| `routes/CheckoutRoute.tsx` | form values/errors, `checkoutRules` validation, POST + `window.location.assign` |
| `routes/DoneRoute.tsx` | `?order=&session_id=`, polls while `pending`, clears the cart on first hit |
| `main.tsx` | providers: QueryClient, BrowserRouter, copy i18n, `index.css` |
| `App.tsx` | `<LinkInterceptor>` + shop `<Routes>` |

Created under `apps/web/src/ui/` (PURE — props in, JSX out; every file gets a `.stories.tsx`):

| Folder | Files |
|---|---|
| `shop/` | `ShopHeader`, `CartDrawer`, `CartLine`, `Hero`, `FeaturedCard`, `ProductCard`, `CatalogGrid`, `ClosingBlock`, `ProductGallery`, `SpecsTable`, `AboutBlocks`, `AboutFacts`, `AboutClosing`, `CheckoutBuyerSection`, `CheckoutAddressSection`, `CheckoutShippingSection`, `CheckoutNotesSection`, `CheckoutPaymentSection`, `OrderSummaryPanel`, `index.ts` |
| `pages/` | `ShopShell`, `HomePage`, `ProductPage`, `AboutPage`, `CheckoutPage`, `DonePage`, `index.ts` |

Modified: `apps/web/src/copy/pt.json` (grows with every task), `e2e/shop.spec.ts` (Task 12), `apps/web/src/index.css` (only if a token is genuinely missing).

Deleted in Task 12: `src/{main,App}.tsx` (v1 versions, replaced), `src/components/`, `src/i18n/`, `src/lib/`, `src/pages/`, and the six v1 test files listed in the constraints.

---

## The fixtures you already have

PR 2 shipped these, typed against the real `@shop/shared` schemas and deep-frozen. Stories render from them; nothing in this PR should hand-build a product, an order or a checkout request.

- `fixtures/products.ts` — `letter` (featured, physical, made-to-order, 2 photos), `drawing`, `soldOutDrawing` (`stock: 0`), `digitalLetter` (`type: 'digital'`), `inactiveGuide` (`active: false`), `productWithoutPhotos`, and `products` (the four active ones, in catalogue order).
- `fixtures/checkout.ts` — `emptyCheckout`, `brCheckout`, `intlCheckout`, `digitalCheckout`, `incompleteBrCheckout`, plus `brCheckoutErrors` and `buyerCheckoutErrors` (**derived by running the real `checkoutRules` and the real zod schema**, not hand-written, so the error stories cannot drift from what the API actually emits), and `cartLines` for totals.
- `fixtures/orders.ts` — `pendingOrder`, `paidOrder`, `shippedOrder`, `oversoldOrder`, `expiredOrder`, `adminOrders` (admin shapes, mostly PR 4), and `publicPendingOrder` / `publicPaidOrder` — the two `DonePage` stories need exactly these.

If a story needs a state none of these cover, add a fixture rather than an inline literal: `test/fixtures.test.ts` validates every export against the schemas, so a fixture is checked and a literal is not.


## Task order and why

Tasks 1–11 are **purely additive**: the v1 app keeps compiling, its tests keep passing, and `npm run build` keeps working throughout. Nothing collides, because the only two files the v1 app and the v2 app both want are `main.tsx` and `App.tsx`, and those are written in Task 12. This is the same strategy PR 2 used, and it is what makes every intermediate commit shippable.

| # | Task | Depends on |
|---|---|---|
| 1 | API client and query hooks | — |
| 2 | `useCart` | — |
| 3 | `useLang` | — |
| 4 | `LinkInterceptor` | — |
| 5 | Shop chrome: `ShopHeader`, `CartLine`, `CartDrawer` | — |
| 6 | Home components | — |
| 7 | Product components | — |
| 8 | About components | — |
| 9 | Checkout sections and summary | — |
| 10 | Pages | 5–9 |
| 11 | Containers | 1–4, 10 |
| 12 | The switch: new `main`/`App`, wipe v1, fix e2e | 11 |
| 13 | Autodocs decision and the branch-wide sweep | 12 |

---

### Task 1: API client and query hooks

The v1 client is deleted in Task 12, so this is a rewrite, not a move. Two differences from v1 that matter: the admin token header stays (PR 4 needs it, and leaving it out would make PR 4 edit this file again), and the checkout mutation is the one call whose error envelope carries `fieldErrors` the checkout form renders field by field.

**Files:**
- Create: `apps/web/src/app/api/client.ts`
- Create: `apps/web/src/app/api/queries.ts`
- Test: `apps/web/test/app/api-client.test.ts`

**Interfaces:**
- Consumes: `PublicProduct`, `PublicOrder`, `CheckoutRequest` from `@shop/shared`.
- Produces:
  - `class ApiError extends Error { status: number; code: string; fieldErrors?: FieldErrors }`
  - `api<T>(path: string, init?: RequestInit): Promise<T>`
  - `useProducts(): UseQueryResult<PublicProduct[]>`
  - `useProduct(slug: string): UseQueryResult<PublicProduct>`
  - `useOrder(orderNumber: number | null, sessionId: string | null): UseQueryResult<PublicOrder>`
  - `useCheckout(): UseMutationResult<{ url: string; orderNumber: number }, ApiError, CheckoutRequest>`

> **Tests for `src/app` go in `apps/web/test/app/`, never colocated.** The `unit` vitest project includes `test/**/*.test.{ts,tsx}` only, and the `storybook` project collects `*.stories.tsx`. A test written next to the source it covers is collected by NEITHER project: it typechecks, it is never run, and nothing says so.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../../src/app/api/client'

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// Typed to the shape `fetch` is actually called with. `vi.fn(async () => ...)` infers a
// zero-argument mock, and `mock.calls[0]![1]` on it is a type error rather than the init object
// every assertion below reads.
function fetchStub(respondWith: () => Response) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => respondWith())
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('api', () => {
  it('returns the parsed body on success', async () => {
    vi.stubGlobal('fetch', fetchStub(() => respond(200, { ok: true })))
    await expect(api<{ ok: boolean }>('/api/health')).resolves.toEqual({ ok: true })
  })

  it('sends the admin token when one is stored, and none when it is not', async () => {
    const fetchMock = fetchStub(() => respond(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await api('/api/products')
    const anonymous = new Headers(fetchMock.mock.calls[0]![1]!.headers)
    expect(anonymous.get('authorization')).toBeNull()

    localStorage.setItem('shop_admin_token', 'tok')
    await api('/api/products')
    const authed = new Headers(fetchMock.mock.calls[1]![1]!.headers)
    expect(authed.get('authorization')).toBe('Bearer tok')
  })

  it('does not set a JSON content-type on FormData, so the boundary survives', async () => {
    const fetchMock = fetchStub(() => respond(200, {}))
    vi.stubGlobal('fetch', fetchMock)
    await api('/api/admin/products/1/photos', { method: 'POST', body: new FormData() })
    const headers = new Headers(fetchMock.mock.calls[0]![1]!.headers)
    expect(headers.get('content-type')).toBeNull()
  })

  it('throws ApiError carrying the envelope code and fieldErrors', async () => {
    vi.stubGlobal(
      'fetch',
      fetchStub(() =>
        respond(400, { error: { code: 'VALIDATION', message: 'bad', fieldErrors: { 'buyer.email': ['invalid'] } } }),
      ),
    )
    const error = await api('/api/checkout', { method: 'POST' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION', fieldErrors: { 'buyer.email': ['invalid'] } })
  })

  it('still throws ApiError when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', fetchStub(() => new Response('<html>502</html>', { status: 502 })))
    const error = await api('/api/checkout').catch((e: unknown) => e)
    // A gateway returning HTML is the shape that breaks a client which assumes `res.json()` works.
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN' })
  })
})
```

> **Amended after Task 1 shipped.** The block above is regenerated from `apps/web/test/app/api-client.test.ts` as built. The original draft wrote `vi.fn(async () => respond(...))` and then read `fetchMock.mock.calls[0]![1]!.headers` — which does not typecheck: `vi.fn` infers a zero-argument mock, so `mock.calls` is `[][]` and index `[1]` is out of range under the repo's `strict: true`. Three of the five tests depend on that read, so the file would have failed `tsc` as written. The `fetchStub` helper types the mock to the shape `fetch` is really called with. **Tasks 2-13: any mock whose arguments you later inspect must declare its parameters.**

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/web && NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --project unit test/app/api-client.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/app/api/client"`.

- [ ] **Step 3: Write the client**

```ts
// apps/web/src/app/api/client.ts
import type { FieldErrors } from '@shop/shared'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: FieldErrors,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; fieldErrors?: FieldErrors }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('shop_admin_token')
  const headers = new Headers(init.headers)
  // FormData must set its own content-type: it carries the multipart boundary, and overwriting
  // it with application/json makes the server parse an empty body.
  if (!(init.body instanceof FormData)) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  // A 502 from a proxy is HTML, not JSON. Swallowing the parse failure is what keeps the thrown
  // value an ApiError the callers can branch on instead of a SyntaxError from deep in the client.
  const data = (await res.json().catch(() => ({}))) as ErrorEnvelope
  if (!res.ok) {
    throw new ApiError(res.status, data.error?.code ?? 'UNKNOWN', data.error?.message ?? 'Request failed', data.error?.fieldErrors)
  }
  return data as T
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: same command.
Expected: PASS, 7 tests / 13 assertions.

- [ ] **Step 5: Prove the assertions can fail**

Mutate, run, restore, and report each result:
1. Drop the `FormData` guard (always set the JSON content-type) → the FormData test must go red.
2. Remove `.catch(() => ({}))` → the non-JSON test must go red (it will throw `SyntaxError`, not `ApiError`).
3. Return `data.error?.code ?? 'UNKNOWN'` as a literal `'UNKNOWN'` → the envelope test must go red.

If any mutation leaves the suite green, the assertion is inert: fix it or delete it.

- [ ] **Step 6: Write the query hooks**

```ts
// apps/web/src/app/api/queries.ts
import type { CheckoutRequest, PublicOrder, PublicProduct } from '@shop/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ApiError, api } from './client'

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: () => api<PublicProduct[]>('/api/products') })
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: ['product', slug], queryFn: () => api<PublicProduct>(`/api/products/${encodeURIComponent(slug)}`) })
}

// The thank-you page lands the instant Stripe redirects, which is before the webhook has
// necessarily been delivered. Poll while the order is still `pending` and stop once it settles;
// `enabled` keeps the query idle until both halves of the credential are present.
const DONE_POLL_MS = 2000

export function useOrder(orderNumber: number | null, sessionId: string | null) {
  return useQuery({
    queryKey: ['order', orderNumber, sessionId],
    queryFn: () => api<PublicOrder>(`/api/orders/${orderNumber}?session_id=${encodeURIComponent(sessionId!)}`),
    enabled: orderNumber != null && sessionId != null,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? DONE_POLL_MS : false),
    retry: false,
  })
}

export function useCheckout() {
  return useMutation<{ url: string; orderNumber: number }, ApiError, CheckoutRequest>({
    mutationFn: (body) => api('/api/checkout', { method: 'POST', body: JSON.stringify(body) }),
  })
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `cd apps/web && npx tsc -p tsconfig.json --noEmit`

```bash
git add apps/web/src/app/api apps/web/test/app/api-client.test.ts
git commit -m "feat(web): add the v2 api client and query hooks"
```

---

### Task 2: `useCart`

**Files:**
- Create: `apps/web/src/app/state/useCart.ts`
- Test: `apps/web/test/app/use-cart.test.ts`

**Interfaces:**
- Produces: `useCart(): { items: CartItem[]; count: number; add(slug): void; setQty(slug, qty): void; remove(slug): void; clear(): void }` where `CartItem` is `@shop/shared`'s `{ slug: string; qty: number }`.

The v1 shipped this as a Context provider. It is a plain hook here, called once in `ShopShellContainer`, which passes the pieces down as props — the same reason `ui/` is stateless applies one level up: a single owner is easier to reason about than an ambient one, and the pages take props either way.

- [ ] **Step 1: Write the failing test**

```ts
import { CART_MAX_DISTINCT, CART_MAX_QTY } from '@shop/shared'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCart } from '../../src/app/state/useCart'

beforeEach(() => localStorage.clear())

describe('useCart', () => {
  it('adds a line and counts units, not lines', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.add('a'))
    act(() => result.current.add('b'))
    expect(result.current.items).toEqual([
      { slug: 'a', qty: 2 },
      { slug: 'b', qty: 1 },
    ])
    expect(result.current.count).toBe(3)
  })

  it('caps a line at CART_MAX_QTY and the cart at CART_MAX_DISTINCT', () => {
    const { result } = renderHook(() => useCart())
    for (let i = 0; i < CART_MAX_QTY + 3; i++) act(() => result.current.add('a'))
    expect(result.current.items[0]!.qty).toBe(CART_MAX_QTY)

    for (let i = 0; i < CART_MAX_DISTINCT + 2; i++) act(() => result.current.add(`slug-${i}`))
    expect(result.current.items.length).toBe(CART_MAX_DISTINCT)
  })

  it('removes the line when the quantity reaches zero', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.setQty('a', 0))
    expect(result.current.items).toEqual([])
  })

  it('sets a quantity directly and clamps it to CART_MAX_QTY', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.setQty('a', 3))
    expect(result.current.items).toEqual([{ slug: 'a', qty: 3 }])

    // `add` is not the only way past the cap. The drawer's stepper is the only caller today, but
    // it passes a number, and a cart the checkout schema rejects is a checkout that 400s.
    act(() => result.current.setQty('a', CART_MAX_QTY + 4))
    expect(result.current.items[0]!.qty).toBe(CART_MAX_QTY)
  })

  it('removes only the named line', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.add('b'))
    act(() => result.current.remove('a'))
    expect(result.current.items).toEqual([{ slug: 'b', qty: 1 }])
  })

  it('persists to localStorage and reloads from it', () => {
    const first = renderHook(() => useCart())
    act(() => first.result.current.add('a'))
    expect(JSON.parse(localStorage.getItem('shop_cart')!)).toEqual([{ slug: 'a', qty: 1 }])

    const second = renderHook(() => useCart())
    expect(second.result.current.items).toEqual([{ slug: 'a', qty: 1 }])
  })

  it('starts empty when the stored value is corrupt rather than throwing', () => {
    localStorage.setItem('shop_cart', '{not json')
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
  })

  it('starts empty when the stored value is valid JSON of the wrong shape', () => {
    // The v1 guarded the parse but not the result: `JSON.parse('"x"')` succeeds and hands the
    // cart a string, and every consumer then reads `.slug` off characters.
    localStorage.setItem('shop_cart', '{"slug":"a"}')
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
  })

  it('drops the stored entries that are not cart items and keeps the ones that are', () => {
    // The array check above is not the same guard as the item check here, and only this shape
    // separates them: it IS an array, so `Array.isArray` passes it and every malformed ELEMENT
    // reaches a consumer that reads `line.qty`. Note an over-cap qty is dropped, not clamped —
    // a stored line the checkout schema would reject is treated as corrupt, not as a big order.
    localStorage.setItem(
      'shop_cart',
      JSON.stringify([{ slug: 'a', qty: 2 }, { nope: 1 }, 'x', null, { slug: 'c', qty: CART_MAX_QTY + 1 }]),
    )
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([{ slug: 'a', qty: 2 }])
  })

  it('clears', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
    expect(JSON.parse(localStorage.getItem('shop_cart')!)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/web && NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --project unit test/app/use-cart.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { CART_MAX_DISTINCT, CART_MAX_QTY, type CartItem, cartItemSchema } from '@shop/shared'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'shop_cart'

// Validated on read, not just parsed. The stored value is user-editable and survives deploys, so
// a shape from an older version — or a hand-edited one — must degrade to an empty cart rather
// than reach the UI as a half-formed line. Both guards are load-bearing and neither implies the
// other: `Array.isArray` rejects a stored object, the per-item schema rejects a bad element
// inside a real array. An item the checkout schema would reject (over-cap qty) is dropped rather
// than clamped — a cart that cannot be ordered is corrupt, not large.
function load(): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const result = cartItemSchema.safeParse(item)
      return result.success ? [result.data] : []
    })
  } catch {
    return []
  }
}

export interface CartApi {
  items: CartItem[]
  count: number
  add(slug: string): void
  setQty(slug: string, qty: number): void
  remove(slug: string): void
  clear(): void
}

export function useCart(): CartApi {
  const [items, setItems] = useState<CartItem[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const add = useCallback((slug: string) => {
    setItems((prev) => {
      const line = prev.find((i) => i.slug === slug)
      if (line) return prev.map((i) => (i.slug === slug ? { ...i, qty: Math.min(i.qty + 1, CART_MAX_QTY) } : i))
      if (prev.length >= CART_MAX_DISTINCT) return prev
      return [...prev, { slug, qty: 1 }]
    })
  }, [])

  const setQty = useCallback((slug: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.slug !== slug)
        : prev.map((i) => (i.slug === slug ? { ...i, qty: Math.min(qty, CART_MAX_QTY) } : i)),
    )
  }, [])

  const remove = useCallback((slug: string) => setItems((prev) => prev.filter((i) => i.slug !== slug)), [])
  const clear = useCallback(() => setItems([]), [])

  return { items, count: items.reduce((n, i) => n + i.qty, 0), add, setQty, remove, clear }
}
```

- [ ] **Step 4: Run it and watch it pass**

Expected: PASS, 10 tests / 15 assertions.

> **Amended after Task 2 shipped.** Both blocks are regenerated from the files as built, and the test count went from 7 to 10. Three changes, all found by the implementer:
>
> 1. **The draft's wrong-shape test did not prove what it claimed.** `localStorage.setItem('shop_cart', '{"slug":"a"}')` is rejected by `Array.isArray`, never reaching the per-item `safeParse` — so removing the schema validation alone left it green. The draft's own parenthetical predicted this and it happened anyway. The fix is a test with a REAL array full of junk (`{nope:1}`, `'x'`, `null`, an over-cap qty), which is the only input that distinguishes the two guards. **Generalise this: a mutation that removes two guards at once cannot tell you either one is load-bearing.**
> 2. `remove()` was never called by any test, and only `add`'s cap was exercised, not `setQty`'s. Both were shipping uncovered.
> 3. `load()` uses `flatMap` rather than `map/filter/map`. The draft's form does compile under TS 5.9's inferred type predicates, but it depends on that inference for its type safety: if it ever fails, `r.data` degrades to `CartItem | undefined` silently and the array gets holes. `flatMap` does not rely on it.
>
> **Decision recorded, not a bug:** an item whose stored qty exceeds `CART_MAX_QTY` is DROPPED, not clamped, because that is what `cartItemSchema` does and a cart the checkout would reject is corrupt rather than large. Clamping is one line if this ever bites.

- [ ] **Step 5: Prove the assertions can fail**

1. Replace the `safeParse` filter with a bare cast → the wrong-shape test must go red. (If it does not, the assertion is checking the parse rather than the validation.)
2. Remove the `Math.min(..., CART_MAX_QTY)` → the cap test must go red.
3. Remove the `prev.length >= CART_MAX_DISTINCT` guard → the distinct cap test must go red.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/state/useCart.ts apps/web/test/app/use-cart.test.ts
git commit -m "feat(web): add the cart hook with validated persistence"
```

---

### Task 3: `useLang`

**Files:**
- Create: `apps/web/src/app/state/useLang.ts`
- Test: `apps/web/test/app/use-lang.test.ts`

**Interfaces:**
- Produces: `useLang(): { lang: 'pt' | 'en'; toggle(): void }`.

This is the ONLY place the language changes. It reads `localStorage['shop_lang']`, falls back to `navigator.language`, defaults to `pt`, and calls `i18n.changeLanguage` on the `src/copy/` instance.

- [ ] **Step 1: Write the failing test**

```tsx
import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLang } from '../../src/app/state/useLang'
import { copyI18n, createCopyInstance } from '../../src/copy/i18n'

// `copyI18n` is deliberately not react-i18next's global default, so a bare `useTranslation()`
// only reaches it through a provider. Without this wrapper the hook gets react-i18next's fallback
// object, whose `changeLanguage` is undefined.
const wrapper = ({ children }: { children: ReactNode }) => <I18nextProvider i18n={copyI18n}>{children}</I18nextProvider>

// jsdom reports `navigator.language` as 'en-US', so a test that leaves it alone starts the hook in
// English and every toggle assertion reads backwards. Each test states the browser it assumes.
function browserLanguage(value: string) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(value)
}

beforeEach(async () => {
  localStorage.clear()
  // The instance is a module singleton shared by every test in this file: without the reset a test
  // inherits whatever language the previous one left behind.
  await copyI18n.changeLanguage('pt')
})

afterEach(() => vi.restoreAllMocks())

describe('useLang', () => {
  it('defaults to pt when nothing is stored and the browser says pt-BR', () => {
    browserLanguage('pt-BR')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('pt')
  })

  it('uses en when the browser is English and nothing is stored', () => {
    browserLanguage('en-GB')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('en')
  })

  it('prefers the stored language over the browser', () => {
    browserLanguage('en-GB')
    localStorage.setItem('shop_lang', 'pt')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('pt')
  })

  it('ignores a stored value that is not a supported language', () => {
    // The browser says English on purpose. With 'pt-BR' here the expected value would be the one
    // the fallback produces anyway, and the test could not tell a rejected 'klingon' from an
    // `initialLang` that never reads storage at all — that case is the test above, and the two
    // guards have to be separable or neither is proved.
    browserLanguage('en-GB')
    localStorage.setItem('shop_lang', 'klingon')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('en')
  })

  it('toggles, persists, and actually changes the i18n instance', async () => {
    browserLanguage('pt-BR')
    const { result } = renderHook(() => useLang(), { wrapper })

    await act(async () => result.current.toggle())

    expect(result.current.lang).toBe('en')
    expect(localStorage.getItem('shop_lang')).toBe('en')
    // The two that matter: without the `changeLanguage` call the toggle flips a label and
    // translates nothing. They are not the same claim — an instance switched to a language it
    // does not ship renders English copy by falling back to the key, which passes the first and
    // fails the second — and the copy one comes first so that a mutation reddens it rather than
    // stopping the test one line earlier. `language`, not `resolvedLanguage`: see the hook.
    expect(copyI18n.t('Add to bag')).toBe('Add to bag')
    expect(copyI18n.language).toBe('en')
  })

  it('toggles back, so it is a flip and not a set', async () => {
    browserLanguage('pt-BR')
    const { result } = renderHook(() => useLang(), { wrapper })

    await act(async () => result.current.toggle())
    await act(async () => result.current.toggle())

    expect(result.current.lang).toBe('pt')
    expect(localStorage.getItem('shop_lang')).toBe('pt')
    // A one-way sync is a real failure shape: the user switches back and keeps reading English.
    expect(copyI18n.t('Add to bag')).toBe('Colocar na sacola')
  })

  it('drives the provided instance, not the imported singleton', async () => {
    browserLanguage('pt-BR')
    // Asserting on the same singleton the wrapper provides cannot distinguish a context read from
    // a hard-coded `import { copyI18n }`; a second instance can. Storybook already provides one
    // instance per locale, so this is the shape the hook will actually meet.
    const provided = createCopyInstance('pt')
    void provided.init()
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }: { children: ReactNode }) => <I18nextProvider i18n={provided}>{children}</I18nextProvider>,
    })

    await act(async () => result.current.toggle())

    expect(provided.language).toBe('en')
    expect(copyI18n.language).toBe('pt')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/web && NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --project unit test/app/use-lang.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGS, type Lang } from '../../copy/i18n'

export type { Lang }

const STORAGE_KEY = 'shop_lang'

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

// Two independent decisions, not one: whether a stored preference exists AND is a language we
// ship, and what to pick when it does not. `shop_lang` is user-editable and survives deploys, so
// an unsupported value degrades to the browser's choice rather than reaching i18next as a
// language with no resources.
function initialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isLang(stored)) return stored
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

/**
 * The only place the language changes. The instance comes from the provider rather than an
 * import, because `src/copy/i18n.ts` deliberately keeps itself out of react-i18next's global
 * default — the hook drives whichever instance its tree was given.
 */
export function useLang(): { lang: Lang; toggle(): void } {
  const { i18n } = useTranslation()
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    // `language`, not `resolvedLanguage`: only pt has a resource bundle (English keys render
    // themselves), and i18next only resolves to a language that HAS translations, so
    // `resolvedLanguage` is undefined while the app is in English. Guarding on it would compare
    // undefined to 'en' and re-issue the call on every run.
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
  }, [lang, i18n])

  const toggle = useCallback(() => setLang((prev) => (prev === 'pt' ? 'en' : 'pt')), [])

  return { lang, toggle }
}
```

- [ ] **Step 4: Run it and watch it pass**

Expected: PASS, 7 tests / 13 assertions.

- [ ] **Step 5: Prove the assertions can fail**

1. Delete the `i18n.changeLanguage` call → the toggle test's last assertion must go red. **This is the assertion the whole hook exists for**; if it stays green, the test is measuring its own `useState` and nothing else.
2. Drop the `isLang` guard → the klingon test must go red.
3. Invert the `startsWith('pt')` → both browser-default tests must go red.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/state/useLang.ts apps/web/test/app/use-lang.test.tsx
git commit -m "feat(web): add the language hook backed by storage and the copy instance"
```

---

### Task 4: `LinkInterceptor`

**Files:**
- Create: `apps/web/src/app/LinkInterceptor.tsx`
- Test: `apps/web/test/app/link-interceptor.test.tsx`

**Interfaces:**
- Produces: `<LinkInterceptor>{children}</LinkInterceptor>` — a capture-phase click handler that upgrades plain same-origin anchor clicks to `navigate()`.

This is what lets every UI component render a real `<a href>` and still get client-side routing. The PR 2 Storybook decorator is its story-side twin, and `AnchorGuard.stories.tsx` already pins the same five fall-through cases in Chromium — **the rules must not drift apart**: modifier keys, non-primary buttons, `target`, `download`, and cross-origin all belong to the browser.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/test/app/link-interceptor.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LinkInterceptor } from '../../src/app/LinkInterceptor'

function renderWithRouter(children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LinkInterceptor>{children}</LinkInterceptor>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/about" element={<p>about page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LinkInterceptor', () => {
  it('navigates client-side for a plain same-origin anchor', async () => {
    renderWithRouter(<a href="/about">About</a>)
    await userEvent.click(screen.getByText('About'))
    expect(await screen.findByText('about page')).toBeInTheDocument()
  })

  it('navigates when the click lands on a child of the anchor', async () => {
    // Real clicks land on the <span>, not the <a>. A handler that reads `event.target` as the
    // anchor works in a story with bare text and fails on every composed component.
    renderWithRouter(<a href="/about"><span>Nested</span></a>)
    await userEvent.click(screen.getByText('Nested'))
    expect(await screen.findByText('about page')).toBeInTheDocument()
  })

  it.each([
    ['a modifier key is held', { href: '/about' }, { ctrlKey: true }],
    ['the anchor has target', { href: '/about', target: '_blank' }, {}],
    ['the anchor has download', { href: '/about', download: '' }, {}],
    ['the anchor is cross-origin', { href: 'https://example.com/x' }, {}],
    ['the href is a mailto', { href: 'mailto:a@b.c' }, {}],
  ])('falls through to the browser when %s', async (_case, anchorProps, clickInit) => {
    const { container } = renderWithRouter(<a {...anchorProps}>Link</a>)
    const anchor = screen.getByText('Link')

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...clickInit })
    anchor.dispatchEvent(event)

    // Not "the route did not change" — that is also true while a navigation is pending. The
    // contract is that the interceptor did not call preventDefault, leaving the click to the
    // browser, which jsdom reports as the event still being cancelable-but-uncancelled.
    expect(event.defaultPrevented).toBe(false)
    expect(container.textContent).toContain('home')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/web && NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --project unit test/app/link-interceptor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/app/LinkInterceptor.tsx
import { type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

/**
 * One click handler at the root upgrades same-origin anchor clicks to client-side navigation, so
 * every component in `ui/` can render a real `<a href>` and none of them imports the router.
 *
 * Everything the browser owns is left to the browser: modifier keys and middle clicks (open in a
 * new tab), `target`, `download`, and any cross-origin or non-http href. `.closest('a')` is what
 * makes it work for composed content, where the click lands on a descendant of the anchor.
 */
export function LinkInterceptor({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const anchor = (event.target as Element | null)?.closest?.('a')
    if (!anchor) return
    if (anchor.target || anchor.hasAttribute('download')) return

    const href = anchor.getAttribute('href')
    if (!href) return

    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return

    event.preventDefault()
    void navigate(url.pathname + url.search + url.hash)
  }

  return <div onClickCapture={onClick}>{children}</div>
}
```

- [ ] **Step 4: Run it and watch it pass**

Expected: PASS, 7 tests (2 + 5 cases).

- [ ] **Step 5: Prove the assertions can fail**

1. Replace `.closest('a')` with `event.target as HTMLAnchorElement` → the nested-child test must go red.
2. Delete the modifier-key guard → the ctrl-key case must go red.
3. Delete the origin comparison → both the cross-origin and the mailto cases must go red.
4. Delete the `target`/`download` guard → those two cases must go red.

- [ ] **Step 6: Check the rules against the story-side twin**

Open `apps/web/src/ui/primitives/AnchorGuard.stories.tsx` and confirm the five fall-through cases it pins are the same five this component implements. If they differ, one of them is wrong — say which and why, and fix that one rather than making the tests agree by weakening either.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/LinkInterceptor.tsx apps/web/test/app/link-interceptor.test.tsx
git commit -m "feat(web): add the root link interceptor"
```

---

## Tasks 5–10: the UI layer

**All six read `2026-09-09-webshop-v2-03-prototype-extract.md` first.** It carries the verbatim pt-BR copy, the token mapping, the per-component structure notes and — most importantly — the list of things the design does not give us and that are therefore being designed here rather than transcribed.

Shared rules for every component task, so they are not repeated six times:

- **Every component gets a `.stories.tsx` beside it**, rendering from `src/fixtures/` only. No network mocks, no `msw`, no hand-built product objects — the fixtures are typed against the real `@shop/shared` schemas and deep-frozen, and a story that needs data the fixtures do not have should extend the fixtures, not inline a literal.
- **The component is stateless.** `useState`, `useEffect`, `useRef`, `useReducer`, `useLayoutEffect` are rejected by `test/ui-boundaries.test.ts`. State the design implies lives in the container (Task 11); the component receives it as props and reports intent through callbacks.
- **Callbacks are `fn()` spies from `storybook/test`** in stories, and every `play` assertion is on a spy call or on the DOM — never on a story's own local variable.
- **A controlled input in a story holds its value in `useState` inside `render`, never `useArgs`.** Under the vitest browser project there is no manager to service `updateArgs`, so `useArgs` fails loudly and the story is red — this is documented in `TextInput.stories.tsx`.
- **Every `t('...')` added needs its `pt.json` entry in the same commit** or `copy.test.ts` fails. Use the six keys planted in PR 2 rather than adding synonyms.
- **Every new assertion is proved able to fail** by mutating what it guards, and the proof is reported with the task.
- **axe runs as an error gate on every story.** At page scale `region`, `heading-order`, `landmark-unique` and `page-has-heading-one` start firing for the first time on this branch. Fix the markup; never disable a rule.
- Reuse the PR 2 primitives (`PillButton`, `Eyebrow`, `Price`, `Stepper`, `RuledList`, `StatusPill`, `ImageFrame`, `TextInput`, `TextArea`, `Select`, `FieldLabel`, `LangToggle`, `Stat`). If a primitive is close but not right, extend it there rather than re-implementing a variant locally — and say what you changed.

Each task ends with: `npx tsc -p tsconfig.json --noEmit`, `NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --project storybook`, an orphan check, and one commit.

---

### Task 5: Shop chrome — `ShopHeader`, `CartLine`, `CartDrawer`

**Files:** create `src/ui/shop/{ShopHeader,CartLine,CartDrawer}.tsx` + stories, `src/ui/shop/index.ts`; modify `src/copy/pt.json`, `src/index.css` (gutter token).

**Interfaces — produced:**

```ts
interface ShopHeaderProps {
  cartCount: number
  lang: 'pt' | 'en'
  onToggleLang(): void
  onOpenCart(): void
}

interface CartLineData {
  slug: string
  name: string        // already resolved for the current language by the parent
  subtitle: string
  unitCents: number
  qty: number
  lineCents: number
}

interface CartLineProps {
  line: CartLineData
  onInc(slug: string): void
  onDec(slug: string): void
}

interface CartDrawerProps {
  open: boolean
  lines: CartLineData[]
  itemsCents: number
  shippingCents: number | null   // null renders the em dash
  totalCents: number
  onInc(slug: string): void
  onDec(slug: string): void
  onClose(): void
}
```

- [ ] **Step 1: Add the gutter token**

The page gutter `clamp(20px,5vw,64px)` appears verbatim six times in the prototype. Add it once to `index.css`'s `@theme` as `--spacing-gutter` and use `px-gutter` everywhere, instead of repeating the arbitrary value.

- [ ] **Step 2: Build `ShopHeader`**

Semantics the prototype lacks and this must add: a real `<header>` containing a real `<nav>`; `Sobre` is an `<a href={routes.about()}>`; the brand is an `<a href={routes.home()}>`; the bag is a `<button>` (it opens a drawer, it does not navigate). The `Admin` nav item is **dropped** — spec:11 makes the admin unlinked.

The bag button must announce its count to assistive tech, not just show it: `Sacola (2)` read as "Bag 2" is fine, `Sacola` with a visual 2 is not.

- [ ] **Step 3: Story — the header reports intent**

```tsx
export const OpensTheBag: Story = {
  args: { cartCount: 2, lang: 'pt', onOpenCart: fn(), onToggleLang: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /sacola/i }))
    await expect(args.onOpenCart).toHaveBeenCalledOnce()
  },
}

export const AboutIsAnAnchorNotAButton: Story = {
  args: { cartCount: 0, lang: 'pt', onOpenCart: fn(), onToggleLang: fn() },
  play: async ({ canvas }) => {
    // The whole navigation design rests on this: real hrefs, upgraded by LinkInterceptor.
    // A <button onClick> here would still "work" in the app and break cmd-click, crawling
    // and the middle-click that AnchorGuard.stories.tsx pins.
    await expect(canvas.getByRole('link', { name: /sobre/i })).toHaveAttribute('href', '/about')
  },
}
```

- [ ] **Step 4: Build `CartLine` and `CartDrawer`**

Two decisions the prototype forces and that must be made here, not deferred:

1. **The empty drawer.** The prototype renders the totals footer and an *enabled* checkout CTA over an empty bag, and clicking it opens a checkout with nothing in it. Do not reproduce that. Show `A sacola está vazia.` and either hide the CTA or disable it — pick one, implement it, and say which.
2. **The quantity cap.** `useCart` silently refuses to go past `CART_MAX_QTY`, so the `+` control appears to do nothing at the cap. Either disable `+` at the cap or explain it. Silence is the one option that is not acceptable.

The drawer is `role="dialog"` with `aria-modal="true"` and an accessible name from its `Sua sacola` heading. It **cannot** trap focus or handle Escape itself — those need effects, which the purity rule forbids. Task 11 owns them; note it in the component so the next reader does not think it was forgotten.

Use the `Stepper` primitive rather than rebuilding the three-cell control.

- [ ] **Step 5: Stories — the drawer's behaviour**

```tsx
export const IncrementsAndDecrementsBySlug: Story = {
  args: { open: true, lines: [/* two fixture lines */], onInc: fn(), onDec: fn(), onClose: fn(), /* totals */ },
  play: async ({ args, canvas, userEvent }) => {
    const second = canvas.getAllByRole('group', { name: /quantidade/i })[1]!
    await userEvent.click(within(second).getByRole('button', { name: '+' }))
    // The slug, not just "it fired": a drawer that reports the wrong line is worse than one
    // that reports nothing, and a bare toHaveBeenCalled() passes for both.
    await expect(args.onInc).toHaveBeenCalledWith(args.lines[1]!.slug)
  },
}

export const Empty: Story = { /* asserts the message AND that no enabled checkout CTA exists */ }
export const ShippingUnknownShowsAnEmDash: Story = { /* shippingCents: null */ }
```

- [ ] **Step 6: Prove, verify, commit**

Mutations to run: swap `onInc`/`onDec` (the by-slug test must redden); make the empty drawer render an enabled CTA (the empty test must redden); render the em dash unconditionally (that story must redden).

```bash
git add apps/web/src/ui/shop apps/web/src/copy/pt.json apps/web/src/index.css
git commit -m "feat(web): add the shop header and the cart drawer"
```

---

### Task 6: Home components — `Hero`, `FeaturedCard`, `ProductCard`, `CatalogGrid`, `ClosingBlock`

**Files:** create the five components + stories in `src/ui/shop/`; modify `src/ui/shop/index.ts`, `src/copy/pt.json`.

**Interfaces — produced:**

```ts
interface HeroProps { featured: PublicProduct | null; lang: 'pt' | 'en' }
interface FeaturedCardProps { product: PublicProduct; lang: 'pt' | 'en' }
interface ProductCardProps { product: PublicProduct; lang: 'pt' | 'en' }
interface CatalogGridProps { products: readonly PublicProduct[]; lang: 'pt' | 'en' }
interface ClosingBlockProps { contactEmail: string }
```

- [ ] **Step 1: Build them**

Notes that matter, all from the extract: the catalog grid is `auto-**fill**` where everything else is `auto-fit`; the product card is a real `<a href={routes.product(slug)}>` wrapping the whole card, not a div with onClick; the hero's `<em>` wraps exactly `faço com as mãos`; `ClosingBlock`'s link becomes a real `mailto:` built with `routes.mailto(contactEmail, ...)` — the design has `href="#"` and no address anywhere.

`CatalogGrid` with zero products needs an empty state the design does not have. Write one in the established language; do not render an empty grid.

- [ ] **Step 2: Stories**

`Hero` (with a featured product, and with `featured: null` — the API returns no featured product until one is flagged), `ProductCard` (in stock, made to order, sold out, digital), `CatalogGrid` (full catalogue, single item, empty), `ClosingBlock`.

```tsx
export const CardLinksToTheProduct: Story = {
  args: { product: letter, lang: 'pt' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link')).toHaveAttribute('href', `/exhibit/${letter.slug}`)
  },
}

export const SoldOutIsStatedNotJustStyled: Story = {
  args: { product: { ...letter, stock: 0 }, lang: 'pt' },
  play: async ({ canvas }) => {
    // Availability communicated by colour or position alone fails WCAG 1.4.1 and is invisible
    // to a screen reader. The text is the contract.
    await expect(canvas.getByText('Esgotado')).toBeInTheDocument()
  },
}
```

- [ ] **Step 3: Prove, verify, commit**

Mutations: point the card href at `routes.home()`; render the sold-out label unconditionally (the story must still pass for the in-stock case — if it does not, the assertion was checking the wrong thing).

```bash
git commit -m "feat(web): add the home hero, catalog grid and closing block"
```

---

### Task 7: Product components — `ProductGallery`, `SpecsTable`

**Files:** create both + stories; modify `index.ts`, `pt.json`.

**Interfaces — produced:**

```ts
interface ProductGalleryProps {
  product: PublicProduct
  lang: 'pt' | 'en'
  selectedPhoto: number          // index into product.photos
  onSelectPhoto(index: number): void
}
interface SpecsTableProps { specs: PublicProduct['specs']; lang: 'pt' | 'en' }
```

- [ ] **Step 1: Build them**

`SpecsTable` is a `<dl>`/`<dt>`/`<dd>`, not divs — it is literally a description list, and the semantics are free. The key is uppercased and `opacity-55`; the value is `text-right` at full opacity and keeps its casing.

`ProductGallery` adds selection, which the prototype does not have: the thumbs are `<button>`s, the selected one has a visible indicator that is **not** opacity alone, and the current selection is announced (`aria-pressed` or an equivalent). Alt text comes from `photo.alt[lang]` when present; when it is absent, decide between the planted `Photo of {{name}}` key and an empty `alt` for a decorative image — and say which, because Task 12 resolves that key either way.

A product with **no photos** must render the paper-coloured placeholder from spec:219, not a broken image.

- [ ] **Step 2: Stories**

`ProductGallery`: three photos with the first selected, third selected, single photo (no thumb row), no photos at all. `SpecsTable`: four specs, one spec, and the empty case.

```tsx
export const SelectingAThumbReportsItsIndex: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: /detalhe|foto/i })[1]!)
    await expect(args.onSelectPhoto).toHaveBeenCalledWith(1)
  },
}

export const TheSelectedThumbIsDistinguishableWithoutColour: Story = {
  play: async ({ canvas }) => {
    const [first, second] = canvas.getAllByRole('button')
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(second).toHaveAttribute('aria-pressed', 'false')
  },
}
```

- [ ] **Step 3: Prove, verify, commit**

Mutations: hard-code index `0` in the click handler; drop `aria-pressed`. Both must redden.

```bash
git commit -m "feat(web): add the product gallery and specs table"
```

---

### Task 8: About components — `AboutBlocks`, `AboutFacts`, `AboutClosing`

**Files:** create the three + stories; modify `index.ts`, `pt.json`.

**Interfaces — produced:**

```ts
interface AboutBlock { tag: string; title: string; body: string }
interface AboutBlocksProps { blocks: readonly AboutBlock[] }
interface AboutFact { value: string; label: string }
interface AboutFactsProps { facts: readonly AboutFact[] }
interface AboutClosingProps { contactEmail: string }
```

- [ ] **Step 1: Decide where the About content lives**

The three blocks and four facts are hardcoded in the prototype. They are copy, so they belong in `pt.json` behind `t()` calls, with the components taking the resolved strings as props — which is what the interfaces above say. The alternative (a `fixtures/about.ts`) makes them data that is never translated. Choose the `t()` route unless you find a reason not to, and record it.

`4 peças no catálogo` goes stale the moment a fifth product exists. Either derive that one fact from the catalogue length in the container, or accept it as static copy — decide and say which.

- [ ] **Step 2: Build, with real heading levels**

The page has one `<h1>` (the About hero) and the three blocks are `<h2>`. The prototype's closing heading is a `<div>`; make it an `<h2>` too. `heading-order` will fail on any skip, and this is the first page on the branch with enough headings for it to fire.

`AboutFacts` is `<dl>` again: the value is the `<dd>`, the label the `<dt>` — note the visual order is value-then-label, which is the reverse of the DOM order a `<dl>` wants. Use `flex-col-reverse` rather than lying about which is which.

- [ ] **Step 3: Stories, prove, commit**

One story each, plus `AboutFacts` with a single fact (the grid must not collapse oddly).

```bash
git commit -m "feat(web): add the about page components"
```

---

### Task 9: Checkout sections and the summary panel

The largest component task, and the one with the most that is designed rather than transcribed: the prototype has **no error, validation, loading or disabled states at all**.

**Files:** create `CheckoutBuyerSection`, `CheckoutAddressSection`, `CheckoutShippingSection`, `CheckoutNotesSection`, `CheckoutPaymentSection`, `OrderSummaryPanel` + stories; modify `index.ts`, `pt.json`.

**Interfaces — produced:**

```ts
// One shape for all four form sections, so the page wires them identically.
interface SectionProps<T> {
  values: T
  errors: FieldErrors            // from @shop/shared, keyed 'buyer.email', 'shippingAddress.postalCode', …
  onChange(field: string, value: string): void
}

type BuyerValues = { name: string; email: string; phone: string }
type AddressValues = { country: string; postalCode: string; street: string; number: string; complement: string; district: string; city: string; state: string }
type NotesValues = { notes: string; giftMessage: string; referral: string }

interface CheckoutShippingSectionProps {
  options: readonly ShippingMethodInfo[]   // from shippingOptionsFor(country)
  selected: ShippingMethod | null
  lang: 'pt' | 'en'
  errors: FieldErrors
  onSelect(method: ShippingMethod): void
}

interface OrderSummaryPanelProps {
  lines: CartLineData[]
  itemsCents: number
  shippingCents: number | null
  totalCents: number
  shippingMethodName: string | null
  lang: 'pt' | 'en'
  submitting: boolean
  submitError: string | null
  onSubmit(): void
}
```

- [ ] **Step 1: The address section is country-aware**

Brazil shows CEP / bairro / estado; other countries show the generic fields. This is not cosmetic — `checkoutRules` enforces `invalid_cep`, `required` number, `required` district and `invalid_state` **only** when `country === 'BR'`, so a form that shows Brazilian fields for France collects data the API will reject and hides fields it requires.

- [ ] **Step 2: Errors are announced, not just coloured**

`FieldErrors` is `Record<string, string[]>` with **stable codes** (`required`, `invalid_cep`, `not_allowed`, `invalid_state`, `not_available`), because the API emits codes and the web translates them. Zod's own errors are raw English prose. **One translation table handles both** — write it once here, keyed by code, with a fallback that renders the raw message rather than swallowing it.

Use `TextInput`'s `error` prop, which PR 2 already wired to `aria-errormessage` and proved with `toHaveAccessibleErrorMessage`.

- [ ] **Step 3: Shipping options are real radios**

`<input type="radio">` in a `<fieldset>` with a `<legend>`, keyboard-navigable, with a visible focus ring. The prototype's 11px dot is the *visual*, not the mechanism. Measure the selected dot's contrast against its row: an 11px indicator is a non-text element and needs 3:1 under WCAG 1.4.11.

- [ ] **Step 4: Stories — the states the design never drew**

`CheckoutBuyerSection`: empty, filled, with errors on every field. `CheckoutAddressSection`: BR empty, BR filled, international filled, with errors. `CheckoutShippingSection`: BR (PAC and SEDEX), international (one option), none selected with a `required` error. `OrderSummaryPanel`: normal, submitting (button disabled and labelled as busy), `submitError` set, empty cart.

```tsx
export const CountryDrivesTheFields: Story = {
  args: { values: { ...FR_ADDRESS, country: 'FR' }, errors: {}, onChange: fn() },
  play: async ({ canvas }) => {
    await expect(canvas.queryByLabelText(/cep/i)).not.toBeInTheDocument()
    await expect(canvas.getByLabelText(/código postal|postal code/i)).toBeInTheDocument()
  },
}

export const SubmittingDisablesTheButton: Story = {
  args: { submitting: true, onSubmit: fn() },
  play: async ({ args, canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: /pagar/i })
    await expect(button).toBeDisabled()
    await userEvent.click(button)
    // Double-submitting a checkout creates two pending orders and two Stripe sessions.
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}
```

- [ ] **Step 5: Prove, verify, commit**

Mutations: render the BR fields unconditionally; drop the `disabled` while submitting; remove `aria-errormessage` wiring. Each must redden its story.

```bash
git commit -m "feat(web): add the checkout sections and order summary"
```

---

### Task 10: Pages — `ShopShell`, `HomePage`, `ProductPage`, `AboutPage`, `CheckoutPage`, `DonePage`

**Files:** create the six + stories in `src/ui/pages/`, plus `src/ui/pages/index.ts`; modify `pt.json`.

Pages are pure compositions: they take fully-resolved props and render components. No data fetching, no state, no routing. This is what makes a full-page Storybook possible without a single mock, which is the thing Augusto asked for.

**Interfaces — produced:** each page takes the union of what its components need, plus `lang`. `ShopShell` takes `header` props, `drawer` props and `children`.

- [ ] **Step 1: Build the pages**

Landmarks matter now: `ShopShell` renders `<header>` and a single `<main>`; pages render their content inside it. `region` fails on any content outside a landmark, `landmark-unique` on a second `<main>`, and `page-has-heading-one` on a page with no `<h1>` — `DonePage`'s headline is a `<div>` in the prototype and must become one.

`DonePage` needs three states, and they are not decorative: `pending` (the webhook has not landed; the polling copy), `paid` (the real thing), and the give-up state after ~30s — spec: "still confirming, check your receipt".

- [ ] **Step 2: Stories — the full set spec:231 asks for**

Home (full catalog, empty), Product (gallery, no photos, sold out, digital), Checkout (empty, BR filled, international filled, validation errors, submitting, out-of-stock error), Done (pending, paid). Any state on that list without a story is a gap to report, not to skip.

These are the stories that make the Storybook a design review surface rather than a component catalogue — they are the deliverable, not a by-product.

- [ ] **Step 3: One page-level interaction test**

```tsx
export const AddingFromTheProductPageReportsTheSlug: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /colocar na sacola/i }))
    await expect(args.onAddToCart).toHaveBeenCalledWith(args.product.slug)
  },
}
```

- [ ] **Step 4: Verify and commit**

Expect axe failures here that never appeared on primitives. Fix the markup, list what fired and what you changed.

```bash
git commit -m "feat(web): add the storefront pages"
```

---

### Task 11: Containers

**Files:** create `src/app/ShopShellContainer.tsx` and `src/app/routes/{Home,Product,About,Checkout,Done}Route.tsx`; test `apps/web/test/app/containers.test.tsx`.

Containers are the only place with state, effects, IO and routing. They are thin: resolve data, hold state, pass props, handle intent.

- [ ] **Step 1: `ShopShellContainer`**

Owns `useCart`, `useLang`, and `drawerOpen`. Opens the drawer on add-to-cart and on the header's bag button. **This is where the drawer's Escape handler and focus management live** — the component cannot do it, and Task 5 recorded that. Render `<Outlet/>` for the child routes.

- [ ] **Step 2: `CheckoutRoute` — the one with real logic**

Validates with `checkoutRequestSchema` + `checkoutRules` against the loaded catalogue, so the browser rejects exactly what the API would. Shipping options derive from `values.shippingAddress.country` via `shippingOptionsFor`. Totals come from `computeTotals` and are **display only**. The address and shipping sections are hidden entirely for a digital-only cart (`hasPhysicalItems` is false). On submit: POST, then `window.location.assign(url)`. On `OUT_OF_STOCK` / `UNKNOWN_ITEM`: remove the offending line and show the message, as v1 did.

- [ ] **Step 3: `DoneRoute`**

Reads `?order=` and `?session_id=`. Clears the cart the moment the order is found — not on mount, or a refresh with a failed lookup empties a valid cart. Polls while `pending` (the `useOrder` hook already does this), and after ~30s shows the "still confirming" state rather than polling forever.

- [ ] **Step 4: Container tests — `fetch` stubbed at the boundary, everything else real**

A real `QueryClient` (with `retry: false`), a real `MemoryRouter`, real hooks. `fetch` is the only fake. This is the layer where the wiring can be wrong in ways no story can catch.

```tsx
// apps/web/test/app/containers.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyI18n } from '../../src/copy/i18n'
import { digitalLetter, letter } from '../../src/fixtures/products'
import { CheckoutRoute } from '../../src/app/routes/CheckoutRoute'
import { DoneRoute } from '../../src/app/routes/DoneRoute'

// `retry: false` matters: with the default the error-path tests wait through three retries and
// time out instead of failing, which reads as a flake rather than a broken assertion.
function renderAt(path: string, element: React.ReactElement, routePath: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={copyI18n}>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path={routePath} element={element} /></Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', spy)
  return spy
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('CheckoutRoute', () => {
  it('hides the address and shipping sections for a digital-only cart', async () => {
    localStorage.setItem('shop_cart', JSON.stringify([{ slug: digitalLetter.slug, qty: 1 }]))
    stubFetch(() => json([digitalLetter]))
    renderAt('/checkout', <CheckoutRoute />, '/checkout')

    await screen.findByText(/quem está comprando/i)
    // hasPhysicalItems is false, so checkoutRules asks for neither — showing them would collect
    // an address the API will ignore and block a valid submit on fields it never required.
    expect(screen.queryByText(/endereço de entrega/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/envio/i)).not.toBeInTheDocument()
  })

  it('lists PAC and SEDEX for BR and only the international option otherwise', async () => {
    localStorage.setItem('shop_cart', JSON.stringify([{ slug: letter.slug, qty: 1 }]))
    stubFetch(() => json([letter]))
    renderAt('/checkout', <CheckoutRoute />, '/checkout')

    await screen.findByLabelText(/país/i)
    expect(await screen.findByRole('radio', { name: /pac/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /sedex/i })).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText(/país/i))
    await userEvent.type(screen.getByLabelText(/país/i), 'FR')
    await waitFor(() => expect(screen.queryByRole('radio', { name: /pac/i })).not.toBeInTheDocument())
    expect(screen.getByRole('radio', { name: /internacional|international/i })).toBeInTheDocument()
  })

  it('does not POST when checkoutRules rejects the form', async () => {
    localStorage.setItem('shop_cart', JSON.stringify([{ slug: letter.slug, qty: 1 }]))
    const fetchSpy = stubFetch(() => json([letter]))
    renderAt('/checkout', <CheckoutRoute />, '/checkout')

    await userEvent.click(await screen.findByRole('button', { name: /pagar/i }))

    expect(await screen.findByText(/obrigatório|required/i)).toBeInTheDocument()
    // The assertion that matters: not "an error appeared" but "nothing was sent". A form that
    // shows errors AND posts anyway creates a pending order per click.
    expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it('removes only the offending line on OUT_OF_STOCK and keeps the rest', async () => {
    localStorage.setItem('shop_cart', JSON.stringify([
      { slug: letter.slug, qty: 1 },
      { slug: digitalLetter.slug, qty: 1 },
    ]))
    stubFetch((url, init) => {
      if (init?.method === 'POST') {
        return json({ error: { code: 'OUT_OF_STOCK', message: 'sem estoque', fieldErrors: { slug: [letter.slug] } } }, 409)
      }
      return json([letter, digitalLetter])
    })
    renderAt('/checkout', <CheckoutRoute />, '/checkout')

    await screen.findByText(letter.name.pt)
    // …fill the form and submit…

    await waitFor(() => expect(screen.queryByText(letter.name.pt)).not.toBeInTheDocument())
    expect(screen.getByText(digitalLetter.name.pt)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('shop_cart')!)).toEqual([{ slug: digitalLetter.slug, qty: 1 }])
  })
})

describe('DoneRoute', () => {
  it('clears the cart only once the order lookup succeeds', async () => {
    localStorage.setItem('shop_cart', JSON.stringify([{ slug: letter.slug, qty: 1 }]))
    stubFetch(() => json({ error: { code: 'ORDER_NOT_FOUND', message: 'no' } }, 404))
    renderAt('/thanks?order=413&session_id=cs_test', <DoneRoute />, '/thanks')

    await screen.findByText(/não encontrei|not found|confirmando/i)
    // Clearing on mount would empty a valid cart on any refresh whose lookup fails — a wrong
    // session id in a shared link is enough.
    expect(JSON.parse(localStorage.getItem('shop_cart')!)).toHaveLength(1)
  })

  it('clears the cart when the order is found', async () => {
    localStorage.setItem('shop_cart', JSON.stringify([{ slug: letter.slug, qty: 1 }]))
    stubFetch(() => json({ orderNumber: 413, status: 'paid', items: [], totalCents: 4500, currency: 'brl', shippingMethod: 'pac', eta: null }))
    renderAt('/thanks?order=413&session_id=cs_test', <DoneRoute />, '/thanks')

    await waitFor(() => expect(JSON.parse(localStorage.getItem('shop_cart')!)).toEqual([]))
  })
})
```

The two `DoneRoute` tests are a pair on purpose: either alone passes for a broken implementation. "Does not clear on failure" passes for a container that never clears at all; "clears on success" passes for one that clears on mount. Only together do they pin the actual rule.

**Added after Task 1.** `useOrder`'s two real decisions — `refetchInterval` stopping once the status leaves `pending`, and `enabled` gating on both halves of the credential — shipped in Task 1 with no coverage at all, because Task 1 only asked for a client test. That was a gap in this plan, not in the implementation. It is closed here, at the container, because the observable behaviour is what matters and because a hook test would need its own `QueryClient` harness to say the same thing:

```tsx
it('stops polling once the order is no longer pending', async () => {
  vi.useFakeTimers()
  let status = 'pending'
  const fetchSpy = stubFetch(() => json({ orderNumber: 413, status, items: [], totalCents: 4500, currency: 'brl', shippingMethod: 'pac', eta: null }))
  renderAt('/thanks?order=413&session_id=cs_test', <DoneRoute />, '/thanks')

  await vi.advanceTimersByTimeAsync(2100)
  const whilePending = fetchSpy.mock.calls.length
  expect(whilePending).toBeGreaterThan(1)

  status = 'paid'
  await vi.advanceTimersByTimeAsync(2100)
  const afterPaid = fetchSpy.mock.calls.length

  // The assertion is that it STOPS. Asserting only "it polled while pending" passes for a
  // container that polls forever, which is the actual failure mode: a tab left open on the
  // thank-you page hitting the API every two seconds until it is closed.
  await vi.advanceTimersByTimeAsync(6000)
  expect(fetchSpy.mock.calls.length).toBe(afterPaid)
  vi.useRealTimers()
})

it('never calls the API without both the order number and the session id', async () => {
  const fetchSpy = stubFetch(() => json({}))
  renderAt('/thanks?order=413', <DoneRoute />, '/thanks')
  await screen.findByText(/./)
  // The session id is the order's password — spec: it is what stops order numbers being
  // enumerated. A request fired without it is a request that cannot succeed and should not exist.
  expect(fetchSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 5: Prove, verify, commit**

The `OUT_OF_STOCK` and cart-clearing tests are the two most likely to pass for the wrong reason — mutate the handler to clear the whole cart, and to clear on mount, and confirm each reddens.

```bash
git commit -m "feat(web): add the storefront containers"
```

---

### Task 12: The switch — new entry points, wipe the v1 app, repair e2e

Everything before this task was additive. This is the one commit where the v1 app stops existing and the v2 app takes over the two files they both want. Do it in the order below: write the replacements first, verify the app boots, and only then delete — so that at no point is the tree in a state where neither app works.

**Files:**
- Create: `apps/web/src/main.tsx` (replaces the v1 file of the same name), `apps/web/src/App.tsx` (same)
- Delete: `apps/web/src/components/`, `apps/web/src/i18n/`, `apps/web/src/lib/`, `apps/web/src/pages/`
- Delete: `apps/web/test/{admin-login,api,cart-page,cart,i18n,storefront,thanks}.test.{ts,tsx}`
- Modify: `e2e/shop.spec.ts`
- Modify: `apps/web/src/copy/pt.json` (resolve `Photo of {{name}}`)

**Interfaces:**
- Consumes: everything from Tasks 1–11.
- Produces: a booting v2 app. Nothing later depends on its exports.

> **This task deletes files. Before running any `rm`, confirm out loud: the branch is `feat/v2-web-storefront`, `git status` is clean apart from this task's own work, and the deletions match the list above exactly — no `src/ui`, no `src/copy`, no `src/fixtures`, and none of the six surviving test files.** The list is not a suggestion; PR 2's output lives in the same directory and a wildcard takes it with the rest.

- [ ] **Step 1: Write the new entry points**

```tsx
// apps/web/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router'
import App from './App'
import { copyI18n } from './copy/i18n'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={copyI18n}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

```tsx
// apps/web/src/App.tsx
import { Navigate, Route, Routes } from 'react-router'
import { LinkInterceptor } from './app/LinkInterceptor'
import { ShopShellContainer } from './app/ShopShellContainer'
import { AboutRoute } from './app/routes/AboutRoute'
import { CheckoutRoute } from './app/routes/CheckoutRoute'
import { DoneRoute } from './app/routes/DoneRoute'
import { HomeRoute } from './app/routes/HomeRoute'
import { ProductRoute } from './app/routes/ProductRoute'

// Shop routes only. The admin is rebuilt in PR 4 and its routes arrive with it; until then
// /admin* falls into the catch-all. `ui/routes.ts` keeps its admin href builders — they are
// strings, and nothing in the shop renders them (the design drops the Admin nav item entirely).
export default function App() {
  return (
    <LinkInterceptor>
      <Routes>
        <Route element={<ShopShellContainer />}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/exhibit/:slug" element={<ProductRoute />} />
          <Route path="/about" element={<AboutRoute />} />
          <Route path="/checkout" element={<CheckoutRoute />} />
          <Route path="/thanks" element={<DoneRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LinkInterceptor>
  )
}
```

- [ ] **Step 2: Boot it before deleting anything**

Run: `cd apps/web && npm run dev` and open `http://localhost:5173`. Walk: home → a product → add to bag → drawer → checkout → back. Confirm the language toggle switches copy and survives a reload.

This is the only manual step in the plan, and it is here on purpose: the deletion below is irreversible within the commit, and a container wired to the wrong prop typechecks fine. Report what you saw. Stop the dev server before continuing.

- [ ] **Step 3: Delete the v1 app**

```bash
cd /Users/augustopereira/dev/handmade-portfolio
git rm -r apps/web/src/components apps/web/src/i18n apps/web/src/lib apps/web/src/pages
git rm apps/web/test/admin-login.test.tsx apps/web/test/api.test.ts apps/web/test/cart-page.test.tsx \
       apps/web/test/cart.test.tsx apps/web/test/i18n.test.ts apps/web/test/storefront.test.tsx \
       apps/web/test/thanks.test.tsx
```

`git rm` rather than `rm`: it stages the deletion and refuses if the file has uncommitted changes, which is exactly the guard wanted here.

- [ ] **Step 4: Confirm nothing still points at the deleted code**

```bash
grep -rn "from '\./lib/\|from '\.\./lib/\|src/lib\|src/pages\|src/components\|from '\./i18n'\|i18next-browser-languagedetector" apps/web/src apps/web/test e2e || echo "no dangling references"
```

Expected: `no dangling references`. If `i18next-browser-languagedetector` is now unused, remove it from `apps/web/package.json` in this commit — the v2 language detection is `useLang`, and a dependency nothing imports is a dependency nobody audits.

- [ ] **Step 5: Resolve the dead copy key**

`Photo of {{name}}` was planted in PR 2 and `ImageFrame` takes `alt` as a prop, so nothing calls it. Decide and act, do not leave it: if the product gallery ends up needing a generated alt for photos with no `alt` in the data, use it there; otherwise delete the key from `pt.json`. Say which you did and why.

- [ ] **Step 6: Rewrite the e2e suite for the v2 flow**

```ts
// e2e/shop.spec.ts
import { expect, test } from '@playwright/test'

test('catalog → product → bag drawer shows the line and the totals', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /carta escrita à mão/i }).click()
  await expect(page).toHaveURL(/\/exhibit\//)
  await page.getByRole('button', { name: /colocar na sacola/i }).click()

  const drawer = page.getByRole('dialog', { name: /sacola/i })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText(/carta escrita à mão/i)).toBeVisible()
  await expect(drawer.getByText(/total/i)).toBeVisible()
})

test('admin logs in and sees seeded products', async ({ page }) => {
  test.skip(true, 'the admin app is deleted in PR 3 and rebuilt in PR 4')
  await page.goto('/admin')
})

test('checkout reaches Stripe', async ({ page }) => {
  test.skip(true, 'v1 web checkout is incompatible with the v2 API; re-enabled in PR 5')
  await page.goto('/')
})
```

The first test's selectors come from the real fixtures the seed loads — if the seeded catalogue's first product is not the handwritten letter, use whatever it actually is rather than changing the seed to fit the test.

- [ ] **Step 7: Run everything**

```bash
cd /Users/augustopereira/dev/handmade-portfolio
npm run typecheck
NODE_OPTIONS=--max-old-space-size=4096 npm test
NODE_OPTIONS=--max-old-space-size=4096 npm run build
NODE_OPTIONS=--max-old-space-size=4096 npm run build-storybook -w @shop/web
npm run e2e
ps ax -o pid,ppid,command | grep -i vitest | grep -v grep
```

Expected: typecheck clean in three workspaces; every vitest project green; both builds clean; e2e 1 passed / 2 skipped; no orphaned workers.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/src apps/web/test e2e apps/web/package.json
git commit -m "feat(web): switch the app over to the v2 storefront and delete v1"
```

---

### Task 13: Autodocs decision and the branch sweep

**Files:**
- Modify: `apps/web/.storybook/main.ts` (only if autodocs is turned on)
- Modify: `docs/superpowers/specs/2026-09-07-webshop-v2-design.md` (record whichever way it goes)

- [ ] **Step 1: Decide autodocs**

spec:229 says autodocs is specified but was never enabled — PR 2's built index carries story entries and zero docs entries, and the spec says to "turn it on in PR 3 or drop the requirement deliberately". Decide now with the full component set in hand: `tags: ['autodocs']` in `.storybook/main.ts` generates a docs page per component from its props and stories.

Enable it only if the generated pages are actually useful for these components; if they are not, amend the spec to drop the requirement and say why. Either way the spec stops carrying an unmet claim. **Do not leave this open a third time.**

- [ ] **Step 2: Sweep the branch for the failure modes PR 2 paid for**

Check each, and report findings rather than a clean bill of health:

1. **Unfailable assertions.** Every `expect` added on this branch: can you name the mutation that reddens it? For any you cannot, mutate and find out. Delete the ones that survive everything.
2. **Assertions that pass for the wrong reason.** Chiefly: a story asserting on text that the component renders unconditionally, and a contrast assertion comparing two file-local constants rather than a measured value.
3. **`t()` calls with no `pt.json` entry**, and `pt.json` entries nothing calls. The copy test catches the first; the second needs `grep`. Report unused keys — some are legitimately planted for PR 4, and those should be named as such rather than silently kept.
4. **Components that took local state** to make a story work. The purity test catches hooks by name; it does not catch a component that asks its parent for state it should not need.
5. **Story coverage against spec:231** — Home (full catalog, empty), Product (gallery, no photos, sold out, digital), Checkout (empty, BR filled, international filled, validation errors, submitting, out-of-stock error), Done (pending, paid). Name any listed state with no story.

- [ ] **Step 3: Regenerate the plan's code blocks from the shipped files**

Every code block in this plan that claims to be a file's contents must match that file as shipped, or be explicitly marked as an intermediate state. PR 2 shipped twelve stale blocks because prose was amended and the block underneath it was not; the fix is to generate the blocks from the files rather than edit them by hand.

- [ ] **Step 4: Final verification and commit**

Run the full Task 12 Step 7 battery once more, then:

```bash
git add -A
git commit -m "docs: record the autodocs decision and resync the plan with the shipped files"
```

---

## Self-review notes (author, at plan time)

- **Spec coverage:** every screen in "Scope by screen" that belongs to the shop maps to a task (header/drawer → 5, Home → 6, Product → 7, About → 8, Checkout → 9, Done → 10). The five admin rows are PR 4 and are deliberately absent. "Forms and UI state" maps to Tasks 9 and 11; "Navigation" to Task 4; "i18n" to Task 3 plus the per-task `pt.json` rule.
- **Known gap, deliberate:** the spec's `useCart` limits are enforced in the hook but the DRAWER can still show a quantity stepper at the cap with no explanation. Task 5 must decide whether hitting `CART_MAX_QTY` is silent or explained, and say which.
- **Risk carried into Task 5:** `CartDrawer` is a modal-ish surface and the purity rule forbids `useRef`/`useEffect`, so it cannot trap focus or close on Escape by itself. Both belong in `ShopShellContainer`. axe does not test focus trapping, so this will not fail a gate — it will simply be missing unless the container does it. Task 11 owns it.
