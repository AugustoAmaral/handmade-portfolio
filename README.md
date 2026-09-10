# My Handmade Portfolio

A working e-commerce store where the products are my actual craft — handwritten letters, pencil drawings, digital doodles — and the checkout is a real Stripe payment for real money.

**Live:** https://shop.augustoamaral.com

## The joke, explained

Most portfolios ask you to imagine what the work would look like if it were real. This one skips the imagining. Every product in the shop is something I make with my own hands and ship myself: a letter written with an actual pen, a drawing on actual paper, a doodle I draw specifically for you. Buy the handwritten letter and a letter arrives in your mailbox a few days later, because I wrote it and mailed it. There is no mock data standing in for a "real" transaction — the Stripe integration is live, the card details go to Stripe, the money moves, and I get an order to fulfill.

The engineering point is the same as the craft point: this isn't a demo of what a shop *could* look like, it's a shop. Full MERN stack, hosted Stripe Checkout, a webhook that has to be idempotent because Stripe *will* retry it, stock that has to be decremented atomically because two people *will* try to buy the last drawing at once. The store is the exhibit.

## Architecture

Monorepo, two apps plus a shared package:

```
handmade-portfolio/
├── apps/
│   ├── api/     @shop/api     — Express + Mongoose, REST API, Stripe, R2 uploads
│   └── web/     @shop/web     — React + Vite storefront and admin panel, plus Storybook
├── packages/
│   └── shared/  @shop/shared  — zod schemas, the shipping table, money and totals,
│                                order statuses and transitions, request limits —
│                                the rules the api enforces and the web draws
├── e2e/                       — Playwright end-to-end tests
├── docs/
│   ├── design.md              — v1 design notes
│   ├── deploy.md              — the production runbook
│   └── superpowers/           — the v2 design spec and its implementation plans
└── design-claude-design/      — the approved v2 visual prototype (.dc.html, opens in a browser)
```

`apps/web/src` is split into two layers and the split is enforced, not just intended:

- **`ui/` is pure** — props in, JSX out. It may import React, `react-i18next` and `@shop/shared`, and nothing else: no router, no react-query, no `window`, no `fetch`. Every component and page in it has stories.
- **`app/` owns state, routing and IO** — containers, the cart and language hooks, the fetch client and the react-query hooks.

`apps/web/test/ui-boundaries.test.ts` fails the build if a file under `ui/` reaches across that line.

- **Data:** MongoDB (Atlas in production, `mongodb-memory-server` for tests and e2e).
- **Payments:** Stripe Checkout. The buyer's details are collected by this app; card entry happens on Stripe's hosted page; the payment is confirmed by webhook.
- **Photos:** uploaded through the admin panel, auto-rotated, resized to fit within 1600×1600 and converted to WebP by `sharp`, stored in Cloudflare R2.
- **i18n:** pt/en throughout, through a dedicated react-i18next instance in `apps/web/src/copy/`. The key *is* the English sentence (`t('Add to bag')`), so only `pt.json` is maintained and English renders the key itself. That is why the instance is configured `fallbackLng: false`: an English-sentence key falling back to English would render a *missing* translation as perfectly good copy, which is exactly the bug the fallback is supposed to reveal. `keySeparator` and `nsSeparator` are `false` for the same reason the keys are sentences — 75 of the 259 keys contain a `.` and 9 contain a `:`, and by default i18next reads a `.` as a nesting separator and a `:` as a namespace separator. Language choice persists in `localStorage` under `shop_lang`.

### Checkout flow

The order exists before the buyer ever reaches Stripe: the checkout form has to have somewhere to put the address, and the thank-you page has to have an order number to show.

