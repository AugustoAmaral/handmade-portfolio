# My Handmade Portfolio v2 — Design refresh, in-app checkout, Storybook (Design)

**Date:** 2026-09-07
**Status:** approved (design), pending implementation plan
**Supersedes:** `docs/design.md` (v1, 2026-08-22) for everything it contradicts. v1 decisions not mentioned here still hold (Stripe-hosted Checkout, MERN in TypeScript, zero-cost infra, single env-credentialed admin, no buyer accounts).
**Visual source of truth:** `design-claude-design/My Handmade Portfolio.dc.html` — an interactive prototype exported from Claude Design and approved by Augusto. Open it in a browser (it loads React from unpkg). Its copy (pt-BR) is canonical; the English copy is written during implementation. The `.image-slots.state.json` and `.thumbnail` files next to it contain Augusto's photos and are git-ignored.

## Context

v1 shipped and is live (`shop.augustoamaral.com`, API on Render, Atlas M0, R2). It works, but the frontend is default-Tailwind grey, every page is coupled to data fetching and routing, and the buyer's address only exists after Stripe collects it on the hosted page. The approved design adds a real checkout page, a cart drawer, a richer product model, a proper admin, and a paper/ink visual identity. Augusto also wants a **functional Storybook**: the design broken into small stateless components, composed into stateless pages, so every piece from atom to full page renders in Storybook from fixtures — no network mocks — with interaction tests written as Storybook `play` functions.

The existing `apps/web/src` is **discarded and rebuilt**. Nothing in the v1 app needs to be preserved.

Amended 2026-09-09, after PR 2: read that as the v1 APP, not the directory. PR 2 put the new foundation inside the same tree, so the wipe in PR 3 must delete only `src/main.tsx`, `src/App.tsx`, `src/components/`, `src/i18n/`, `src/lib/` and `src/pages/`, and must KEEP `src/ui/`, `src/copy/`, `src/fixtures/` and the tokens in `src/index.css`. Same for `apps/web/test/`: `setup.ts`, `storage.test.ts`, `copy.test.ts`, `fixtures.test.ts`, `routes.test.ts` and `ui-boundaries.test.ts` survive. Taken literally, the original sentence destroys PR 2's output. Vite, Tailwind 4, TypeScript, react-query, react-router and `@shop/shared` stay as tooling.

## Decisions (with rationale)

