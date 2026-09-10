# Webshop v2 — PR 4: Web admin (`feat/v2-web-admin`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin — login, products table, product form, orders list and detail — in the same two-layer shape the storefront now uses, so Augusto can run the shop from a screen that matches it.

**Architecture:** Identical to PR 3 and not restated per task: `src/ui/admin/**` is pure and stateless, `src/ui/pages/**` composes it, `src/app/**` owns session, state, IO and routing. The admin routes are added to `App.tsx`, which has carried shop routes only since PR 3 deleted the v1 admin.

**Tech Stack:** unchanged from PR 3.

**Spec:** `docs/superpowers/specs/2026-09-07-webshop-v2-design.md` — the five admin rows of "Scope by screen", the Admin half of "Endpoints", and decision 11 (the admin is unlinked).

**Constraints:** `docs/superpowers/plans/2026-09-09-webshop-v2-web-constraints.md` — **read it before Task 1 and treat it as part of this plan.** It is the measured output of PR 3's thirteen tasks: which axe rules can actually fire, what the copy scanner sees, which assertion idioms are silently inert, and the traps that cost that branch real time.

**Prototype:** `docs/superpowers/plans/2026-09-10-webshop-v2-04-prototype-extract.md`, lines 319–583 of the `.dc.html`. **Read it before Task 1.**

⚠️ **Three things I asserted when commissioning that extract turned out to be wrong, and the corrections matter:**

1. **"No semantic HTML" is false for the admin.** It ships 13 `<label>`s (all wrapping their control, so the association is valid), 13 `<input>`s, 2 `<select>`s, 2 `<textarea>`s, 3 `<h1>`s and an `<h2>`. What is genuinely missing: `<form>`, `<button>`, `<a href>`, `<nav>`, `<header>`, `<main>`, `<table>`, `<p>`, all ARIA, and every `id`/`htmlFor`. Zero `class=` still holds.
2. **The `∞` marks DIGITAL in the prototype, not made-to-order** (`it.type === "digital" ? "∞" : it.stock`). The spec says made-to-order, and **the spec is right**: the model is `stock: number | null` where `null` means no limit, and the prototype's version is a coincidence of its own seed — it would print `999` for a digital product that has stock and `2` for the piece that actually is made to order. **Render `∞` when `stock === null`.**
3. **The admin's gutter is not the shop's.** It uses `clamp(16px,4vw,40px)` (×7) and `clamp(16px,4vw,32px)` (×1); the shop's `--spacing-gutter` appears nine times and never inside the admin. Decide in Task 2: a second token, or normalise to one. Do not silently reuse `px-gutter` — the admin would get 24px wider padding than drawn.

## Constraints specific to this PR

- Branch `feat/v2-web-admin` is created from `docs/v2-design` (at the PR 3 merge, `12b6417`); its PR targets `docs/v2-design`.
- **The admin is unlinked** (spec:11). `/admin` exists, nothing in the shop links to it, and the design's "Admin" nav item stays dropped. `App.tsx`'s comment already says so — update it rather than leaving it describing a state that has ended.
- **The admin has no language toggle.** It uses the same copy instance and the same English-sentence keys as the shop — so `copy.test.ts` covers it and its strings live in `src/ui` — but it renders in whatever language the shop was left in. A second toggle for a single-user screen is not worth the surface. Say so in `AdminShell` so nobody adds one by reflex.
- **The admin token lives in `localStorage['shop_admin_token']`** and the API client already reads it (PR 3, `src/app/api/client.ts`). Do not add a second mechanism.
- **This PR restores the e2e admin test** that PR 3 skipped with `test.skip(true, 'the admin app is deleted in PR 3 and rebuilt in PR 4')`. That skip is a tracked commitment; closing it is part of this PR, not PR 5.

---

## Corrections and decisions the extract forces