```
Browser                              API                                  Stripe
   |  POST /api/checkout              |                                      |
   |  { items:[{slug,qty}], buyer,    |                                      |
   |    shippingAddress, method }     |                                      |
   |--------------------------------->|  re-price every item from Mongo      |
   |                                  |  (client-sent prices are never       |
   |                                  |   trusted; postage from the table)   |
   |                                  |  orderNumber ← atomic $inc counter   |
   |                                  |  Order.create({ status: 'pending' }) |
   |                                  |------------------------------------->|  sessions.create
   |                                  |<-------------------------------------|  session.url + id
   |                                  |  save stripeSessionId on the order   |
   |<---------------------------------|  200 { url, orderNumber }            |
   |                                                                         |
   |  window.location.assign(url) -------------------------------------------->  hosted Checkout
   |                                                                         |  card entered, charged
   |                                  |<-------------------------------------|  POST /api/stripe/webhook
   |                                  |  verify signature                    |   checkout.session.completed
   |                                  |  pending → paid (atomic, idempotent) |
   |                                  |  decrement stock atomically          |
   |                                                                         |
   |<--------------------------------------------------------------------------  redirect to /thanks
   |                                  |                    ?order=N&session_id={CHECKOUT_SESSION_ID}
   |  GET /api/orders/N?session_id=…  |                                      |
   |--------------------------------->|  number AND session id must match    |
   |<---------------------------------|  polled until the webhook lands      |
```

A session the buyer abandons rather than pays fires `checkout.session.expired`, and the order moves `pending → expired`. The webhook endpoint has to be subscribed to **both** events; `docs/deploy.md` step 2.2 is where that is set up.

## Money-safety decisions

These are the parts of the system where a bug means either losing money or selling something twice, so each one got deliberate treatment:

- **Prices never come from the client.** `/api/checkout` looks up every item's `priceCents` from Mongo by slug and builds the Stripe line items server-side (`price_data.unit_amount: product.priceCents`). Whatever the browser sends for price is ignored; only the slug and quantity matter. Postage is the same story — it is one more line item, priced from `SHIPPING_METHODS` in `@shop/shared`, not from the radio button. The totals the checkout page shows are display-only.
- **The webhook is idempotent.** Because the order is created before the redirect, the webhook *confirms* an order rather than creating one, and the idempotency gate is a single atomic `Order.findOneAndUpdate({ stripeSessionId, status: 'pending' }, { status: 'paid', … })` — only a pending order flips, and only once. A duplicate `checkout.session.completed` delivery (Stripe retries on anything but a 2xx, and does so aggressively) matches nothing and stops there. `stripeSessionId` still carries a unique sparse index, but the transition is what makes the retry a no-op.
- **Stock decrements atomically, after the order is paid.** The decrement is a single `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })` — the stock check and the decrement happen in one atomic Mongo operation, so two concurrent buyers of the last unit can't both succeed. Made-to-order pieces (`stock: null`) have nothing to decrement and are skipped. If the decrement loses the race, the order is marked `oversold` instead of silently overselling, so it surfaces for manual handling rather than shipping something that doesn't exist — and `oversold` is a delay rather than a dead end, since the admin can still move it to `shipped` once the piece is made. Because the decrement only runs after the paid flip succeeds, a decrement failure can't be "fixed" by a Stripe retry (the retry would just hit the idempotency no-op) — it's logged loudly for manual reconciliation instead of thrown, since throwing would be a lie about what state the order is actually in. The honest gap kept from v1: Atlas M0 has no transactions, so a crash between the flip and the decrement leaves a paid order whose stock was never adjusted, and a `RECONCILE` line in the log is all that catches it.
- **The card never touches this app.** The buyer's name, address and shipping choice are collected by this app's own `/checkout` page, but card entry happens entirely on Stripe's hosted page. That means PCI scope, card-brand compliance, and 3D Secure/SCA handling are Stripe's problem, not mine — the tradeoff of a slightly less seamless UX (a redirect) for not having to be trustworthy with raw card numbers is the right one for a one-person shop.
- **A pending order can't become a ghost.** An order that exists but can never be paid or reconciled is the failure mode the pending-first design invents, so each way of reaching it has an answer: if Stripe throws while creating the session the pending order is deleted and the API answers `502 STRIPE_UNAVAILABLE` (a gap in the order-number sequence is acceptable); if the session id can't be persisted afterwards the session is expired and the order deleted; if the process dies between those two writes nothing will ever match the order, so on boot the API sweeps pending orders older than an hour that have no `stripeSessionId` into `expired`.
- **The order number is not a credential.** `GET /api/orders/:orderNumber` also requires the `session_id`, which only ever reached the buyer's own browser through Stripe's `success_url`. Both have to match or it answers 404, so order numbers can't be walked.