1. **Shipping: Brazil (Correios PAC and SEDEX) + International (one flat Correios option).** Correios ships letters and small parcels worldwide for individuals (international mail up to 2 kg; Exporta Fácil for parcels), so international stays. The address form is country-aware: Brazil shows CEP/bairro/estado, other countries show generic fields. All rates are placeholders until Augusto runs the Correios simulator. Import duties, where they apply, are the buyer's; the checkout says so.
2. **Card only.** Pix and boleto are asynchronous and would need pending-order expiry handling around one-of-one stock. The design copy "Cartão, Pix ou boleto" becomes "cartão". The webhook stays synchronous-payment only (`payment_status === 'paid'`).
3. **No CPF.** It is sensitive personal data with no use unless invoices are issued per sale. The field is removed from the checkout.
4. **E-mails: Stripe receipt + manual mailto.** Stripe's receipt is the confirmation. Tracking codes are sent by hand: the admin's "Reply by e-mail" is a prefilled `mailto:` link. No transactional e-mail provider. The "order placed" copy is adjusted to promise exactly this.
5. **Orders are created before the Stripe redirect.** The checkout form needs a home, the order number must exist on the thank-you page, and Stripe's `metadata` (500 chars/value) cannot hold notes plus an address. `POST /api/checkout` creates a `pending` order, then the webhook **confirms** it instead of creating it. Idempotency moves from "unique `stripeSessionId` on insert" to "atomic `pending → paid` transition".
6. **Prices never come from the client** (unchanged from v1). The client sends `slug` + `qty`; the API re-prices from Mongo and builds Stripe `line_items` from database prices. Totals computed in the browser are display-only.
7. **UI layer is pure; the app layer owns state and effects.** `src/ui/**` may not import react-router, react-query, anything from `src/app`, or touch `window`/`localStorage`. The only hook allowed in `ui/` is `useTranslation` from react-i18next. An architecture test enforces this.
8. **i18n via react-i18next with natural-language keys.** The key *is* the English sentence (`t('Add to bag')`); only `pt.json` is maintained; a missing key renders itself. Product content stays bilingual data (`name[lang]`). Storybook gets an `I18nextProvider` decorator with a PT/EN toolbar toggle.
9. **Navigation is `<a href>`.** UI components render real anchors built from `ui/routes.ts`. A single `LinkInterceptor` at the app root upgrades same-origin clicks to client-side `navigate()`. Callbacks are used only where something happens before or instead of navigating (`onAddToCart`, `onInc`, `onSubmit`, `onToggleActive`).
10. **Storybook 10 + `@storybook/addon-vitest`.** (Amended 2026-09-09: written as 9, built on 10.6 — 9 was never installed, and 10.6's peer ranges were verified against the repo's vitest 3.2.7 before PR 2 started.) Stories run as vitest tests in real Chromium (Playwright is already a dependency). `play` functions cover component and page interaction; RTL unit tests cover only the `app/` layer.
11. **Admin is unlinked.** The "Admin" nav item in the design is dropped. `/admin` exists but nothing links to it. The login screen is restyled with the design's primitives.
12. **Kept although absent from the design:** the PT/EN toggle in the shop header, the admin login screen.
13. **Delivery: stacked PRs, backend first.** Five branches, each based on the previous, reviewed separately, merged in order.

## Scope by screen

| Screen | Design shows | Status vs v1 |
|---|---|---|
| Shop header | brand + "est. 2026", Sobre, Sacola (n), sticky; PT/EN added | restyle + drawer trigger |
| Home | hero (eyebrow, h1, paragraph, CTA to featured piece, "ships to all Brazil" note), hero image with featured card, catalog grid (4:5 image, name, subtitle, price), closing block with mailto link | new hero/featured/closing; grid restyled |
| Product | back link, main image + 2 detail thumbs, subtitle, name, price, description, specs table, "Colocar na sacola" + stock label, footer note | new: gallery, subtitle, specs |
| About | hero + portrait, 3 blocks (how it works / materials / returns), 4 facts, closing CTA (mailto + catalog) | rewritten |
| Cart drawer | right-side drawer: lines with qty stepper, subtotal, shipping, total, "Ir para o pagamento" | **new** (replaces `/cart` page) |
| Checkout | 01 buyer (name, e-mail, phone), 02 address (country-aware), 03 shipping (PAC/SEDEX or International), 04 notes (notes, gift message, referral), 05 payment (Stripe card), sticky summary + "Pagar R$ X" | **new page** |
| Order placed | `#MHP-0413`, headline, copy, total / shipping / ETA rows, back to catalog | rewritten (replaces `/thanks` polling-only page) |
| Admin header | dark bar: brand, "Painel", Produtos, Pedidos, "Ver a loja" | restyle |
| Admin login | (not in design) | restyle with primitives |
| Admin products | table: product (pt / en · slug), price, stock (∞ for made-to-order), type, status toggle Ativo/Inativo, Editar / Apagar; "+ Novo produto" | restyle + inline toggle |
| Admin product form | identifiers row (slug, price in R$, stock, type, status); PT / EN columns (name, subtitle, description); photos with alt PT/EN; specs key/value PT/EN rows; save / cancel / delete | new: subtitle, specs, alt, featured |
| Admin orders | list (code, date, customer, total, items · status) + detail (contact rows, delivery address + method/tracking, items + total, customer notes, "Marcar como despachado", "Responder por e-mail") | rewritten |

