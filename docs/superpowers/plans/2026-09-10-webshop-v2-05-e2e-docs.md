# Webshop v2 — PR 5: e2e and docs (`feat/v2-e2e-docs`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** close the last e2e skip, write the copy and the accessibility fixes the shop still owes, make an oversized upload answer honestly, and correct two documents that are now factually wrong about the software they describe.

**Spec:** `docs/superpowers/specs/2026-09-07-webshop-v2-design.md` (PR 5 row: "e2e rewrite, CI changes, README and `docs/deploy.md` updates, optional Storybook publish").

**Shared constraints:** `docs/superpowers/plans/2026-09-09-webshop-v2-web-constraints.md` — every measured rule from PRs 3 and 4. Read it before writing web code.

**Base:** `feat/v2-web-admin` (PR 4, `8feaba7`). Its PR targets `feat/v2-web-admin`, and merges after it.

---

## What this PR is really for

The spec's PR 5 row was written before PRs 3 and 4 existed. Most of the "e2e rewrite" already happened: PR 3 rewrote the suite, PR 4's Task 9 closed the admin skip and added the photo-permutation test. The CI changes also landed early — the retry composite action in PR 3, `build-storybook` in PR 2.

So this PR is smaller than its row implies in one direction and larger in another. What genuinely remains:

1. **One skipped e2e test**, `checkout reaches Stripe`, still carrying `test.skip(true, 'v1 web checkout is incompatible with the v2 API; re-enabled in PR 5')`. It is a tracked commitment addressed to this PR by name, and its body is a stub (`await page.goto('/')`).
2. **Copy and accessibility the shop still owes**, both deferred with reasons and both now due: the `oversold`/`expired` Done-page wording, and `autoComplete` on the checkout's fields.
3. **One API answer that lies**, pinned as-is by PR 4 so a fix could not land silently.
4. **Two documents that are wrong**, in ways that are checkable rather than stylistic — and one of the errors would break production.

## Global constraints

- **Never `git push --force`.** The branch is published the moment its PR opens.
- **No commit trailers.** The stack has 27 commits and zero; a trailer appearing mid-stack is noise a reviewer has to ask about.
- Code, commits, PRs and docs in **English**. Shop copy in pt-BR with English-sentence keys.
- **`copy.test.ts` only half-strips comments** — a JSX `{/* … */}` body line is scanned as production copy, and a `*/` inside one closes it early.
- **Prove every assertion can fail by mutating what it guards.** Report the count and every survivor.
- **If you touch `packages/shared/src`, run `npm run build -w @shop/shared`** before believing any web or api result, mutation proofs included.
- Typecheck, both vitest projects, `build-storybook`, the e2e suite, the orphan check.

---

## Task order

| # | Task | Depends on |
|---|---|---|
| 1 | The Stripe checkout e2e, and an audit of what the suite still cannot see | — |
| 2 | The shop's outstanding copy and `autoComplete` | — |
| 3 | `MulterError` — make the upload's most likely failure answerable | — |
| 4 | README and `docs/deploy.md` | 1–3 |

Task 4 last, because it describes what the others leave true.

---

## Task 1 — the Stripe checkout e2e, and an audit

**Files:** `e2e/shop.spec.ts`, possibly `apps/api/src/dev-e2e.ts`.

**The mechanism already exists and is documented.** `.github/workflows/ci.yml`'s `e2e` job passes `STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}`, and `dev-e2e.ts` deletes an empty value before defaulting to `sk_test_dummy` — with the comment "In CI an absent secret arrives as `''` — treat empty as unset". So a real test key reaches both the API boot and the Playwright process, and a dummy one is distinguishable from it. **The v1 test self-skipped on exactly this and the README already describes the behaviour** ("needs a real Stripe test-mode secret key and self-skips otherwise… so a fork or PR without secrets access still gets a green build"). Follow that contract rather than inventing one; if you change it, the README's paragraph changes with it in the same commit.

**The v2 checkout is in-app**, unlike v1's. The flow is catalogue → bag → `/checkout` → fill → submit → the API creates the session → the browser goes to Stripe's hosted page. Decide what "reaches Stripe" should assert. The honest options differ: that the app navigated to a `checkout.stripe.com` URL is weak but stable; that the hosted page rendered the right total is stronger and couples the test to Stripe's DOM. Pick one, say why, and do not assert on markup you do not own.

**Do not stub Stripe into `dev-e2e.ts` as a way around the key.** A stub would make the test green everywhere and prove nothing about the one integration it exists to cover — and the checkout's session params are already unit-tested against the real shapes. A test that cannot fail is worse than a skip that says why.

**Then audit, and report rather than assume.** The suite is 4 passing + 1 skipped. List what the e2e still cannot see, and for each say whether it is unreachable (needs a service) or merely unwritten. PR 4 already named two: the photo upload/delete round trip is unreachable because both call R2, and the container's photo reseed is only observable across two requests. **A digital-only purchase — no address, no shipping method, `shippingAddress: null` — has no e2e and is reachable.** Decide whether to write it here.

---

## Task 2 — the shop's outstanding copy and `autoComplete`

**Files:** `apps/web/src/ui/pages/DonePage.tsx` + its stories, `apps/web/src/copy/pt.json`, `apps/web/src/ui/shop/CheckoutFields*` (find the real filenames), the checkout stories.

Two deferrals, both with recorded reasons, both now due.

### The `oversold` and `expired` Done-page copy

Marked in `DonePage` and outstanding since PR 3. **PR 4's Task 6 established the fact the copy turns on, and it is not obvious from the status names:**

