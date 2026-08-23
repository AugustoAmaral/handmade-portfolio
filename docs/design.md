# My Handmade Portfolio — MERN + Stripe Webshop (Design)

**Date:** 2026-08-22
**Status:** approved (design), pending implementation plan
**Context:** Second portfolio piece for the freelance front. A real webshop selling silly handmade items (a handwritten letter, original drawings) with **real money** end to end: catalog → cart → Stripe checkout → webhook → order fulfillment. The joke is the brand: the shop *is* the portfolio — every product is a numbered "exhibit" you can buy.

## Brand

- **Name:** My Handmade Portfolio. Tagline: *"Most portfolios show the work. This one ships it."* / pt: *"A maioria dos portfólios mostra o trabalho. Este chega na sua casa."*
- Products presented as numbered portfolio pieces (*Exhibit 001 — Handwritten letter*).
- Repo: `AugustoAmaral/handmade-portfolio` (public). Domain: `shop.augustoamaral.com`.

## Decisions (with rationale)

1. **Stripe live mode, real purchases.** Faithful to the joke ("if someone actually buys it, that's their problem"). Everything is built and tested against test-mode keys; go-live is a key swap after Stripe KYC. Trade-off accepted: visitors can't try checkout for free.
2. **Stripe-hosted Checkout (not Payment Element).** With strangers' real money involved, the senior move is to let Stripe own the card form, 3DS, address collection, and receipts — that choice is itself the portfolio signal. The backend stays meaty enough for MERN: catalog, JWT auth, CRUD with uploads, checkout session creation, idempotent webhook, atomic stock decrement.
3. **MERN in TypeScript**: MongoDB Atlas M0 (free) + Mongoose 8, Express 5, React 18 + Vite, Node 22. npm-workspaces monorepo (`packages/shared` zod schemas/types, `apps/api`, `apps/web`) — same skeleton that worked for arte-a-mesa.
4. **Minimal admin** (single env-credentialed admin, JWT): product CRUD with photo upload + order list with status. It's the strongest MERN demo material and exactly what freelance clients ask for. No buyer accounts — checkout is guest.
5. **Zero-cost infra:** Atlas M0; API on Render free tier (kept warm by UptimeRobot pinging `/health` every 5 min — 750 free instance-hours cover 24/7); product photos on Cloudflare R2 free tier (Atlas M0 is 512MB — images don't belong in Mongo); web static on Cloudflare Workers static assets (same wrangler.jsonc pattern as arte-a-mesa).
6. **Full i18n pt/en** (react-i18next, toggle + localStorage, same pattern as arte-a-mesa). Product content is bilingual data: `name.{pt,en}`, `description.{pt,en}` in Mongo, both filled in the admin form.
7. **Ships Brazil + international + digital items.** Flat shipping rates (placeholder ~R$15 BR / ~R$60 international; Augusto confirms Correios prices before go-live). Digital items have no shipping and are fulfilled manually by email.

## Architecture

### Data model (Mongoose)

- **Product:** `slug` (unique), `name.{pt,en}`, `description.{pt,en}`, `priceCents` (int, BRL), `type: 'physical' | 'digital'`, `stock: number | null` (`null` = made to order, e.g. letter; `1` = one-of-one, e.g. original drawing), `photos: [{ r2Key }]`, `active`, timestamps.
- **Order:** `stripeSessionId` (unique index — webhook idempotency key), `stripePaymentIntentId`, item snapshots (`productId`, `slug`, names, `qty`, `unitAmountCents`), amounts (`itemsCents`, `shippingCents`, `totalCents`, `currency`), customer (`email`, `name`), `shippingAddress` (null for digital-only carts), `status: 'paid' | 'fulfilled' | 'oversold'`, `trackingCode?`, timestamps.
- **No admin collection:** single admin via `ADMIN_EMAIL` + bcrypt hash in env; login issues a 12h JWT (Bearer, localStorage).

**One-of-one race:** no reservation system. Webhook decrements stock atomically (`findOneAndUpdate` with `stock > 0`); if the decrement fails, the order is stored as `oversold` for a manual refund via the Stripe dashboard. Acceptable and honest at this shop's traffic.

### API (Express)

Public:
- `GET /api/products` (active only), `GET /api/products/:slug`
- `POST /api/checkout` — body `{ items: [{slug, qty}], destination: 'BR' | 'INTL', locale }`. Validates against Mongo — **price and stock never come from the client** — and creates a Stripe Checkout Session with inline `price_data` (Mongo is the source of truth; no Stripe product catalog sync), one flat `shipping_option` matching `destination`, `allowed_countries` restricted accordingly, and Stripe's `locale`. Digital-only carts: no address collection, no shipping. Returns `{ url }`.
- `POST /api/stripe/webhook` — raw body, signature verification. `checkout.session.completed` → create Order (address + amounts read from Stripe), decrement one-of-one stock. Duplicate events are no-ops (unique `stripeSessionId`).
- `GET /api/orders/summary?session_id=` — minimal data for the thank-you page.
- `GET /api/health` — keep-warm/uptime target.

Admin (JWT-guarded, `/api/admin/*`): `POST login`; product CRUD; `POST products/:id/photos` (multipart → sharp resize/WebP → R2 via S3 SDK) + photo delete; `GET orders`; `PATCH orders/:id` (status → fulfilled, `trackingCode`).

Error contract: `{ error: { code, message, fieldErrors? } }` (same shape as arte-a-mesa).

### Purchase flow

Cart in localStorage (custom hook; no server cart). Cart page has a **"ship to: Brazil / elsewhere"** selector that picks the session's single shipping option. Payment methods v1: **card only**; Pix is a follow-up behind a config flag (requires async-payment webhook events). Stripe sends the buyer receipt. Success URL `/thanks?session_id={CHECKOUT_SESSION_ID}`; cancel returns to cart. Fulfillment is manual: physical → Augusto ships and marks fulfilled (+tracking); digital → scans, emails, marks fulfilled.

### Frontend (pages)

Storefront grid (exhibits), product page, cart, thank-you, **about** (the joke's story — a stranger in Brazil handwrites you a letter; the narrative is the portfolio's soul), admin (login, product list/form with upload, orders). Styling: Tailwind + shadcn/ui. Data: react-query.

### Infra & deploy

- Atlas M0, SRV connection string in Render env.
- Render free web service, custom domain `api.shop.augustoamaral.com`, CORS locked to the shop origin. Auto-deploy on push to `main`. UptimeRobot monitor on `/health`.
- R2 bucket for photos with public custom domain (e.g. `img.shop.augustoamaral.com`). Note: enabling R2 requires a payment card on the Cloudflare account (still free within tier) — verify.
- Web: Cloudflare Workers static assets at `shop.augustoamaral.com`, Workers Builds CI (same as arte-a-mesa).
- Stripe webhook endpoint registered to `api.shop.augustoamaral.com/api/stripe/webhook` (test + live).
- GitHub Actions: lint + tests on PR/main.

## Seed content (placeholders — Augusto edits everything in the admin)

- *Exhibit 001 — Handwritten letter* (physical, made to order, ~R$50)
- *Exhibit 002 — Original pencil drawing* (physical, stock 1, ~R$120)
- *Exhibit 003 — Digital letter* (digital, scan by email, ~R$20)
- *Exhibit 004 — Digital doodle* (digital, ~R$15)

## Testing

- **API is the focus:** vitest + supertest + mongodb-memory-server (no Atlas in tests). Checkout session creation (prices from DB, stock guard, digital vs physical shipping, destination handling); webhook (signature verification, duplicate-event idempotency, atomic decrement, oversold path); JWT guard; product CRUD.
- **Web:** cart logic (localStorage hook), pt/en key-congruence test, key screens.
- **E2e (Playwright):** catalog → cart → `POST /checkout` returns a Stripe URL (automating Stripe's hosted page is flaky; post-payment paths are covered at webhook level with signed test payloads).
- Machine guardrail: vitest with `--pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2` + orphan check (this Mac).
- **Live smoke after go-live:** Augusto buys the cheapest item himself with a real card.

## Out of scope (v1)

- Pix (flagged follow-up), refund automation (dashboard-manual; `oversold` status covers the one forced case), buyer accounts, inventory beyond `stock`, discount codes, analytics.

## Prerequisites (Augusto, non-blocking for the build)

Everything is built against Stripe test mode. Before go-live: Stripe account activation (KYC — PJ Code Art World or CPF), real product list/prices via admin, Correios price check for the flat rates, payment card on Cloudflare for R2.
