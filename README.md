# My Handmade Portfolio

A working e-commerce store where the products are my actual craft — handwritten letters, pencil drawings, digital doodles — and the checkout is a real Stripe payment for real money.

**Live:** https://shop.augustoamaral.com

## The joke, explained

Most portfolios ask you to imagine what the work would look like if it were real. This one skips the imagining. Every product in the shop is something I make with my own hands and ship myself: a letter written with an actual pen, a drawing on actual paper, a doodle I draw specifically for you. Buy the handwritten letter and a letter arrives in your mailbox a few days later, because I wrote it and mailed it. There is no mock data standing in for a "real" transaction — the Stripe integration is live, the card details go to Stripe, the money moves, and I get an order to fulfill.

The engineering point is the same as the craft point: this isn't a demo of what a shop *could* look like, it's a shop. Full MERN stack, hosted Stripe Checkout, a webhook that has to be idempotent because Stripe *will* retry it, stock that has to be decremented atomically because two people *will* try to buy the last drawing at once. The store is the exhibit.

## Architecture

Monorepo, three workspaces plus a shared package:

```
handmade-portfolio/
├── apps/
│   ├── api/     @shop/api  — Express + Mongoose, REST API + Stripe integration
│   └── web/     @shop/web  — React + Vite storefront and admin panel
├── packages/
│   └── shared/  @shop/shared — types, zod schemas, and constants shared by api and web
└── e2e/                    — Playwright end-to-end tests
```

- **Data:** MongoDB (Atlas in production, `mongodb-memory-server` for tests and e2e).
- **Payments:** Stripe Checkout (hosted page — see rationale below), confirmed via webhook.
- **Photos:** uploaded through the admin panel, resized with `sharp`, stored in Cloudflare R2.
- **i18n:** pt/en throughout, `fallbackLng: 'en'`, language persisted in `localStorage`.

### Checkout flow

```
Browser                     API                        Stripe
   |  POST /api/checkout      |                            |
   |------------------------->|  re-price items from Mongo |
   |                          |  (client-sent prices are    |
   |                          |   never trusted)            |
   |                          |--------------------------->| create Checkout Session
   |                          |<---------------------------| session.url
   |<-------------------------|                            |
   |  redirect to session.url                               |
   |------------------------------------------------------->| hosted Checkout page
   |                                                         | card entered, charged
   |                          |<---------------------------| POST /api/stripe/webhook
   |                          |  verify signature           | checkout.session.completed
   |                          |  Order.create (idempotent)  |
   |                          |  decrement stock atomically |
   |  redirect to /thanks?session_id=...                     |
   |<--------------------------------------------------------|
```

## Money-safety decisions

These are the parts of the system where a bug means either losing money or selling something twice, so each one got deliberate treatment:

- **Prices never come from the client.** `/api/checkout` looks up every item's `priceCents` from Mongo by slug and builds the Stripe line items server-side (`price_data.unit_amount: product.priceCents`). Whatever the browser sends for price is ignored; only the slug and quantity matter.
- **The webhook is idempotent.** `Order` has a unique index on `stripeSessionId`, and `Order.create` is the idempotency gate — a duplicate `checkout.session.completed` delivery (Stripe retries on anything but a 2xx, and does so aggressively) hits a Mongo duplicate-key error and is treated as a no-op rather than double-processing the order.
- **Stock decrements atomically, after the order exists.** The decrement is a single `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })` — the stock check and the decrement happen in one atomic Mongo operation, so two concurrent buyers of the last unit can't both succeed. If the decrement loses the race, the order is marked `oversold` instead of silently overselling, so it surfaces for manual handling rather than shipping something that doesn't exist. Because the decrement only runs after `Order.create` succeeds, a decrement failure can't be "fixed" by a Stripe retry (the retry would just hit the idempotency no-op) — it's logged loudly for manual reconciliation instead of thrown, since throwing would be a lie about what state the order is actually in.
- **Checkout is hosted, not custom.** Card entry happens entirely on Stripe's page, not in this app. That means PCI scope, card-brand compliance, and 3D Secure/SCA handling are Stripe's problem, not mine — the tradeoff of a slightly less seamless UX (a redirect) for not having to be trustworthy with raw card numbers is the right one for a one-person shop.

## Local development

```bash
npm install

# terminal 1: API on :3001, in-memory Mongo, seeded with the same products the tests expect
npx tsx apps/api/src/dev-e2e.ts

# terminal 2: web on :5173
npm run dev -w @shop/web
```

Admin panel is at `/admin` — log in with `admin@example.com` / `admin123` (fixed credentials, only valid for this in-memory dev/e2e boot; production uses a real password hash from an environment variable). `apps/api/src/dev-e2e.ts` is never deployed — it exists purely to give local dev and e2e tests a disposable, pre-seeded backend with no external dependencies (no real Mongo, no real Stripe key required).

## Tests

```bash
# unit + integration tests across all workspaces
NODE_OPTIONS=--max-old-space-size=4096 npm test

# end-to-end (Playwright): boots the api (in-memory Mongo) and the web dev server itself
npx playwright install chromium   # first run only
npm run e2e
```

The e2e suite has three tests: storefront → product → cart, admin login → seeded products, and checkout reaching Stripe's hosted page. The third test needs a real Stripe test-mode secret key (`sk_test_...`) and self-skips otherwise, since a dummy key can't create a real Checkout Session. Locally this means **2 passed, 1 skipped** unless you export a real key. In CI, the `e2e` job in `.github/workflows/ci.yml` runs with the `STRIPE_TEST_SECRET_KEY` repository secret, which unskips that third test — the job is also configured to pass with the secret absent (the test skips instead of failing), so a fork or PR without secrets access still gets a green build.

## Deployment

- **Web:** Cloudflare Workers (static assets) — `shop.augustoamaral.com`.
- **API:** Render free tier — `api.shop.augustoamaral.com`.
- **Database:** MongoDB Atlas, M0 (free) tier.
- **Photos:** Cloudflare R2 — `img.shop.augustoamaral.com`.

Full deploy steps, environment variables, and DNS setup live in [`docs/deploy.md`](docs/deploy.md).

## Related

This shop is one piece of a small set of portfolio properties:

- [arte.augustoamaral.com](https://arte.augustoamaral.com) — the art itself, outside of the shop.
- [resume.augustoamaral.com](https://resume.augustoamaral.com) — my résumé.
