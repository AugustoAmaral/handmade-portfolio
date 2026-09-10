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

test('checkout reaches Stripe', async ({ page }) => {
  test.skip(true, 'v1 web checkout is incompatible with the v2 API; re-enabled in PR 5')
  await page.goto('/')
})