- **The `Idiomas` column stays dropped**, and the extract confirms why it was ever there: it is the design's only use of accent as a *status* colour. spec:221 already dropped it because the schema requires both languages, so the "missing" state is unreachable. Do not re-add it on seeing it in the prototype.
- **The order detail's CPF row is deleted.** The prototype's fixtures carry `["CPF", "042.118.***-**"]` on all four orders and render it as the third of four contact rows — but spec decision 3 removed CPF from the checkout, so it is never collected. **A field that is never collected cannot be displayed.** Drop the row.
- **Pix/boleto vocabulary** appears in the orders fixture (`"Stripe · boleto"`, `"Stripe · Pix"`) and must not be transcribed — card only, spec decision 2.
- **The i18n key collision is real and needs a shape, not a workaround.** The form's PT and EN columns label their fields in the language of the column (`Nome`/`Name`, `Descrição`/`Description`, `Chave`/`Key`). Under this project's rule — the key IS the English sentence, one instance — both columns collapse to `Name`. The design already shows the answer in `Alt (PT)` / `Alt (EN)`: **key them `Name (PT)` / `Name (EN)`** and so on. Anything else either duplicates a key or lies about which field is which.
- **`∞` is a symbol with no accessible name.** Whatever it renders as visually, a screen reader must hear "made to order" or equivalent.
- **The four spec inputs have no labels at all** — placeholder only, which is 16 axe violations on a four-spec product and the densest accessibility problem in the admin.
- **The prototype's `save()` IS the validation**, and it is not validation: an empty slug becomes the literal string `sem-identificador`, a non-numeric price becomes `0`, and there is no uniqueness check — a new draft whose slug matches an existing id concatenates into two records with the same id. Its own header says "Os dois idiomas são obrigatórios" and nothing enforces it. **Validate against `productInputSchema`**, which already exists.
- **Two states, three words:** the table says `Ativo`/`Inativo` and the form's select says `Ativo na loja`/`Desabilitado`. Pick one pair.
- **The orders list has no selected state at all** — `o.select` writes `state.order` and nothing reads it. Since selection lives in the URL (`?order=`), the selected row needs a visible and announced state that the design does not provide.
- **The orders list column carries an unconditional `border-right`**, the same dangling edge the shop's two heroes had. PR 3 fixed those with the hairline grid rather than a media query; do the same.

## Contrast: the paper rules do not apply inside the dark bar

The admin bar is **paper-on-ink**, which inverts every ratio this project has measured. The extract measured both directions at the same opacity: `.5` is **4.78:1 on ink (passes)** and 3.28:1 on paper (fails); `.6` is 6.30 versus 4.47. So the branch's standing rule — "below `opacity-65` does not clear 4.5:1" — **is a paper rule and is wrong inside the bar**; applying it by reflex lightens `Painel` and `Ver a loja` for no reason.

- The bar's one real failure is `rgba(244,240,230,.35)` at **2.98:1**, two hundredths under the 3:1 that SC 1.4.11 needs. `.4` gives 3.36.
- **Every `AdminHeader` story must paint an ink background**, or axe measures the text against the story canvas and reports both sides inverted.
- On the paper side the damage is larger and was not in my briefing: the table's column headers (`opacity:.5` → 3.28:1) and **ten sites at `.55`** (3.82:1) fail AA, plus six at `.6` (4.47, failing by 0.03). The form's 13 labels at `.75` (7.39:1) pass and match the existing `FieldLabel` exactly — use it.

## What is genuinely new here

PR 3 built read-mostly screens. Four things in the admin have no precedent on the branch, and they are where the risk is:

1. **A session and a guard.** Everything else on the branch is anonymous.
2. **File upload.** `PhotosEditor` posts multipart. The API client already refuses to set a JSON content-type on `FormData` (Task 1 proved that with a mutation) — that guard now gets its first real consumer.
3. **Destructive actions with confirmation.** Deleting a product and deleting a photo. The design draws no confirmation step; shipping one without it is not acceptable, and inventing a modal is not the only option — decide and pin it.
4. **A form that edits nested arrays.** Specs and photos are arrays of bilingual pairs. `useState` over an array of objects is where uncontrolled/controlled bugs live, and `ui/` may not hold any of it.