## Local development

```bash
npm install

# terminal 1: API on :3001, in-memory Mongo, seeded
npx tsx apps/api/src/dev-e2e.ts

# terminal 2: web on :5173
npm run dev -w @shop/web

# optional: Storybook on :6006
npm run storybook -w @shop/web
```

`apps/api/src/dev-e2e.ts` is never deployed — it exists purely to give local dev and the e2e tests a disposable, pre-seeded backend with no external dependencies (no real Mongo, no real Stripe key, no R2). It seeds more than the catalogue:

- the **four shop products**, one of them carrying two photo rows so the admin has a list to reorder (the R2 objects behind them do not exist, and the e2e blocks the requests);
- **one inactive draft product**, which the shop's own endpoint filters out and the admin's does not;
- **four orders — one `pending`, one `paid`, one `oversold`, one `expired`** — so `/thanks` and the whole `/admin/orders` section (the list, the three filter modes, and marking an order dispatched) are exercisable locally without paying for anything. They are numbered from 1001 so a real checkout, which starts the counter at 1, cannot collide with them.

The admin panel is at `/admin`. Nothing in the shop links to it — it is an address you type. Log in with `admin@example.com` / `admin123` (fixed credentials, only valid for this in-memory dev/e2e boot; production uses a real bcrypt hash from an environment variable). Behind the login:

- **`/admin/products`** — the table, with an inline Ativo/Inativo toggle.
- **`/admin/products/new`** and **`/admin/products/:id`** — slug, price in R$, stock, type and `featured`; PT and EN columns for name, subtitle and description; photo upload with alt text per language and reordering; up to 12 spec rows.
- **`/admin/orders`** — the list (filtered by status; `expired` is hidden by default), a detail pane with the buyer's contact rows, address, items, totals and notes, "Marcar como despachado" with an inline tracking-code field, and a prefilled `mailto:` reply.

## Tests

```bash
# unit + integration across all three workspaces
NODE_OPTIONS=--max-old-space-size=4096 npm test

# end-to-end (Playwright): boots the api (in-memory Mongo) and the web dev server itself
npx playwright install chromium   # first run only — the storybook project above needs it too
npm run e2e
```

`npm test` runs the workspaces in order. As of `ae82f67`:

| Workspace | Files | Tests | What runs |
|---|---:|---:|---|
| `@shop/shared` | 6 | 39 | vitest in node — totals, shipping rules, checkout rules, schemas, money formatting |
| `@shop/api` | 13 | 86 | vitest + supertest against `mongodb-memory-server` — routes, webhook, counter, migration |
| `@shop/web` | 76 | 1079 | two vitest projects in one run, below |

`@shop/web`'s two projects:

- **`unit`** — 16 files, 727 tests, jsdom. The `app/` layer: containers with a real `QueryClient` and `fetch` stubbed at the boundary (the only place IO is faked), `useCart` and `useLang`, the link interceptor, and the architecture and copy-completeness tests.
- **`storybook (chromium)`** — 60 files, 352 tests, in a real Chromium through Playwright. Every one of the 59 components and pages under `src/ui/` has a `.stories.tsx`, and `@storybook/addon-vitest` runs each story as a test; interaction cases are Storybook `play` functions. The a11y addon is set to `test: 'error'` rather than its default `test: 'todo'`, so an axe violation in any story **fails the run** instead of being reported in a panel nobody opens.

The worker caps in `apps/web/vitest.config.ts` sit at the root of the config on purpose: vitest builds one pool per run from the root, and the same options nested inside a project are ignored in silence.

