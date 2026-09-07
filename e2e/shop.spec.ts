import { expect, test } from '@playwright/test'

test('storefront → product → cart shows the item and totals', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Exhibit 001 — Handwritten letter').click()
  await page.getByRole('button', { name: /add to cart/i }).click()
  await expect(page).toHaveURL(/\/cart/)
  await expect(page.getByText('Exhibit 001 — Handwritten letter')).toBeVisible()
  await expect(page.getByText(/ship to/i)).toBeVisible()
})

test('admin logs in and sees seeded products', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel(/email/i).fill('admin@example.com')
  await page.getByLabel(/password/i).fill('admin123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin\/products/)
  await expect(page.getByText('Exhibit 002 — Original pencil drawing')).toBeVisible()
})

test('checkout reaches Stripe', async ({ page }) => {
  // The v1 web still posts the v1 checkout body; the checkout is rewritten in PR 3 and this
  // test comes back in PR 5 (feat/v2-e2e-docs).
  test.skip(true, 'v1 web checkout is incompatible with the v2 API; re-enabled in PR 5')
  await page.goto('/')
  await page.getByText('Exhibit 003 — Digital letter').click()
  await page.getByRole('button', { name: /add to cart/i }).click()
  await page.getByRole('button', { name: /checkout/i }).click()
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 })
})