---

## File map

`src/ui/admin/` (pure, one `.stories.tsx` each): `AdminHeader`, `LoginCard`, `ProductsTable`, `ProductRow`, `ProductBasicsFields`, `ProductLocalizedFields`, `PhotosEditor`, `SpecsEditor`, `OrdersList`, `OrderDetail`, `TrackingInlineForm`, `index.ts`.

`src/ui/pages/`: `AdminShell`, `AdminLoginPage`, `AdminProductsPage`, `AdminProductFormPage`, `AdminOrdersPage`.

`src/app/`: `state/useAdminSession.ts`, `AdminShellContainer.tsx`, `routes/admin/{LoginRoute,ProductsRoute,ProductFormRoute,OrdersRoute}.tsx`, and admin hooks in `api/queries.ts`.

Modified: `App.tsx` (admin routes), `src/copy/pt.json`, `e2e/shop.spec.ts` (restore the admin test), `src/fixtures/` (admin product fixtures if the existing ones do not cover a state — extend rather than inline).

---

## Task order

| # | Task | Depends on |
|---|---|---|
| 1 | `useAdminSession` + admin query hooks | — |
| 2 | `AdminHeader`, `LoginCard` | — |
| 3 | `ProductsTable`, `ProductRow` | — |
| 4 | `ProductBasicsFields`, `ProductLocalizedFields` | — |
| 5 | `SpecsEditor`, `PhotosEditor` | — |
| 6 | `OrdersList`, `OrderDetail`, `TrackingInlineForm` | — |
| 7 | Admin pages | 2–6 |
| 8 | Containers + the session guard | 1, 7 |
| 9 | Routes, the restored e2e admin test, and the sweep | 8 |

Tasks 2–6 are independent of each other and of Task 1. Task 9 is the only one that touches `App.tsx`.

---

## Task 0 (do this first): extract the admin screens from the prototype

**Files:** create `docs/superpowers/plans/2026-09-10-webshop-v2-04-prototype-extract.md`.

Same job the shop extract did, for the five admin screens in `design-claude-design/My Handmade Portfolio.dc.html` (~lines 319–584): verbatim pt-BR copy, exact structure, the inline styles as derivations with their token mapping, and — most valuable — **what the design does not give you**. Expect the same answers as the shop: no semantics, no error states, no loading states, no confirmation for destructive actions, no empty states.

Two things to check specifically, because the shop extract found their equivalents: the admin bar uses `rgba(244,240,230,.35)`, which is paper-on-ink and therefore a **different contrast problem** from every ratio measured so far (the shop is ink-on-paper throughout); and the orders fixture in the prototype uses Pix and boleto vocabulary, which spec decision 2 removed.

---

## Tasks 1–9

Each task follows the pattern PR 3 settled into, which is not restated per task:

- Read the shared constraints, the spec rows for your screens, and the neighbouring components already shipped.
- Write the failing test first, watch it fail, implement, watch it pass.
- **Prove every assertion can fail** by mutating what it guards; mutate sibling guards separately; check assertion order leaves no passenger; cut what survives everything.
- Every `t()` gets its `pt.json` entry in the same commit.
- Stories render from fixtures, never from inline literals.
- Prove the a11y gate is live on your own code before trusting a clean run.
- Typecheck, both vitest projects, `build-storybook`, orphan check, one or more commits, no trailers.

**What each task owns, and the decisions it must make rather than defer:**

