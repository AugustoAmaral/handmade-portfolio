import { expect, test } from '@playwright/test'

// The shop picks its language from `navigator.language` when nothing is stored, so the copy every
// selector below matches is a property of the BROWSER rather than of the app. Pinned here: left to
// the default, this file passes on a machine whose Chromium reports en-US and fails on one that
// reports pt-BR, and neither result would be about the code.
test.use({ locale: 'pt-BR' })

// The seed (`apps/api/src/seed.ts`) is four active products, `handwritten-letter` first and the only
// one flagged featured, at R$ 50,00, physical, `stock: null` — made to order. None of them has a
// photo, so every image slot renders the "ainda sem foto" placeholder and the catalogue link's
// accessible name is that placeholder plus the name, subtitle, price and availability. Matching a
// substring of it with a regex is what keeps this test from re-encoding the whole card.
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

test('admin logs in and sees seeded products', async ({ page }) => {
  // PR 3 deletes the v1 admin and registers shop routes only, so `/admin` falls into the catch-all.
  // Skipped rather than deleted: a skipped test with a reason is a tracked commitment.
  test.skip(true, 'the admin app is deleted in PR 3 and rebuilt in PR 4')
  await page.goto('/admin')
})

test('checkout reaches Stripe', async ({ page }) => {
  test.skip(true, 'v1 web checkout is incompatible with the v2 API; re-enabled in PR 5')
  await page.goto('/')
})
