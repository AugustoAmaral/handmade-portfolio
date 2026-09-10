import { type Page, expect, test } from '@playwright/test'

// The shop picks its language from `navigator.language` when nothing is stored, so the copy every
// selector below matches is a property of the BROWSER rather than of the app. Pinned here: left to
// the default, this file passes on a machine whose Chromium reports en-US and fails on one that
// reports pt-BR, and neither result would be about the code.
test.use({ locale: 'pt-BR' })

// The seed (`apps/api/src/seed.ts`) is four active products, `handwritten-letter` first and the only
// one flagged featured, at R$ 50,00, physical, `stock: null` — made to order. It has no photo, so
// its image slot renders the "ainda sem foto" placeholder and the catalogue link's accessible name
// is that placeholder plus the name, subtitle, price and availability. Matching a substring of it
// with a regex is what keeps this test from re-encoding the whole card.
//
// ONE piece does have photos: `dev-e2e.ts` writes two onto `original-pencil-drawing`, so the panel
// has a list to reorder. Nothing in this file's shop tests reads that card, and the objects behind
// those photos do not exist — `img.example.com` does not resolve — so the requests are aborted
// below rather than left to fail on their own.

test.beforeEach(async ({ page }) => {
  await page.route('**/img.example.com/**', (route) => route.abort())
})
test('catalogue → product → bag drawer shows the line and the totals', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: /carta escrita à mão/i }).click()
  await expect(page).toHaveURL(/\/exhibit\/handwritten-letter$/)
  // The piece really is on screen before anything is added to the bag: `ProductPage` is the only
  // screen with the name as its `<h1>`, so this separates a real product page from the loading
  // screen and from the not-found screen, both of which would also answer a click.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Exhibit 001 — Carta escrita à mão')

  await page.getByRole('button', { name: /colocar na sacola/i }).click()

  // Named, not just present: the drawer is the shop's only dialog and `aria-labelledby` is what
  // makes it announce as the bag rather than as an unlabelled modal.
  const drawer = page.getByRole('dialog', { name: 'Sua sacola' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('Exhibit 001 — Carta escrita à mão')).toBeVisible()

  // The totals `<dl>`, read as a block. `\s` covers the NO-BREAK SPACE `Intl` puts between `R$` and
  // the digits — a plain space in the pattern matches nothing at all here.
  const totals = drawer.locator('dl')
  await expect(totals).toContainText('Subtotal')
  await expect(totals).toContainText(/R\$\s*50,00/)
  await expect(totals).toContainText('Total')
  // Frete is unresolved for a physical bag until the checkout asks for an address, and the dash the
  // design draws for it is `aria-hidden`, so the sentence behind it is the assertion.
  await expect(totals).toContainText('Calculado no pagamento')

  // The bag's one internal destination, and the last hop of the walk. It is here because the whole
  // suite could not see it anywhere else: the checkout's unit tests render `/checkout` directly,
  // which is a bag that was closed to begin with, and this link is only a client-side navigation at
  // all because `LinkInterceptor` is mounted — which is what this task turned on.
  await drawer.getByRole('link', { name: 'Ir para o pagamento' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Para onde eu mando, e para quem.')
  await expect(drawer).toBeHidden()
})

// The state that used to be a blank page, and the reason `NoticePage` exists. It is here rather
// than only in the unit suite because the delay is the interesting half: react-query's default
// would spend three backoffs re-asking a 404 before this screen appeared, and only a real browser
// against a real API runs that code path.
test('an address with no piece behind it gets a screen, not a blank page', async ({ page }) => {
  await page.goto('/exhibit/nao-existe')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Essa peça não está no catálogo.')
  await expect(page.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
})

/**
 * The bag → checkout walk, from a piece's own page. The first test above walks it from the
 * catalogue and asserts every hop, because there it IS the subject; below it is a precondition, so
 * it is written once instead of twice and the two tests that use it stay about what they assert.
 */
async function bagAndCheckout(page: Page, slug: string, name: string): Promise<void> {
  await page.goto(`/exhibit/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  await page.getByRole('button', { name: 'Colocar na sacola' }).click()
  await page.getByRole('dialog', { name: 'Sua sacola' }).getByRole('link', { name: 'Ir para o pagamento' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  // AND THE PAGE HAS PAINTED, which the URL does not say: `CheckoutRoute` renders `null` until the
  // catalogue query settles, and `toHaveCount(0)` is satisfied by a page that has not rendered yet.
  // Measured, not feared — the first draft of the test below passed with `ships` forced to `true`,
  // which should have put an address form on a digital-only checkout, because both of its absence
  // assertions resolved against an empty screen. Anything asserted absent needs this line first.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Para onde eu mando, e para quem.')
}

/**
 * The summary's shipping row, `<dt>` and `<dd>` read as one string. Scoped to the summary because
 * `Frete` is also a word the bag drawer says, and anchored on `^Frete` because the sibling rows in
 * the same `<dl>` are Subtotal and Total.
 */
function shippingRow(page: Page) {
  return page.getByRole('region', { name: 'Seu pedido' }).locator('dl > div').filter({ hasText: /^Frete/ })
}

/**
 * THE DIGITAL BRANCH, AND ITS OTHER HALF IN THE SAME TEST. `hasPhysicalItems(lines)` decides three
 * things at once — whether the address section renders, whether the shipping section renders, and
 * whether `computeTotals` charges postage — and it decides them from `CartLineData.type`, which is
 * copied off the API's product payload by `cartLinesOf`. Nothing in the unit suite runs that copy:
 * every story and every container test builds `CartLineData` by hand, so `type` is an input there
 * and a derived fact only here.
 *
 * THE PAIR IS THE ASSERTION. A bag whose lines all lost `type` reads as digital-only, so a test
 * that only asserted "no address form for a digital bag" would pass on a chain that dropped the
 * field entirely — and would pass it in the dangerous direction, hiding the address form from
 * someone buying a letter. So the same bag then gains a physical piece and has to grow both
 * sections back. This is the trap PR 4's Task 9 named on its own new test, in the same shape: one
 * side of a branch proves nothing about the branch.
 *
 * `R$ 0,00` IS A REAL PRICE HERE, not the em dash. `shippingCents` is `null` only while a choice is
 * pending, and a bag with nothing to post has no choice to make — so the two shipping rows below
 * are the two different things that one row can mean. Both patterns are anchored end to end for
 * that reason: `toHaveText` with a regex is a SEARCH, so an unanchored pattern about either row is
 * satisfied by the other one on the word `Frete` alone.
 *
 * THE SERVER'S HALF OF THE DIGITAL PATH IS NOT HERE. That a digital-only body is accepted with no
 * address, no method and no shipping line item is `apps/api/test/checkout.test.ts`'s "stores a
 * digital-only order without address or method and without a shipping line". This test is the half
 * that test cannot see: what the BROWSER decides to send. It deliberately stops before the submit,
 * because the only answer a submit can get here depends on which Stripe key the API booted with,
 * and a test that means two different things in two environments is not one test.
 */
test('a digital-only bag is charged no postage, and one physical piece brings the address back', async ({ page }) => {
  await bagAndCheckout(page, 'digital-letter', 'Exhibit 003 — Carta digital')

  await expect(page.getByRole('heading', { level: 2, name: '02 · Endereço de entrega' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: '03 · Envio' })).toHaveCount(0)
  await expect(shippingRow(page)).toHaveText(/^Frete\s*R\$\s*0,00$/)
  // The button names the total, so this is the totals assertion too: R$ 20,00 is the piece and
  // nothing else. `\s` covers the NO-BREAK SPACE `Intl` puts after `R$`.
  await expect(page.getByRole('button', { name: /^Pagar/ })).toHaveAccessibleName(/^Pagar R\$\s*20,00$/)

  await bagAndCheckout(page, 'handwritten-letter', 'Exhibit 001 — Carta escrita à mão')

  await expect(page.getByRole('heading', { level: 2, name: '02 · Endereço de entrega' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '03 · Envio' })).toBeVisible()
  await expect(shippingRow(page)).toHaveText(/^Frete\s*—\s*Escolha uma opção de envio$/)
  await expect(page.getByRole('button', { name: /^Pagar/ })).toHaveAccessibleName(/^Pagar R\$\s*70,00$/)
})

// The credentials `apps/api/src/dev-e2e.ts` seeds. They are defaults in that file rather than
// constants here on purpose: it is the boot that decides them, and a copy in the spec would be the
// kind of duplicate this branch has spent a whole task removing.
const ADMIN = { email: 'admin@example.com', password: 'admin123' }

// The four products `seedProducts()` upserts plus the one inactive draft `dev-e2e.ts` adds, and
// the table's own header row. Written out rather than derived: importing `SEED_PRODUCTS` would pull
// mongoose into a Playwright worker.
const PANEL_ROWS = 5

/**
 * WHAT THIS BOOT CANNOT RUN, said once rather than implied by what is missing below.
 *
 * `POST /api/admin/products/:id/photos` reaches `putObject`, which builds a Cloudflare endpoint out
 * of `R2_ACCOUNT_ID` — `e2e` here — and there is no object store behind it; `DELETE .../photos`
 * calls `deleteObject` before it filters, so it fails the same way. Both would answer 500 and
 * neither failure would be about the panel. So the two IMMEDIATE photo calls, and with them the
 * container's reseed from their responses, are exercised in `admin-containers.test.tsx` against a
 * stub and NOT here. Closing that would mean giving the e2e boot an object store or a loader hook
 * that swaps `lib/r2.js` for a fake — an API-side change, and not one this task should smuggle in.
 *
 * `sharp` is never reached either, for the same reason: the upload fails before the conversion.
 *
 * What IS reachable is the half that decides whether the panel and the API agree about the shape of
 * a photo list, and nothing on this branch has ever run it end to end.
 */
async function signIn(page: Page, to = '/admin'): Promise<void> {
  await page.goto(to)
  await expect(page.getByRole('heading', { name: 'Entrar no painel' })).toBeVisible()
  // The login is RENDERED in place of the outlet rather than navigated to, so the address the
  // reader asked for is still the address they are on.
  await expect(page).toHaveURL(new RegExp(`${to}$`))

  await page.getByLabel('E-mail').fill(ADMIN.email)
  await page.getByLabel('Senha').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('admin logs in and sees seeded products', async ({ page }) => {
  await signIn(page)

  // `/admin` has no screen of its own and the index route decides which section is behind it. This
  // is the only place the real router runs that redirect — the unit suite drives a `MemoryRouter`.
  await expect(page).toHaveURL(/\/admin\/products$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Produtos' })).toBeVisible()

  const table = page.getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(PANEL_ROWS + 1)

  // THE PANEL READS THE ADMIN LIST AND NOT THE SHOP'S. `/api/products` filters `{ active: true }`,
  // and this row is the only thing on the screen that can tell the two apart — with four active
  // seeds and nothing else, both endpoints answer with the same four products and every other
  // assertion in this test would pass on either.
  const draftRow = table.getByRole('row').filter({ hasText: 'Xilogravura inacabada' })
  await expect(draftRow.getByRole('switch', { name: /Inativo$/ })).toHaveAttribute('aria-checked', 'false')

  // Three rows read for THREE DIFFERENT facts about one cell. `stock: null` means "no limit" and
  // what no limit means branches on `type`: a physical piece is made to order, a digital one is
  // simply unlimited, and a physical piece with a number just prints it. A cell that answered the
  // same thing for every product would satisfy any one of these on its own.
  const letterRow = table.getByRole('row').filter({ hasText: 'Carta escrita à mão' })
  await expect(letterRow).toContainText(/R\$\s*50,00/)
  await expect(letterRow.getByText('Sob encomenda')).toBeAttached()

  const digitalRow = table.getByRole('row').filter({ hasText: 'Carta digital' })
  await expect(digitalRow.getByText('Sem limite')).toBeAttached()

  const drawingRow = table.getByRole('row').filter({ hasText: 'Desenho original a lápis' })
  await expect(drawingRow).toContainText(/R\$\s*120,00/)
  await expect(drawingRow.getByText('Sob encomenda')).toHaveCount(0)
  await expect(drawingRow.getByText('Sem limite')).toHaveCount(0)
  await expect(drawingRow.getByRole('switch', { name: /Ativo$/ })).toHaveAttribute('aria-checked', 'true')
})

test('the photo list the form sends is one the real API accepts', async ({ page }) => {
  await signIn(page, '/admin/products')
  // A regex because the seed's names are prefixed (`Exhibit 002 — …`) and the link is named by
  // composing its own word with the row header, so its full name carries the prefix too.
  await page.getByRole('link', { name: /^Editar Exhibit 002/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Exhibit 002/ })).toBeVisible()

  // The two cards, read by the alt text each one holds. `Foto principal` is POSITIONAL — index 0 —
  // so the names travel with the slot while the alt travels with the photo, and that is exactly the
  // difference the reorder has to show.
  const altOf = (card: string) => page.getByLabel(`Alt (PT), ${card}`)
  const before = { main: await altOf('Foto principal').inputValue(), second: await altOf('Foto 2').inputValue() }

  // THE ANTI-COINCIDENCE GUARD, and this branch has been bitten by its absence four times. If the
  // seed described both photos the same way, every assertion below would pass on a save that did
  // nothing at all.
  expect(before.main).not.toBe(before.second)
  expect(before.main).not.toBe('')

  await page.getByRole('button', { name: 'Mover para cima, Foto 2' }).click()
  await expect(altOf('Foto principal')).toHaveValue(before.second)

  await page.getByRole('button', { name: 'Salvar produto' }).click()

  // THE SAVE IS THE ASSERTION. `products.ts` refuses a PUT whose `photos` is not a permutation of
  // the keys it already holds — same length, no duplicates, nothing unknown — with a 400 keyed
  // `{ photos: ['must_match_existing'] }`. Both sides of that rule have their own test and neither
  // has ever met the other: the API's is `apps/api/test/admin-products.test.ts`, which builds the
  // body by hand, and the web's is `admin-containers.test.tsx`, which asserts the body against its
  // own expectation with `fetch` stubbed. This is the first thing on the branch to put
  // `photosForSubmit`'s real output in front of the real check.
  //
  // The form's live region specifically. `PhotosEditor` mounts one of its own, so an unqualified
  // `getByRole('status')` is two elements and a strict-mode violation rather than an assertion.
  await expect(page.locator('[role="status"]', { hasText: 'Produto salvo.' })).toBeVisible()

  // AND THE SERVER KEPT IT. A 200 only says the body was legal; a reload says it was stored, and it
  // is the one assertion here that a container reseeding from its own draft could not fake.
  await page.reload()
  await expect(altOf('Foto principal')).toHaveValue(before.second)
  await expect(altOf('Foto 2')).toHaveValue(before.main)

  // THE ALT TEXT IS THE PUT'S OTHER HALF AND THE REORDER CANNOT PROVE IT. On the server side alt
  // travels with its key too — `products.ts:56` keeps the stored alt for any entry that sends none
  // — so a form that submitted `{ key }` alone would produce exactly the two assertions above.
  // Measured, not assumed: dropping `alt` from `photosForSubmit` left this test green until these
  // four lines existed.
  //
  // The edit is a TOGGLE and not a fixed sentence, for the same reason the reorder is a swap. The
  // two alts differ in their base text, so appending or stripping a mark can never make them equal,
  // and the test can run against the same database all afternoon.
  const MARK = ' ✎'
  const toggled = before.second.endsWith(MARK) ? before.second.slice(0, -MARK.length) : before.second + MARK
  await altOf('Foto principal').fill(toggled)
  await page.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.locator('[role="status"]', { hasText: 'Produto salvo.' })).toBeVisible()

  await page.reload()
  await expect(altOf('Foto principal')).toHaveValue(toggled)
})

/**
 * A REAL Stripe test key, told apart from the two keys that must not run this test.
 *
 * `sk_test_dummy` is what `dev-e2e.ts` defaults to, and it cannot create a session — Stripe answers
 * 401 and `routes/checkout.ts` turns that into a 502. An absent secret arrives from GitHub Actions
 * as `''` rather than as undefined, which is why `dev-e2e.ts` deletes an empty value before its
 * `??=`, and why the check below is on the CONTENT of the string and not on its presence.
 *
 * A LIVE key is excluded by the same `sk_test_` test, and that half is a safety rule rather than a
 * capability one: this test really does create a Checkout Session, and a session created with a
 * live key is a real payment page for real money sitting in a real dashboard.
 */
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
const REAL_STRIPE_TEST_KEY = STRIPE_KEY !== undefined && STRIPE_KEY.startsWith('sk_test_') && STRIPE_KEY !== 'sk_test_dummy'

/**
 * THE ONE TEST ON THIS BRANCH THAT TOUCHES STRIPE, and the skip is the honest half of it. Nothing
 * here is stubbed: with a dummy key there is no Checkout Session to reach and no assertion that
 * would mean anything, so the test says why it did not run instead of passing anyway. The checkout
 * session's PARAMS have their own test (`apps/api/test/checkout-session.test.ts`) against a mocked
 * Stripe; what only this test can say is that Stripe itself accepted them.
 *
 * WHAT `REACHES STRIPE` ASSERTS IS THE DESTINATION, NOT THE PAGE. The hosted page's total is the
 * stronger fact and it is not available honestly: reading it means matching Stripe's own markup,
 * which this repo does not own and which changes without a release note, and a test that reddens on
 * someone else's redesign teaches everyone to ignore it. The amounts are asserted one step earlier,
 * on markup this repo does own — the pay button names the total, and Stripe is charged from the
 * API's re-priced order rather than from anything the browser sent.
 *
 * A PHYSICAL ORDER AND NOT v1's DIGITAL ONE. The digital session is a strict subset of this one —
 * same line items, minus the postage line and minus `payment_intent_data.shipping` — so driving the
 * physical path is the only version of this test that puts an address in front of Stripe's own
 * validation. Its cost is nine fields of form filling in markup this repo controls. The digital
 * branch's own coverage is the test above, which needs no key and therefore actually runs.
 *
 * THE TRAP WHEN RUNNING IT LOCALLY: `playwright.config.ts` sets `reuseExistingServer: !CI`, so an
 * `apps/api/src/dev-e2e.ts` already running from before you exported the key keeps its
 * `sk_test_dummy` while this process sees the real one. The test then unskips against an API that
 * cannot pay, and the 502 assertion below is worded to say so rather than to time out on a
 * navigation that was never going to happen.
 */
test('checkout reaches Stripe', async ({ page }) => {
  test.skip(!REAL_STRIPE_TEST_KEY, 'needs a real Stripe test key in STRIPE_SECRET_KEY (sk_test_…, not sk_test_dummy)')

  await bagAndCheckout(page, 'handwritten-letter', 'Exhibit 001 — Carta escrita à mão')

  await page.getByLabel('Nome completo').fill('Compra de teste')
  await page.getByLabel('E-mail').fill('e2e@example.com')
  await page.getByLabel('Telefone / WhatsApp').fill('+5531999990000')
  // Filled rather than left to `DEFAULT_COUNTRY`: this test states the preconditions it depends on,
  // and which country the form starts on belongs to the container's own tests.
  await page.getByLabel('País').fill('BR')
  await page.getByLabel('CEP').fill('30150-904')
  await page.getByLabel('Rua / logradouro').fill('Rua da Bahia')
  await page.getByLabel('Número').fill('100')
  await page.getByLabel('Bairro').fill('Centro')
  await page.getByLabel('Cidade').fill('Belo Horizonte')
  await page.getByLabel('Estado').fill('MG')
  await page.getByRole('radio', { name: /Correios PAC/ }).check()

  // THE POSTAGE IS ON THE BILL BEFORE ANYTHING LEAVES THE BROWSER: R$ 50,00 for the letter plus
  // R$ 22,00 of PAC. Chosen over the R$ 50,00 the page showed a moment ago precisely because the
  // two differ — a summary that ignored the radio would still read R$ 50,00 and still reach Stripe.
  const pay = page.getByRole('button', { name: /^Pagar/ })
  await expect(pay).toHaveAccessibleName(/^Pagar R\$\s*72,00$/)

  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/checkout'), {
    timeout: 20000,
  })
  await pay.click()
  const response = await answer
  expect(
    response.status(),
    'POST /api/checkout did not answer 200. A 502 is STRIPE_UNAVAILABLE: the API process is on a different STRIPE_SECRET_KEY than this one — usually a dev-e2e server left running from before the key was exported.',
  ).toBe(200)

  // The destination, which is the whole point: the browser can only be here because the API asked
  // Stripe for a session, Stripe issued one, and `window.location.assign` followed the URL it
  // answered with. The response body is deliberately not read — it is being read across a
  // navigation the click already started, which is a race, and landing here proves what it said.
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 20000 })
})