- **`oversold` is fulfillable.** `ADMIN_ORDER_TRANSITIONS` allows `oversold → shipped`. The money was taken, the order is real, and the piece can still be made and posted. **It is a delay, not a failure**, and the customer is owed a timeframe and an apology, not a refund notice.
- **`expired` was never paid.** The Stripe session lapsed; nothing was charged and nothing is owed in either direction. The customer is owed a way back to the piece, not an apology.

Writing the same reassurance for both would be wrong in one direction each way. The two sentences are different in kind, not in tone.

This is the shop's voice, not the admin's — read `DonePage`'s existing `pending` and `paid` copy and match it. Both languages.

### `autoComplete` on the checkout fields

SC 1.3.5 (Identify Input Purpose). PR 4's Task 2 added `autoComplete` to `TextInput` for the admin login and **explicitly declined to widen into the checkout**, naming it as a pre-existing gap. Every checkout field that maps to a WCAG input purpose gets its token — name, email, tel, and the address fields, which have real tokens (`postal-code`, `address-line1`, `address-level2`, `country`) rather than invented ones.

**Two things to get right:** the address fields only autofill correctly inside a `<form>` when the tokens are the ones browsers actually implement, so use the HTML spec's list rather than guessing; and a wrong token is worse than none, because it makes a password manager fill the wrong box. Assert the tokens, do not eyeball them.

---

## Task 3 — `MulterError`

**Files:** `apps/api/src/errors.ts` (or wherever `errorHandler` lives), `apps/api/test/admin-products.test.ts`.

**Measured in PR 4 and pinned as-is:** `multer` throws a `MulterError`, which is neither `AppError` nor `ZodError`, so `errorHandler` falls through to `500 INTERNAL`. **The most likely upload failure — a photo that is too big — answers with the same body as a crash.** PR 4 put a client-side size and type check in front of the POST for exactly this reason, and wrote a test that pins the current 500 so a fix cannot land without the panel being told.

Map it to something honest. `LIMIT_FILE_SIZE` is a 413 and the rest are 400s; the panel's `useErrorMessage` table needs the code to say something true in pt-BR, and `MAX_PHOTO_BYTES` already lives in `@shop/shared` so the message can name the real number.

**The pinning test will fail. That is the point** — update it in the same commit, and make sure the new assertion distinguishes the code from a generic 4xx rather than just asserting "not 500".

---

## Task 4 — README and `docs/deploy.md`

**Files:** `README.md`, `docs/deploy.md`.

Both describe v1. The errors are factual, not stylistic — check each claim against the code rather than rewriting prose you find ugly.

### `README.md` — measured errors

- **"`fallbackLng: 'en'`" is wrong.** The v2 copy instance uses `fallbackLng: false`, deliberately: an English-sentence key falling back to itself would hide a missing translation.
- **"The e2e suite has three tests" is wrong.** It is five, and the third is no longer the Stripe one.
- **The self-skip paragraph** describes v1's mechanism. Task 1 either restores it or replaces it — this paragraph must match whichever happened.
- **Storybook is not mentioned at all**, and it is now a large part of the repo: every component and page has stories, they run as a vitest project in Chromium, and the a11y addon fails the build on a violation. The "Tests" section describes a suite that no longer matches the commands.
- The architecture tree predates `docs/`, the design source and `packages/shared`'s growth.

Do not restate the money-safety section — it is still accurate and it is the best part of the file.

### `docs/deploy.md` — one error that would break production

- **Step 2.2 subscribes the webhook to `checkout.session.completed` only.** v2 depends on `checkout.session.expired` to move a lapsed order out of `pending`; without that subscription the expire path is silently dead in production and pending orders accumulate forever. Verify the event name against `apps/api/src/routes/stripe.ts` (or wherever the webhook handler lives) rather than copying it from here.
- **`migrate-v2.ts` must run once after the first v2 deploy**, per the spec's delivery section, and the runbook has no step for it. Say when, and what happens if it is run twice.
- **Stripe receipts** are one of the spec's two dashboard steps and are not in the runbook.
- Step 6's seed now carries subtitles, specs and `featured` — check whether the paragraph still describes what the script does.

**Check every version, command and env var you touch.** A runbook is read once, by someone with no context, at the moment they can least afford a wrong instruction.

---

## Left for Augusto, not for this PR

- **Whether to publish Storybook publicly** (`storybook.shop.augustoamaral.com`, a second Workers static-assets config). The spec lists this under "Open items for Augusto" and it is a question about his public web presence, not a technical choice. Flag it; do not build it.
- The spec's other open items: real Correios prices and ETAs, which countries `INTL_ALLOWED_COUNTRIES` allows, the About portrait, and the Stripe dashboard steps themselves.

## Carried past the stack — a follow-up list, not this PR's work

Recorded so it is not lost when the ledger is:

- **Nothing enforces that at most one product is `featured`.** The design prototype models it as an enum over products; the schema made it a per-document boolean. The fix belongs in the API — clearing the flag on the other documents inside the same write, or a partial unique index — not in the panel, where it costs two PUTs with no transaction.
- **`shipped → shipped` is not a legal transition**, so a typo'd tracking code is permanent.
- **No `GET /api/admin/products/:id`** and no `createdAt` on the admin list.
- **Surfaces needing a prop or copy:** a failed status toggle is silent; `PhotosEditor` has no error prop; `PRODUCT_NOT_FOUND` collapses to a generic message; deleting from the form announces nothing; `Select` has no `error` prop; `TextInput` has no `inputMode`; `AdminOrder.locale` is rendered nowhere.
- **Unifying `CheckoutField` with the ~10 admin field cells** — roughly 25 call sites across 8 files, half of it shop code.
- **Measurement limits:** `:hover` is unreachable from a synthetic pointer event; no story reads a platform accessibility tree, so `ProductsTable`'s ARIA roles and `SpecsEditor`'s group description stay decided rather than measured; focus after any react-router navigation lands on `<body>`.