## Backend

### Product

Mongoose + `productInputSchema`. Existing: `slug` (unique), `name{pt,en}`, `description{pt,en}`, `priceCents`, `type: physical | digital`, `stock: number | null` (`null` = made to order / unlimited), `photos[]`, `active`. New, all defaulted so existing documents need no migration:

- `subtitle{pt,en}` — optional, empty strings allowed (design: "Papel algodão · 2 folhas").
- `specs: [{ key{pt,en}, value{pt,en} }]` — max 12 rows, both languages required per row.
- `photos[].alt{pt,en}` — optional.
- `featured: boolean` — default `false`. Home uses the first active `featured` product, else the first active product.

`PublicProduct` gains `subtitle`, `specs`, `photos[].alt`, `photos[].key` (R2 key, needed by the admin to reference a photo), `featured`. Prices stay in cents in the API; the admin form shows R$ and converts at the edge.

### Shipping (shared)

```ts
type ShippingMethod = 'pac' | 'sedex' | 'intl'
SHIPPING_METHODS = {
  pac:   { cents: 2200, eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' }, scope: 'BR' },
  sedex: { cents: 4100, eta: { pt: '3 a 5 dias úteis',  en: '3–5 business days' },  scope: 'BR' },
  intl:  { cents: 6000, eta: { pt: '2 a 6 semanas',     en: '2–6 weeks' },          scope: 'INTL' },
}
shippingOptionsFor(country) // 'BR' → [pac, sedex]; any other allowed country → [intl]
computeTotals(lines: {priceCents, qty, type}[], method | null) // { itemsCents, shippingCents, totalCents }; shipping is 0 when no line is physical
```

Amounts above are placeholders. Allowed international countries: the existing curated `INTL_ALLOWED_COUNTRIES` list, editable. Digital-only carts have no address, no method, shipping 0.

### Order

```
orderNumber        number, unique, sequential (counters collection, atomic $inc, upsert); displayed as #MHP-0413 (pad 4)
status             'pending' | 'paid' | 'shipped' | 'oversold' | 'expired'
stripeSessionId    string, unique, sparse (set right after the session is created)
stripePaymentIntentId?
buyer              { name, email, phone? }
shippingAddress    null | { country, postalCode, street, number?, complement?, district?, city, state? }
shippingMethod     null | ShippingMethod
notes?, giftMessage?, referral?
locale             'pt' | 'en'
items              [{ productId, slug, name{pt,en}, qty, unitAmountCents }]   snapshot at checkout
amounts            { itemsCents, shippingCents, totalCents, currency }         computed at checkout, overwritten with Stripe's on paid
trackingCode?, paidAt?, shippedAt?
timestamps
```

Portuguese labels are frontend-only: pending = "Aguardando pagamento", paid = "Em produção", shipped = "Despachado", oversold = "Estoque insuficiente", expired = "Expirado".

Transitions: `pending → paid` (webhook), `pending → expired` (webhook), `paid → oversold` (webhook, stock race), `paid | oversold → shipped` (admin). Anything else is rejected.

### Checkout request (shared)

```ts
checkoutRequestSchema = {
  items: [{ slug, qty }]  (1..CART_MAX_DISTINCT, qty 1..CART_MAX_QTY, unique slugs)   // unchanged
  locale: 'pt' | 'en'
  buyer: { name: 2..120, email, phone?: ..40 }
  shippingAddress?: { country: ISO-2 upper, postalCode: 3..12, street: 1..160, number?: ..20, complement?: ..80, district?: ..80, city: 1..80, state?: ..80 }
  shippingMethod?: ShippingMethod
  notes?: ..1000, giftMessage?: ..200, referral?: ..100
}
checkoutRules(request, hasPhysical): FieldErrors | null   // pure; used by API after loading products and by the web from the loaded catalog
```