Storybook also runs on its own (`npm run storybook -w @shop/web`), and CI builds it (`npm run build-storybook -w @shop/web`) so a story that no longer compiles fails the build. It is not published anywhere.

### The e2e suite

`npm run e2e` boots `dev-e2e.ts` and the Vite dev server itself, and runs **ten tests: nine that always run, and one that skips unless it is handed a real Stripe test key.** A plain local run is therefore **9 passed, 1 skipped**.

The nine cover the catalogue → product → bag drawer; a product URL with nothing behind it; a digital-only bag paying no postage, and one physical piece bringing the address form back; `/thanks` reading an order back and refusing the wrong `session_id`; `oversold` and `expired` drawing two different screens; admin login and the products table; the photo list the form sends being one the real API accepts; the three order-filter modes answering with three different sets; and a real dispatch, with the tracking code that was typed coming back stored.

The tenth, `checkout reaches Stripe`, is the only test in the repo that talks to Stripe:

- **It runs only when `STRIPE_SECRET_KEY` starts with `sk_test_` and is not `sk_test_dummy`.** No key at all, an empty string, a live `sk_live_…` key and a restricted `rk_test_…` key all skip. The empty-string case is what an unset GitHub secret actually looks like; the live-key case is a safety rule rather than a capability one, because this test creates a real Checkout Session and one created with a live key is a real payment page for real money.
- **What it asserts:** that `POST /api/checkout` answers 200, and that the browser ends up on a `https://checkout.stripe.com/` URL. Before submitting it asserts the pay button reads `Pagar R$ 72,00` — R$ 50,00 for the letter plus R$ 22,00 of PAC, chosen over the R$ 50,00 the page showed a moment earlier precisely because a summary that ignored the shipping radio would still reach Stripe. **It asserts nothing on Stripe's own page:** that markup belongs to Stripe and changes without a release note, and a test that reddens on someone else's redesign teaches everyone to ignore it.
- Nothing is stubbed to make it green. With a dummy key there is no session to reach and no assertion that would mean anything, so the test says why it did not run rather than passing anyway — which is also why a fork, or a PR with no access to secrets, still gets a green build.

**It does not currently run in CI either, and that is not by design.** The `e2e` job in `.github/workflows/ci.yml` passes `STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}`, and **that repository secret does not exist** — `gh secret list` returns 13 secrets and this is not one of them, so the expression interpolates to an empty string and the test skips there exactly as it does locally. Creating a `STRIPE_TEST_SECRET_KEY` secret holding an `sk_test_…` key is all it would take. The existing `STRIPE_SECRET_KEY` secret is deliberately *not* reused for this: it was created alongside the deploy secrets and is presumably live, and GitHub does pass secrets to same-repo pull-request jobs, so wiring it in would create real Checkout Sessions on every PR.

**The local trap:** `playwright.config.ts` sets `reuseExistingServer: !CI`, so a `dev-e2e.ts` left running from before you exported the key keeps its `sk_test_dummy` while the Playwright process sees the real one. The test then unskips against an API that cannot pay, and the assertion on the 502 is worded to say so rather than to time out on a navigation that was never going to happen. Restart the API server after exporting the key.

## Deployment

- **Web:** Cloudflare Workers (static assets) — `shop.augustoamaral.com`.
- **API:** Render free tier — `api.shop.augustoamaral.com`.
- **Database:** MongoDB Atlas, M0 (free) tier.
- **Photos:** Cloudflare R2 — `img.shop.augustoamaral.com`.
- **Keep-alive:** UptimeRobot hits `/api/health` every 5 minutes so the free Render instance never idles.

Full deploy steps, environment variables and DNS setup live in [`docs/deploy.md`](docs/deploy.md) — including the one-shot `migrate-v2.ts` run and the two Stripe dashboard settings that the first v2 deploy needs.

## Related

This shop is one piece of a small set of portfolio properties:

- [arte.augustoamaral.com](https://arte.augustoamaral.com) — Arte à Mesa, a tableware rental system built for a real shop.
- [resume.augustoamaral.com](https://resume.augustoamaral.com) — my résumé.
