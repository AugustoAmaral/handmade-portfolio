import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { retryQuery } from '../../src/app/api/client'
import { copyI18n } from '../../src/copy/i18n'
import { adminOrders } from '../../src/fixtures/orders'
import { letter, products } from '../../src/fixtures/products'

afterEach(cleanup)

const TOKEN_KEY = 'shop_admin_token'

/**
 * THE ROUTE TABLE HAD NO TEST AT ALL UNTIL THIS ONE. `admin-containers.test.tsx` builds a table of
 * its own — deliberately, and its comment says it is "the arrangement Task 9 has to mount in
 * `App.tsx`" — which means every admin behaviour on the branch was proved against a copy of the
 * table rather than against the table. A path renamed here would leave all 29 of those tests green.
 * This file is what closes that: it renders the REAL `App`, so the thing under test is the thing
 * that ships.
 */
function jwt(claims: Record<string, unknown>): string {
  const segment = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(claims)}.c2lnbmF0dXJl`
}

const liveToken = () => jwt({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 12 * 3600 })

/** `retryQuery` and not `retry: false`: the harness must not be the thing that stops a retry. */
function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: retryQuery, retryDelay: 0 }, mutations: { retry: false } },
  })
}

let lastLocation = ''
function CaptureLocation() {
  const location = useLocation()
  lastLocation = `${location.pathname}${location.search}`
  return null
}

function renderApp(entry: string) {
  return render(
    <QueryClientProvider client={newClient()}>
      <I18nextProvider i18n={copyI18n}>
        <MemoryRouter initialEntries={[entry]}>
          <CaptureLocation />
          <App />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', spy)
  return spy
}

/** Every GET the panel and the shop can make from a cold open, so no screen lands on its error. */
function stubEverything() {
  return stubFetch((url) => {
    if (url.includes('/api/admin/orders')) return json({ orders: adminOrders })
    if (url.includes('/api/admin/products')) return json({ products })
    if (url.includes('/api/products')) return json({ products })
    return json({ error: { code: 'NOT_FOUND', message: 'NOT_FOUND' } }, 404)
  })
}

const signedIn = () => localStorage.setItem(TOKEN_KEY, liveToken())

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('shop_lang', 'pt')
  await copyI18n.changeLanguage('pt')
  lastLocation = ''
})

afterEach(() => vi.unstubAllGlobals())

describe('App · the admin route table', () => {
  it('sends /admin to the products screen', async () => {
    // `/admin` is an address with no screen of its own, and the redirect is what decides which of
    // the two sections is the panel's front page. Both halves are asserted: the screen, because a
    // missing index route drops `/admin` into the catch-all and lands on the SHOP, and the URL,
    // because rendering the products screen AT `/admin` would look identical on screen and leave
    // the bar unable to mark a section — `sectionOf('/admin')` is `undefined`.
    signedIn()
    stubEverything()
    renderApp('/admin')

    expect(await screen.findByRole('heading', { level: 1, name: 'Produtos' })).toBeInTheDocument()
    expect(lastLocation).toBe('/admin/products')
  })

  it('shows the login at the address that was asked for, without moving', async () => {
    // WHY `LoginRoute` IS NOT A ROUTE ELEMENT, asserted at the level that decides it. The shell
    // renders it in place of `<Outlet/>`, so a cold deep link to the orders screen shows the login
    // AT `/admin/orders` and signing in reveals the orders. Mounted as `/admin/login` instead, this
    // location would be the login's and the destination would be gone.
    stubEverything()
    renderApp('/admin/orders')

    expect(await screen.findByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
    expect(lastLocation).toBe('/admin/orders')
  })

  it('does not redirect /admin to the products screen while signed out', async () => {
    // The index route lives UNDER the guard, which is the difference between "the panel's front
    // page is the products list" and "an anonymous visitor is bounced to a products URL before
    // being told to sign in". The reader who typed `/admin` is still at `/admin` when they do.
    stubEverything()
    renderApp('/admin')

    expect(await screen.findByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
    expect(lastLocation).toBe('/admin')
  })

  it('mounts the products table, both form modes and the orders screen', async () => {
    // The four leaves, each at its own address. `products/new` and `products/:id` are ONE element
    // at two paths and the heading is what separates them — a `:slug` param instead of `:id` leaves
    // `useParams().id` undefined, which is indistinguishable from `/new` to everything but this.
    for (const [entry, name] of [
      ['/admin/products', 'Produtos'],
      ['/admin/products/new', 'Cadastrar produto'],
      [`/admin/products/${letter.id}`, letter.name.pt],
      ['/admin/orders', 'Pedidos'],
    ] as const) {
      signedIn()
      stubEverything()
      renderApp(entry)

      expect(await screen.findByRole('heading', { level: 1, name }), entry).toBeInTheDocument()
      expect(lastLocation, entry).toBe(entry)
      cleanup()
      vi.unstubAllGlobals()
    }
  })

  it('sends an unrouted admin address to the catalogue rather than to the panel', async () => {
    // The catch-all's one interaction with the panel, and the paragraph in `App.tsx` that had to
    // change: `/admin` used to BE the unrouted address the comment made an exception for. Now that
    // it is a real screen, an unknown path under it is an address this app has never had, which is
    // the catch-all's own answer and not the panel's.
    signedIn()
    stubEverything()
    renderApp('/admin/relatorios')

    // The hero's `<h1>` is assembled from three keys around a `<br>`, so the substring is the
    // honest match — and it is spelled with `toContain` on `textContent` rather than left to
    // `toHaveTextContent`, which matches by substring whether or not that was meant.
    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading.textContent).toContain('Coisas que eu')
    expect(lastLocation).toBe('/')
    expect(screen.queryByRole('navigation', { name: 'Painel' })).toBeNull()
  })
})

/**
 * spec:11 — THE ADMIN IS UNLINKED. `ui/routes.ts` keeps its admin builders because the panel's own
 * chrome needs them, which is exactly what makes the rule unenforceable by their existence: the
 * only thing that can break it is a shop file calling one. A DOM assertion would have to render
 * every shop screen and would still miss the sixth; this reads the source and cannot.
 */
const UI_DIR = path.join(__dirname, '..', '..', 'src', 'ui')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const isAdminFile = (relative: string) =>
  relative.startsWith(`admin${path.sep}`) || relative.startsWith(path.join('pages', 'Admin'))

describe('the admin stays unlinked', () => {
  const referrers = walk(UI_DIR)
    .map((file) => ({ name: path.relative(UI_DIR, file), source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => /\broutes\.admin/.test(source))
    .map(({ name }) => name)

  it('finds admin hrefs to check', () => {
    // Without this the assertion below is vacuously green the day the builders are renamed.
    expect(referrers.length).toBeGreaterThan(0)
  })

  it('is reached only from admin files', () => {
    expect(referrers.filter((name) => !isAdminFile(name))).toEqual([])
  })
})