**Task 1 — `useAdminSession` and the admin hooks.** The session is a token in `localStorage`, so it has the same shape as `useCart`: validated on read, because a stored value survives deploys. Decide what happens when the token is present but the API answers 401 — the guard cannot distinguish "expired" from "never valid" without asking, and a redirect loop is the failure mode. The hooks: `useAdminProducts`, `useAdminOrders(status)`, `useSaveProduct`, `useDeleteProduct`, `useUploadPhoto`, `useDeletePhoto`, `useMarkShipped`. **Check the response envelopes against `apps/api/src/routes/admin*.ts` rather than assuming** — PR 3 shipped a hook layer that never unwrapped `{ products }` and it survived ten tasks because it had no consumer.

**Task 2 — `AdminHeader`, `LoginCard`.** The header is the design's dark bar: ink background, paper text, which inverts every contrast ratio the branch has measured. Measure it. `LoginCard` is a real `<form>` with a submit button inside it, so it gets Enter for free — unlike the checkout, which needed the `form` attribute.

**Task 3 — `ProductsTable`, `ProductRow`.** A real `<table>` with a `<caption>` or an `aria-label`; the status toggle is a control, not a link. `∞` for made-to-order stock is a symbol with no accessible name — give it one. Decide how a destructive "Apagar" is confirmed and pin it.

**Task 4 — `ProductBasicsFields`, `ProductLocalizedFields`.** Price is entered in R$ and stored in cents; the conversion happens at the edge and is the one place a rounding bug costs money — test it with a value that exposes float error (`19.99`, `0.07`). `stock: null` means made-to-order and is not the same as `0`; a number input cannot express that distinction on its own.

**Task 5 — `SpecsEditor`, `PhotosEditor`.** Both edit arrays and neither may hold state. Rows need stable identity for React keys: **the array index is not stable across a delete**, and using it is the classic bug where deleting row 2 clears row 3's text. Photos: the upload is multipart, `alt` is bilingual, and reordering is a `PUT` of the whole `photos` array where every key must already belong to the product. A new product has no id, so photos are disabled with the spec's hint.

**Task 6 — `OrdersList`, `OrderDetail`, `TrackingInlineForm`.** The selected order lives in the URL (`?order=`), so list rows are `<a href>`. `ADMIN_ORDER_TRANSITIONS` and `canTransition` already exist in `@shop/shared` — use them; a UI that offers a transition the API rejects with `409 INVALID_TRANSITION` is a UI that lies. "Responder por e-mail" is a pure `mailto:` helper. **The order fixtures are money-identical** (PR 3's sweep recorded this) — an assertion that a detail pane shows *this* order's total cannot distinguish it from another's until a fixture differs.

**Task 7 — the pages.** `AdminShell` owns the header and the single `<main>`. Heading outlines matter again; `heading-order` needs three headings to fire.

**Task 8 — containers and the guard.** `AdminShellContainer` holds the session and renders `<Outlet/>`; an unauthenticated visit renders the login rather than redirecting, so a deep link survives signing in. The product form is the branch's most stateful container.

**Task 9 — routes, e2e, sweep.** Add the admin routes to `App.tsx` and update its comment. **Restore the e2e admin test** — the seed's admin credentials are in `apps/api/src/dev-e2e.ts`. Then sweep: unfailable assertions, story coverage against the spec's five admin rows, `pt.json` keys with no caller (PR 3 left several planted for this PR — they should now have real callers or be deleted), and props no supplier fills.

---

## Carried in from PR 3, unresolved

- **`RuledRow` is exported and rendered by nothing but its own story** — the same shape as the `Stat` that PR 3 deleted. The admin's rows are its most plausible consumer: either consume it here or delete it.
- **The zod→`fieldErrors` decoder now lives in `@shop/shared`.** The admin's product form is its second real consumer; if it needs a shape the decoder does not produce, fix the shared copy rather than adding a local one.
- **`oversold` and `expired` Done-page copy** is outstanding and marked in `DonePage`. The admin is where those orders are seen and handled, so writing the customer-facing copy may become obvious while building `OrderDetail` — if it does, raise it rather than writing it.