`checkoutRules`: physical cart ⇒ `shippingAddress` and `shippingMethod` required, method must be in `shippingOptionsFor(country)`, country must be BR or in the allowed list; for BR, `postalCode` matches `^\d{5}-?\d{3}$`, `number`, `district` and `state` (2 letters) required. Digital-only cart ⇒ address and method ignored (stored as `null`).

### Endpoints

Public:

- `GET /api/products`, `GET /api/products/:slug` — unchanged shape, richer payload.
- `POST /api/checkout` — body as above. Steps: parse → load active products by slug → `UNKNOWN_ITEM` / `OUT_OF_STOCK` as today → `checkoutRules` (400 `VALIDATION` with `fieldErrors`) → `computeTotals` from DB prices → next `orderNumber` → `Order.create({ status: 'pending', ... })` → `stripe.checkout.sessions.create` → save `stripeSessionId` → `200 { url, orderNumber }`. If Stripe throws, the pending order is deleted and the response is `502 STRIPE_UNAVAILABLE` (a gap in the counter is acceptable).
  Session params: `mode: 'payment'`, `payment_method_types: ['card']`, `line_items` from DB prices, `locale`, `customer_email: buyer.email`, `client_reference_id: orderId`, `metadata: { orderId, orderNumber }`, `success_url: ${WEB_ORIGIN}/thanks?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`, `cancel_url: ${WEB_ORIGIN}/checkout`. When the cart has a physical item: shipping is **one extra line item** ("Frete · Correios SEDEX" / "Shipping · Correios SEDEX", quantity 1, the method's cents) and `payment_intent_data.shipping` carries the collected name/phone/address so it shows on the receipt and in the Stripe dashboard. **No `shipping_address_collection` and no `shipping_options`** — Stripe requires address collection to use `shipping_options`, and the address is ours now. Consequence: our `amounts.itemsCents`/`shippingCents` breakdown is the source of truth; from Stripe the webhook takes only `amount_total` and `currency` (what was actually charged), logging a RECONCILE line if the total differs from ours.
- `GET /api/orders/:orderNumber?session_id=` — both must match, else `404 ORDER_NOT_FOUND` (the session id acts as the order's password, so numbers cannot be enumerated). Returns `{ orderNumber, status, items: [{ name, qty }], totalCents, currency, shippingMethod, eta }`.
- `POST /api/stripe/webhook` — signature verification unchanged.
  - `checkout.session.completed` with `payment_status === 'paid'`: `Order.findOneAndUpdate({ stripeSessionId, status: 'pending' }, { status: 'paid', paidAt, stripePaymentIntentId, amounts.totalCents = amount_total, amounts.currency = currency }, { new: true })`. `null` result = duplicate delivery → no-op. Then the existing atomic stock decrement loop; a lost race sets `oversold`; the RECONCILE log line stays.
  - `checkout.session.expired`: `pending → expired`.
- `GET /api/health` — unchanged.

Admin (JWT, unchanged guard and login):

- Products CRUD with the extended input schema. `PUT /api/admin/products/:id` also accepts `photos?: [{ key, alt? }]` to reorder photos and edit alt text; every key must already belong to the product (else 400).
- `POST /api/admin/products/:id/photos` — multipart `photo` + optional `altPt`, `altEn`. `DELETE ...?key=` unchanged.
- `GET /api/admin/orders?status=` — `pending | paid | shipped | oversold | expired | all`; default is everything except `expired`; newest first; full documents (the shop is small, no detail endpoint).
- `PATCH /api/admin/orders/:id` — `{ status: 'shipped', trackingCode? }` only; allowed from `paid` or `oversold`; sets `shippedAt`. Other transitions → `409 INVALID_TRANSITION`.

Error contract unchanged: `{ error: { code, message, fieldErrors? } }`.

### Migration, seed, deploy notes

- `apps/api/src/migrate-v2.ts`, run once against Atlas: `fulfilled → shipped`, `customer → buyer`, backfill `orderNumber` in `createdAt` order, convert the old Stripe-shaped `shippingAddress` best-effort, set `locale: 'en'` where missing.
- `seed.ts` and `dev-e2e.ts` keep the four current slugs (the e2e suite depends on them) and gain subtitles, specs and `featured: true` on the handwritten letter.
- No new environment variables. Manual steps in `docs/deploy.md`: enable "Successful payments" e-mail receipts in the Stripe dashboard; add `checkout.session.expired` to the webhook endpoint's events.

## Frontend

### Layers

```
apps/web/src/
  main.tsx                 QueryClientProvider, BrowserRouter, i18n init, <App/>
  App.tsx                  <LinkInterceptor> + <Routes> → containers
  app/                     STATEFUL: containers, hooks, IO
    routes/                HomeRoute, ProductRoute, AboutRoute, CheckoutRoute, DoneRoute,
                           admin/ LoginRoute, ProductsRoute, ProductFormRoute, OrdersRoute
    ShopShellContainer.tsx cart + drawer state, language, wraps shop routes
    AdminShellContainer.tsx session guard, wraps admin routes
    LinkInterceptor.tsx    same-origin <a> click → navigate()
    state/                 useCart (localStorage 'shop_cart'), useLang (localStorage 'shop_lang' + navigator), useAdminSession
    api/                   fetch client (ApiError), react-query hooks
  ui/                      PURE: props in, JSX out
    routes.ts              href builders: routes.home(), routes.product(slug), routes.checkout(), routes.thanks(n, sid), routes.admin*()
    primitives/            PillButton (renders <a> or <button>), Eyebrow, TextInput, Select, TextArea, FieldLabel,
                           RuledList (1px ink-gapped rows), Stepper, Price, Stat, StatusPill, ImageFrame, LangToggle
    shop/                  ShopHeader, CartDrawer, CartLine, Hero, FeaturedCard, ProductCard, CatalogGrid, ClosingBlock,
                           ProductGallery, SpecsTable, AboutBlocks, AboutFacts, AboutClosing,
                           CheckoutBuyerSection, CheckoutAddressSection, CheckoutShippingSection, CheckoutNotesSection,
                           CheckoutPaymentSection, OrderSummaryPanel
    admin/                 AdminHeader, LoginCard, ProductsTable, ProductRow, ProductBasicsFields, ProductLocalizedFields,
                           PhotosEditor, SpecsEditor, OrdersList, OrderDetail, TrackingInlineForm
    pages/                 ShopShell, HomePage, ProductPage, AboutPage, CheckoutPage, DonePage,
                           AdminShell, AdminLoginPage, AdminProductsPage, AdminProductFormPage, AdminOrdersPage
  copy/                    dedicated react-i18next instance, pt.json
  fixtures/                sample data for stories and tests, typed with @shop/shared
```

Boundary rule (enforced by `test/ui-boundaries.test.ts`): files under `src/ui/**` may import React, `react-i18next`, `@shop/shared`, and other `src/ui` files only. No `react-router`, no `@tanstack/react-query`, no `src/app`, no `window`, `document`, `localStorage`, `fetch`.

### i18n

react-i18next, resources `{ pt: { translation: pt.json } }`, `supportedLngs: ['en', 'pt']`, `fallbackLng: false`, `keySeparator: false`, `nsSeparator: false`, `returnNull: false`. Keys are English sentences; in English the key renders itself. Interpolation via `t('{{count}} in stock', { count })`. Components receive the current language as a `lang: 'pt' | 'en'` prop from their container and use it to pick `product.name[lang]` and to call `formatPrice(cents, lang)` — amended 2026-09-09 during PR 3: this said `useTranslation().i18n.resolvedLanguage`, which is `undefined` whenever the app is in English, because only `pt` has a resource bundle and i18next resolves only to a language that has translations. Measured, not assumed. Code in `app/` that needs the instance's language uses `i18n.language`. The language is changed only in `app/` (`useLang`), which persists it and calls `i18n.changeLanguage`. `LangToggle` receives `onToggle`. A copy-completeness test scans `t('...')` literals in `src/ui` and asserts every key exists in `pt.json`.

### Navigation

`LinkInterceptor`: a capture-phase `onClick` on the root `div`. For a click whose target has a closest `a[href]` that is same-origin, with no modifier key, primary button, no `target`, no `download`, it calls `preventDefault()` and `navigate(pathname + search + hash)`. Everything else falls through to the browser. Cmd-click, middle-click and "open in new tab" therefore work natively. In Storybook a decorator does `preventDefault()` on same-origin anchors and reports `action('navigate')(href)`.

### Forms and UI state

All state is props. Pages receive `values`, `errors`, `onChange(field, value)`, `onSubmit`, `submitting`, `submitError`. Containers hold state with `useState` and validate with the same `checkoutRequestSchema` + `checkoutRules` the API uses.

Where the design has UI state, it lives in the container and arrives as props:

| State | Owner | Prop |
|---|---|---|
| drawer open | `ShopShellContainer` (opens on add-to-cart, header click) | `drawerOpen`, `onOpenCart`, `onCloseDrawer` |
| selected gallery photo | `ProductRoute` | `selectedPhoto`, `onSelectPhoto` |
| selected order (admin) | URL `?order=<id>` (so the list rows are `<a>`) | `selectedOrderId` |
| tracking code inline field | `OrdersRoute` | `tracking: { editing, value, onChange, onConfirm, onCancel }` |
| checkout form | `CheckoutRoute` | `values`, `errors`, ... |
| product form draft | `ProductFormRoute` | `draft`, `onChange`, photo/spec callbacks |

Checkout container: shipping options derive from `values.shippingAddress.country` via `shippingOptionsFor`; totals via `computeTotals` on the loaded catalog (display only); the address and shipping sections are hidden for digital-only carts; `onSubmit` posts to `/api/checkout` and does `window.location.assign(url)`. `OUT_OF_STOCK` / `UNKNOWN_ITEM` remove the line and show the message as in v1.

Done container: reads `?order=&session_id=`, queries the order, clears the cart as soon as the order is found, refetches every 2 s while `pending` (max ~30 s), then shows the paid state or a "still confirming, check your receipt" message.

Admin product form: `/admin/products/new` and `/admin/products/:id`. Photos require a saved product (R2 key needs the id); on a new product the photos section is disabled with a hint "Save first to add photos".

Admin orders: "Marcar como despachado" reveals `TrackingInlineForm`; confirm → `PATCH`. "Responder por e-mail" is `<a href="mailto:...">` built by a pure helper with subject `Pedido #MHP-0413` and a body containing the tracking code when present.

### Routes

`/`, `/exhibit/:slug` (kept; URL is invisible), `/about`, `/checkout`, `/thanks?order=&session_id=`, `/admin`, `/admin/products`, `/admin/products/new`, `/admin/products/:id`, `/admin/orders?order=`. `/cart` is removed.

### Visual tokens

Tailwind 4 `@theme` in `index.css`: colors `paper #f4f0e6`, `paper-2 #efe9db`, `paper-3 #e6dfcd`, `ink #1a1713`, `accent #a63d20`; fonts `display` Instrument Serif, `body` Newsreader, `mono` IBM Plex Mono (Google Fonts `<link>` in `index.html`). Components use Tailwind classes only. Layout follows the prototype: 1px ink rules, ink-gapped grids, pill buttons, mono uppercase eyebrows, `clamp()` sizes.

### Assumptions and deviations from the prototype

- "Falar comigo" / "me manda uma mensagem" → `mailto:contato@augustoamaral.com`.
- About portrait → static `apps/web/public/about-portrait.jpg` supplied by Augusto; paper-colored placeholder until then. Hero image → the featured product's first photo, same placeholder fallback.
- Admin table's "Idiomas PT ✓ EN ✓" column is dropped: the schema requires both languages, so the "missing" state is unreachable.
- Digital items show "Delivered by e-mail" (design says "download imediato"; there is no automatic download).
- Payment copy says card only; CPF field removed; the "order placed" copy promises a Stripe receipt and a tracking e-mail from Augusto.
- Product card, catalog grid and admin order rows navigate with `<a>`, not `onClick`.

## Storybook and testing

### Storybook

Storybook 10.6 (`@storybook/react-vite`) in `apps/web`; stories colocated (`Component.stories.tsx`). Addons: `@storybook/addon-vitest`, `@storybook/addon-a11y`. **Autodocs is DROPPED, deliberately, in PR 3 — decided by measurement, not by omission.** It was carried unmet through PR 2 (30 story entries, 0 docs entries); PR 3's sweep enabled it against the finished 44-component set and measured what it produces. (1) It is not a config flip: Storybook 10's `DocsOptions` has no `autodocs` key, so `main.ts` cannot turn it on — it needs `@storybook/addon-docs` added as a devDependency (it is not installed) plus `tags: ['autodocs']` **inside** the `preview` object; a named `export const tags` beside a default export is silently ignored, which is a measurement that returns 0 docs entries and looks like success. (2) With the addon installed the index goes 166 story + 44 docs, and the suite stays at **exactly 54 files / 565 tests** — docs entries are invisible to `@storybook/addon-vitest`, so all 44 pages ship behind neither the a11y `test: 'error'` gate nor any assertion, on a branch whose thesis is that every rendered surface has a gate over it. (3) The props table, the one thing autodocs adds that the source does not, renders `readonly T[]` as `unknown` — which is `HomePage.products`, `CheckoutPage.shippingOptions` and `CheckoutShippingSection.options`, i.e. the catalogue and the shipping table. (4) The stories are a test suite, not a variant catalogue: `AboutFacts` takes zero props and has four stories, three of which render identically, and `CheckoutAddressSection`'s `LowercaseCountryIsStillBrazil` is pixel-identical to `Brazil` by design — a docs page offers these as pickable variants, and `play` does not autoplay there, so the thing that distinguishes them never runs. (5) Every one of the 43 components has exactly one consumer, in this app, whose props are read off the type in the same file; the design record is the doc comments, which are already extracted into the bundle and are read next to the code they explain. Global decorators in `.storybook/preview.tsx`: `I18nextProvider` with the real instance + toolbar global `locale` (pt/en) — amended 2026-09-09: the decorator selects a memoised, already-initialised instance per language instead of calling `changeLanguage`, because an effect-driven language switch paints the previous language for one commit and leaks it into the next story through the shared instance; `index.css` import; anchor guard (above). No data mocks anywhere.

Stories cover every `ui/` component with its states, and every page with fixtures: Home (full catalog, empty), Product (gallery, no photos, sold out, digital), Checkout (empty, BR filled, international filled, validation errors, submitting, out-of-stock error), Done (pending, paid), Admin login, products table (with inactive and sold-out rows, empty), product form (new, editing), orders (with selection, empty).

### Interaction tests (`play`)

Callbacks are `fn()` spies from `storybook/test`; controlled inputs hold their value in `useState` inside the story's `render` (amended 2026-09-09: `useArgs` was specified here, but under the vitest browser project there is no manager to service `updateArgs`, so the value never changes and a typing story built on it can only ever be red). Cases: CartDrawer (inc/dec/close fire with the right slug), Stepper, LangToggle, CheckoutPage (BR country → PAC and SEDEX listed; other country → International only; empty submit → field errors; digital-only cart hides address/shipping), ProductsTable (toggle active), PhotosEditor (remove, alt change), SpecsEditor (add/remove row), OrdersList (row is an anchor to `?order=`). These run under `npm test` as the `storybook` project of the vitest workspace (browser mode, Chromium), next to the `unit` project (jsdom).

### Unit and integration

- `app/`: `useCart` (limits, persistence, clear), `useLang`, `LinkInterceptor` (same-origin navigates; external, modifier, `target`, `download` fall through), containers with a real `QueryClient` and `fetch` stubbed at the boundary — the only place IO is faked.
- `shared`: `computeTotals`, `shippingOptionsFor`, `checkoutRules` (BR rules, intl rules, digital-only), schema shapes.
- Architecture: `ui-boundaries.test.ts`, copy-completeness test.
- API (vitest + supertest + mongodb-memory-server): checkout (rules, counter sequence, Stripe params including absence of `shipping_address_collection` and presence of `payment_intent_data.shipping`, digital-only, Stripe failure deletes the pending order), webhook (`pending → paid`, duplicate delivery no-op, `expired`, `oversold`, `unpaid` ignored), order lookup (wrong session id → 404), admin orders (default filter hides expired, valid and invalid transitions), products (new fields, photo alt, `photos` reorder with unknown key → 400), migration script on fixture documents.

### E2E (Playwright)

`e2e/shop.spec.ts` rewritten: storefront → product → drawer → checkout form (BR) → `POST /api/checkout` returns a Stripe URL (skips without a real test key, as today); admin login → products table; admin orders lists the pending order created by the previous step. Same `dev-e2e.ts` boot.

### CI

`test` job adds `npx playwright install --with-deps chromium` (stories run in Chromium) and `npm run build-storybook -w @shop/web`. Machine guardrail unchanged for the `unit` and API projects (`--pool=forks`, `minForks=1`, `maxForks=2`); the `storybook` project runs in browser mode. Optional (PR 5): publish Storybook at `storybook.shop.augustoamaral.com` with a second Workers static-assets config.

## Delivery: stacked PRs

| # | Branch | Base | Content |
|---|---|---|---|
| 0 | `docs/v2-design` | `main` | this spec, `.gitignore` for the design export's photo files, the prototype files |
| 1 | `feat/v2-api-domain` | 0 | shared (product/order/checkout schemas, shipping, `computeTotals`, `checkoutRules`), models, counter, checkout with pending order, webhook confirm/expire, order lookup, admin orders and products, migration script, seed, API tests |
| 2 | `feat/v2-web-foundation` | 1 | tokens and fonts, the `copy/` i18n instance, Storybook + addon-vitest + decorators, vitest projects, primitives with stories, `routes.ts`, fixtures, architecture test — all additive, alongside the untouched v1 app |
| 3 | `feat/v2-web-storefront` | 2 | wipe the v1 `apps/web/src`, shop components, pages, containers, `LinkInterceptor`, cart/lang hooks, stories and `play` tests, container tests, copy-completeness test |
| 4 | `feat/v2-web-admin` | 3 | admin components, pages, containers, stories, tests |
| 5 | `feat/v2-e2e-docs` | 4 | e2e rewrite, CI changes, README and `docs/deploy.md` updates, optional Storybook publish |

Each PR targets the branch below it; merge in order. Deploy to production only after PR 5 merges, then run `migrate-v2.ts` once, then the two Stripe dashboard steps.

## Out of scope

Pix/boleto, CPF/invoices, transactional e-mail, stock reservation for pending orders (checkout-time check + paid-time atomic decrement + `oversold` fallback, as v1), buyer accounts, discount codes, visual regression testing, coverage percentage targets.

## Open items for Augusto (non-blocking)

- Real shipping prices and ETAs from the Correios simulator (replace the three placeholder constants).
- Which countries to allow internationally (edit `INTL_ALLOWED_COUNTRIES`).
- About portrait image; product photos and copy through the admin.
- Stripe dashboard: receipts on, `checkout.session.expired` event on the webhook.
- Whether to publish Storybook publicly.
