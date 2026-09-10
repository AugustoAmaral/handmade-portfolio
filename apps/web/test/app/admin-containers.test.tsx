import type { PublicProduct } from '@shop/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Navigate, type NavigateFunction, Route, Routes, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminShellContainer } from '../../src/app/AdminShellContainer'
import { retryQuery } from '../../src/app/api/client'
import { OrdersRoute } from '../../src/app/routes/admin/OrdersRoute'
import { ProductFormRoute } from '../../src/app/routes/admin/ProductFormRoute'
import { ProductsRoute } from '../../src/app/routes/admin/ProductsRoute'
import { copyI18n } from '../../src/copy/i18n'
import { adminOrders, oversoldOrder, paidOrder } from '../../src/fixtures/orders'
import { drawing, inactiveGuide, letter, products } from '../../src/fixtures/products'

afterEach(cleanup)

const TOKEN_KEY = 'shop_admin_token'

/**
 * A structurally real JWT, the shape `routes/admin/auth.ts` signs. `useAdminSession` reads `exp`
 * out of the payload before deciding a stored token is worth sending, so a hand-written string
 * would be discarded on load and every signed-in test would render the login instead.
 */
function jwt(claims: Record<string, unknown>): string {
  const segment = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(claims)}.c2lnbmF0dXJl`
}

const liveToken = () => jwt({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 12 * 3600 })

/**
 * `retryQuery` and NOT `retry: false`, which is the harness trap this branch has already paid for
 * once: a harness that switches retrying off cannot see whether the code retries, so the policy
 * under test is satisfied by the test itself. This is the client `main.tsx` builds, with the
 * BACKOFF removed rather than the policy — `retryDelay: 0` keeps `isFinalAnswer` deciding how many
 * requests a 401 and a 500 are worth, and lets the 5xx tests finish in a tick instead of seven
 * seconds. The fetch-count assertions below are what turns that into evidence.
 */
function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: retryQuery, retryDelay: 0 }, mutations: { retry: false } },
  })
}

let lastLocation = ''
/**
 * A handle on the router's own `navigate`, so a test can move between admin addresses the way a
 * row link does — leaving the matched route element MOUNTED across the change, which is the whole
 * premise of the two tests about state that must not survive it. Re-rendering with different
 * `initialEntries` cannot do it: `MemoryRouter` reads them once, on mount.
 */
let navigateTo: NavigateFunction | null = null
function CaptureRouter() {
  const location = useLocation()
  lastLocation = `${location.pathname}${location.search}`
  navigateTo = useNavigate()
  return null
}

/**
 * The admin route table, nested under the real shell — the arrangement Task 9 has to mount in
 * `App.tsx`. Everything below the provider is real: the session, the query hooks, the containers
 * and the pages. `fetch` is the only fake, as in `containers.test.tsx`.
 */
function renderAdmin(path: string, client = newClient()) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={copyI18n}>
          <MemoryRouter initialEntries={[path]}>
            <CaptureRouter />
            <Routes>
              <Route path="/admin" element={<AdminShellContainer />}>
                <Route index element={<Navigate to="/admin/products" replace />} />
                <Route path="products" element={<ProductsRoute />} />
                <Route path="products/new" element={<ProductFormRoute />} />
                <Route path="products/:id" element={<ProductFormRoute />} />
                <Route path="orders" element={<OrdersRoute />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    ),
  }
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', spy)
  return spy
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** The API's error envelope, which is what `client.ts` reads `code` and `fieldErrors` out of. */
const fail = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  json({ error: { code, message: code, ...extra } }, status)

/**
 * `DELETE /api/admin/products/:id` — the only 204 on the branch, and a real one: a body-less
 * Response, so `res.json()` REJECTS and only the `.catch(() => ({}))` in `client.ts` keeps the
 * deletion from surfacing a SyntaxError. A stub answering `json({}, 204)` would not exercise it.
 */
const noContent = () => new Response(null, { status: 204 })

type Spy = ReturnType<typeof stubFetch>
const calls = (spy: Spy, method: string) =>
  spy.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method)
const urls = (spy: Spy) => spy.mock.calls.map(([input]) => String(input))
type ApiCall = [input: RequestInfo | URL, init?: RequestInit]
const bodyOf = (call: ApiCall) => JSON.parse(String(call[1]!.body)) as Record<string, unknown>

function deferred<T>() {
  let settle!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('shop_lang', 'pt')
  await copyI18n.changeLanguage('pt')
  lastLocation = ''
  navigateTo = null
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function signedIn() {
  localStorage.setItem(TOKEN_KEY, liveToken())
}

const CATALOGUE = [...products, inactiveGuide]
const catalogue = (list: readonly PublicProduct[] = CATALOGUE) => json({ products: list })

describe('AdminShellContainer · the session guard', () => {
  it('ends the session when a 401 comes back out of useAdminProducts', async () => {
    // THE OBLIGATION TASK 1 WROTE DOWN AND NOTHING HAS DISCHARGED. `useAdminSession` has had no
    // consumer since it was written, which is the exact shape of the defect PR 3 shipped: a layer
    // with strong unit tests and no wiring. `endIfRejected` is reached from HERE or from nowhere.
    signedIn()
    const spy = stubFetch(() => fail(401, 'UNAUTHORIZED'))
    renderAdmin('/admin/products')

    expect(await screen.findByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()

    // Three separate claims, and the middle one is the half the hook cannot make on its own:
    // `client.ts` reads storage directly on every request, so a token dropped from state but left
    // in storage keeps riding on requests this session already believes are anonymous.
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(screen.getByText('Sua sessão terminou. Entre de novo.')).toBeInTheDocument()

    // The deep link is intact: the guard RENDERS the login, it does not navigate to it, which is
    // what rules out the redirect loop and what lets the URL survive signing in.
    expect(lastLocation).toBe('/admin/products')

    // ONE request. A 401 is a final answer, and this is the assertion that proves the retry policy
    // is live rather than switched off by the harness.
    expect(spy).toHaveBeenCalledOnce()
  })

  it('keeps the session through a 500, which says nothing about the token', async () => {
    // The sibling guard, mutated separately: `endIfRejected` is a REJECTION guard and not an error
    // guard. Ending the session on a 5xx would turn a blip in the API into a logout, and the
    // products screen would be replaced by a login the reader cannot act on.
    signedIn()
    const spy = stubFetch(() => fail(500, 'INTERNAL'))
    renderAdmin('/admin/products')

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo quebrou do meu lado')
    expect(localStorage.getItem(TOKEN_KEY)).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Entrar no painel' })).toBeNull()
    // Four attempts: the first plus `retryQuery`'s three. A 5xx may be over by the next tick.
    expect(calls(spy, 'GET')).toHaveLength(4)
  })

  it('keeps the session when a 401 is about the credentials rather than the token', async () => {
    // Two different 401s reach the browser. `adminGuard` answers UNAUTHORIZED about the bearer
    // token; the login answers INVALID_CREDENTIALS about a typed password. Branching on the status
    // alone would let a typo end a session that is perfectly good.
    const spy = stubFetch(() => fail(401, 'INVALID_CREDENTIALS'))
    renderAdmin('/admin/products')

    await userEvent.type(screen.getByLabelText('E-mail'), 'augusto@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail e senha não conferem.')
    // Not the session notice: nobody's session ended, this login never had one.
    expect(screen.queryByText('Sua sessão terminou. Entre de novo.')).toBeNull()
    expect(calls(spy, 'POST')).toHaveLength(1)
  })

  it('ends the session when a 401 comes back out of a MUTATION', async () => {
    // The other half of the guard, and the half a query-only subscription would miss: an expired
    // twelve-hour token shows up on the first write of the morning at least as often as on a read,
    // and a panel that kept rendering the table after one would let every later save fail silently.
    signedIn()
    stubFetch((url, init) => (init?.method === 'PUT' ? fail(401, 'UNAUTHORIZED') : catalogue()))
    renderAdmin('/admin/products')

    await userEvent.click(await screen.findByRole('switch', { name: 'Carta escrita à mão Ativo' }))

    expect(await screen.findByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('says the panel is down rather than blaming the password', async () => {
    // The sibling of the credentials branch, mutated separately: a 500 and a connection that never
    // becomes an `ApiError` at all say nothing about what was typed, and "e-mail e senha não
    // conferem" would send the reader to change a password that is perfectly good.
    stubFetch(() => fail(500, 'INTERNAL'))
    renderAdmin('/admin/products')

    await userEvent.type(screen.getByLabelText('E-mail'), 'augusto@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'certa')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo quebrou do meu lado. Tente de novo em instantes.')
  })

  it('signs in on a deep link and lands on the screen that was asked for', async () => {
    const token = liveToken()
    const spy = stubFetch((url, init) => {
      if (url.endsWith('/api/admin/login')) return json({ token })
      if (url.includes('/api/admin/orders')) return json({ orders: adminOrders })
      return fail(404, 'NOT_FOUND')
    })
    renderAdmin('/admin/orders')

    await userEvent.type(screen.getByLabelText('E-mail'), 'augusto@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'certa')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    // The orders screen, not the products one: nothing redirected, so the URL that was deep-linked
    // is the URL the session opens on.
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument()
    expect(lastLocation).toBe('/admin/orders')
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token)
    expect(urls(spy).some((url) => url.includes('/api/admin/orders'))).toBe(true)
  })

  it('marks the section the reader is on, and only that one', async () => {
    signedIn()
    stubFetch((url) => (url.includes('/orders') ? json({ orders: [] }) : catalogue()))
    renderAdmin('/admin/orders')

    const nav = await screen.findByRole('navigation', { name: 'Painel' })
    // Two links, one mark. Asserting both is what stops a derivation that answers 'products' for
    // every path from passing on the products screen alone.
    expect(within(nav).getByRole('link', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Produtos' })).not.toHaveAttribute('aria-current')
  })

  it('signs out, and drops the admin cache with the session', async () => {
    signedIn()
    stubFetch(() => catalogue())
    const { client } = renderAdmin('/admin/products')
    await screen.findByRole('heading', { level: 1, name: 'Produtos' })

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    // The next admin cannot be shown the last one's catalogue while a fresh request is in flight.
    expect(client.getQueryData(['admin', 'products'])).toBeUndefined()
  })
})

describe('ProductsRoute', () => {
  it('toggles a product without losing the fields the table cannot see', async () => {
    // THE PUT REPLACES THE DOCUMENT. `productUpdateSchema` gives `featured` a default of false, so
    // a body built from the four columns on screen would quietly UNFEATURE the piece on the shop's
    // home page every time somebody flipped its status chip. `letter` is the featured fixture and
    // `drawing` is not, which is what makes the assertion mean something.
    signedIn()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'PUT') return json({ product: { ...letter, active: false } })
      return catalogue()
    })
    renderAdmin('/admin/products')

    await userEvent.click(await screen.findByRole('switch', { name: 'Carta escrita à mão Ativo' }))

    await waitFor(() => expect(calls(spy, 'PUT')).toHaveLength(1))
    const [url, init] = calls(spy, 'PUT')[0]!
    expect(String(url)).toBe('http://localhost:3001/api/admin/products/p-letter')
    expect(bodyOf([url, init])).toEqual({
      slug: letter.slug,
      name: letter.name,
      description: letter.description,
      subtitle: letter.subtitle,
      priceCents: letter.priceCents,
      type: letter.type,
      stock: letter.stock,
      specs: letter.specs,
      featured: true,
      active: false,
    })
  })

  it('sends one PUT for a double-pressed switch, and still sends one for the row beside it', async () => {
    // Task 3 declined to add `pendingId` and said so: two presses on one chip are two PUTs today.
    // The container is the layer that knows a request is in flight, and the guard is keyed by
    // PRODUCT — a flag on the mutation alone would swallow a legitimate toggle of another row.
    signedIn()
    const held = deferred<Response>()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'PUT') return held.promise
      return catalogue()
    })
    renderAdmin('/admin/products')

    const letterSwitch = await screen.findByRole('switch', { name: 'Carta escrita à mão Ativo' })
    await userEvent.click(letterSwitch)
    await userEvent.click(letterSwitch)
    await userEvent.click(screen.getByRole('switch', { name: 'Desenho a nanquim Ativo' }))

    await waitFor(() => expect(calls(spy, 'PUT')).toHaveLength(2))
    expect(calls(spy, 'PUT').map(([url]) => String(url))).toEqual([
      'http://localhost:3001/api/admin/products/p-letter',
      'http://localhost:3001/api/admin/products/p-drawing',
    ])
    held.settle(json({ product: letter }))
  })

  it('deletes a row on the second press, says so, and leaves focus somewhere', async () => {
    signedIn()
    let list: PublicProduct[] = [...CATALOGUE]
    // The DELETE is HELD, which is the only way this can be an assertion about the commit rather
    // than about the refetch: once the row is gone its confirmation is gone with it, so a container
    // that never cleared the id would look identical from out here.
    const held = deferred<Response>()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'DELETE') {
        list = list.filter((product) => product.id !== drawing.id)
        return held.promise
      }
      return catalogue(list)
    })
    renderAdmin('/admin/products')

    await userEvent.click(await screen.findByRole('button', { name: 'Apagar Desenho a nanquim' }))
    // One press asks; nothing has been sent.
    expect(calls(spy, 'DELETE')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Sim, apagar Desenho a nanquim' }))

    await waitFor(() => expect(calls(spy, 'DELETE')).toHaveLength(1))
    expect(String(calls(spy, 'DELETE')[0]![0])).toBe('http://localhost:3001/api/admin/products/p-drawing')

    // Gone in the same commit as the request, while the ROW IS STILL THERE — so a second press
    // cannot 404 a product the first press has already sent for.
    expect(screen.queryByRole('button', { name: 'Sim, apagar Desenho a nanquim' })).toBeNull()
    expect(screen.getByRole('rowheader', { name: /Desenho a nanquim/ })).toBeInTheDocument()

    held.settle(noContent())
    expect(await screen.findByText('Produto apagado.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Desenho a nanquim')).toBeNull())

    // The button that was pressed went with the row and took focus to `<body>` — the limitation
    // `SpecsEditor` reported for the same shape and the one no stateless layer can fix. The band's
    // own control is where the reader is put instead.
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Novo produto' }))
  })

  it('waits on a loading screen rather than announcing a failure it has not had', async () => {
    // `loadFailed` is `!products`, and on the very first render there is no products either way —
    // so without the pending gate every visit to the panel opens on "algo quebrou do meu lado" and
    // then corrects itself. The two assertions are the two halves: what is shown and what is not.
    signedIn()
    const held = deferred<Response>()
    stubFetch(() => held.promise)
    renderAdmin('/admin/products')

    expect(await screen.findByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()

    // AND IT ASKS FOR THE PANEL'S GUTTER, which is the half no story can hold. `LoadingPage` is
    // shared with the shop and the two do not have one gutter: 64px against 40px at the widest
    // viewport, so the wrong one makes the screen step sideways as the table arrives. Its own story
    // measures that the utility resolves to the narrower padding; only a container test can say the
    // container asked for it. The class rather than the computed value, because jsdom compiles no
    // CSS — the two assertions are complementary and neither is sufficient.
    expect(screen.getByRole('status')).toHaveClass('px-gutter-admin')

    held.settle(catalogue())
    expect(await screen.findByRole('rowheader', { name: /Carta escrita à mão/ })).toBeInTheDocument()
  })

  it('says a delete failed instead of pretending it worked', async () => {
    signedIn()
    const spy = stubFetch((url, init) =>
      init?.method === 'DELETE' ? fail(500, 'INTERNAL') : catalogue(),
    )
    renderAdmin('/admin/products')

    await userEvent.click(await screen.findByRole('button', { name: 'Apagar Desenho a nanquim' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, apagar Desenho a nanquim' }))

    await waitFor(() => expect(calls(spy, 'DELETE')).toHaveLength(1))
    expect(await screen.findByText('Algo quebrou do meu lado. Tente de novo em instantes.')).toBeInTheDocument()
    // The row is still there, which is the truth: nothing was deleted.
    expect(screen.getByRole('rowheader', { name: /Desenho a nanquim/ })).toBeInTheDocument()
  })

  it('separates a panel that is down from a catalogue that is empty, and asks again on demand', async () => {
    signedIn()
    let answers = 0
    const spy = stubFetch(() => {
      answers += 1
      return answers <= 4 ? fail(503, 'INTERNAL') : catalogue()
    })
    renderAdmin('/admin/products')

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo quebrou do meu lado')
    // NOT the empty catalogue's sentence: handed `[]` on a failed request the page would say
    // "nenhum produto ainda" about a panel that simply could not ask.
    expect(screen.queryByText('Nenhum produto ainda.')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('rowheader', { name: /Carta escrita à mão/ })).toBeInTheDocument()
    expect(calls(spy, 'GET').length).toBeGreaterThan(4)
  })
})

describe('OrdersRoute', () => {
  it('asks for the three filter modes the API really has', async () => {
    signedIn()
    const spy = stubFetch(() => json({ orders: adminOrders }))
    renderAdmin('/admin/orders')

    await screen.findByRole('heading', { level: 1, name: 'Pedidos' })
    // ABSENT, and genuinely absent: `?status=` is a 400, and no parameter is the API's own default
    // of everything except `expired` — a third mode, not a synonym for `all`.
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/orders'])

    const filter = screen.getByLabelText('Situação')
    await userEvent.selectOptions(filter, 'all')
    await waitFor(() => expect(urls(spy)).toContain('http://localhost:3001/api/admin/orders?status=all'))

    await userEvent.selectOptions(filter, 'paid')
    await waitFor(() => expect(urls(spy)).toContain('http://localhost:3001/api/admin/orders?status=paid'))

    // And back to absent, which is the mode the panel opens in and the one a two-state control
    // would have lost.
    await userEvent.selectOptions(filter, 'default')
    await waitFor(() => expect(urls(spy).filter((url) => url.endsWith('/api/admin/orders'))).toHaveLength(2))
  })

  it('waits on a loading screen on the first visit, filter or no filter', async () => {
    signedIn()
    const held = deferred<Response>()
    stubFetch(() => held.promise)
    renderAdmin('/admin/orders')

    expect(await screen.findByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()

    held.settle(json({ orders: adminOrders }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument()
  })

  it('dispatches the order the URL names, with no tracking code at all when none was typed', async () => {
    signedIn()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'PATCH') return json({ order: { ...paidOrder, status: 'shipped' } })
      return json({ orders: adminOrders })
    })
    renderAdmin(`/admin/orders?order=${paidOrder.id}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como despachado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(calls(spy, 'PATCH')).toHaveLength(1))
    const call = calls(spy, 'PATCH')[0]!
    // `paidOrder.id`, not the first order in the list: `adminOrders` opens with `oversoldOrder`,
    // so a container that dispatched the first row would look identical on a one-order fixture.
    expect(String(call[0])).toBe('http://localhost:3001/api/admin/orders/o-2')
    // ABSENT and not empty. `trackingCode` is `.optional()` after a trim, so `''` is a 400 on a
    // shipment that is otherwise legal — and blank is what a parcel handed over in person has.
    expect(bodyOf(call)).toEqual({ status: 'shipped' })
  })

  it('sends a typed tracking code and closes the form when it lands', async () => {
    signedIn()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'PATCH') return json({ order: { ...paidOrder, status: 'shipped' } })
      return json({ orders: adminOrders })
    })
    renderAdmin(`/admin/orders?order=${paidOrder.id}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como despachado' }))
    await userEvent.type(screen.getByLabelText('Código de rastreio (opcional)'), '  BR9911777SC  ')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(calls(spy, 'PATCH')).toHaveLength(1))
    expect(bodyOf(calls(spy, 'PATCH')[0]!)).toEqual({ status: 'shipped', trackingCode: 'BR9911777SC' })
    await waitFor(() => expect(screen.queryByLabelText('Código de rastreio (opcional)')).toBeNull())
  })

  it('keeps the form open when the order has already moved on', async () => {
    // 409 INVALID_TRANSITION should be unreachable from the UI — the button is derived from the
    // same `canTransition` the API checks — but a list that went stale in another tab is exactly
    // how it arrives. `TrackingInlineForm` says a container that closed the form on failure would
    // swallow the only explanation of what happened.
    signedIn()
    stubFetch((url, init) =>
      init?.method === 'PATCH' ? fail(409, 'INVALID_TRANSITION') : json({ orders: adminOrders }),
    )
    renderAdmin(`/admin/orders?order=${paidOrder.id}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como despachado' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este pedido já mudou de situação.')
    expect(screen.getByLabelText('Código de rastreio (opcional)')).toBeInTheDocument()
  })

  it('does not carry one order’s tracking code over to another', async () => {
    // react-router renders ONE element for `/admin/orders`, so changing `?order=` leaves this
    // container mounted — the shape that put `ProductRoute` on the wrong photograph. A code typed
    // for one order and left unsent would be sitting in the field of the next one, and that field's
    // whole purpose is to be PATCHed onto whichever order is on screen.
    signedIn()
    stubFetch(() => json({ orders: adminOrders }))
    renderAdmin(`/admin/orders?order=${paidOrder.id}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como despachado' }))
    await userEvent.type(screen.getByLabelText('Código de rastreio (opcional)'), 'BR0000001SC')

    // `oversoldOrder` is the OTHER dispatchable fixture, so the affordance is identical on both and
    // the only difference the assertion can be reading is the state that was reset.
    await act(async () => void navigateTo!(`/admin/orders?order=${oversoldOrder.id}`))

    expect(await screen.findByRole('button', { name: 'Marcar como despachado' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Código de rastreio (opcional)')).toBeNull()
  })
})

describe('ProductFormRoute', () => {
  it('seeds the form from the admin list and PUTs every photo key back exactly once', async () => {
    // There is no `GET /api/admin/products/:id` at all — the form is fed by the LIST, which is the
    // same cache the table reads. And `products.ts:50` refuses a PUT whose `photos` is not a
    // permutation of what exists, so the array is the whole point of the assertion.
    signedIn()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'PUT') return json({ product: letter })
      return catalogue()
    })
    renderAdmin('/admin/products/p-letter')

    expect(await screen.findByLabelText('Identificador')).toHaveValue('carta-escrita')
    expect(screen.getByLabelText(/^Preço/)).toHaveValue('45,00')

    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))

    await waitFor(() => expect(calls(spy, 'PUT')).toHaveLength(1))
    const body = bodyOf(calls(spy, 'PUT')[0]!)
    expect(body['photos']).toEqual([
      { key: 'products/letter/1.webp', alt: letter.photos[0]!.alt },
      { key: 'products/letter/2.webp', alt: letter.photos[1]!.alt },
    ])
    expect(body['featured']).toBe(true)
    expect(body['stock']).toBeNull()
    expect(await screen.findByText('Produto salvo.')).toBeInTheDocument()
  })

  it('marks a piece for the home page, and leaves the shop switch beside it alone', async () => {
    // THE HALF THE PLAN DROPPED. Task 8 pinned the CARRY-THROUGH — a save must not unfeature the
    // hero — but nothing could set the flag, so `featured` was reachable only by editing the
    // database by hand. `drawing` is the fixture that makes this assertion mean something: it is
    // ACTIVE and NOT featured, so a control reading `active` would show it as marked and a save
    // built from `active` would send `true` for a piece that carries `false`.
    signedIn()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'PUT') return json({ product: { ...drawing, featured: true } })
      return catalogue()
    })
    renderAdmin('/admin/products/p-drawing')

    const featured = await screen.findByLabelText('Página inicial')
    expect(featured).toHaveValue('unmarked')
    expect(screen.getByLabelText('Situação')).toHaveValue('active')

    await userEvent.selectOptions(featured, 'marked')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))

    await waitFor(() => expect(calls(spy, 'PUT')).toHaveLength(1))
    const put = bodyOf(calls(spy, 'PUT')[0]!)
    expect(put['featured']).toBe(true)
    // The other boolean in the row, untouched. Two adjacent selects over the same two shapes is
    // exactly where a handler writing the wrong key would still look right on screen.
    expect(put['active']).toBe(true)
  })

  it('takes the mark off the piece that carries it', async () => {
    // The other direction, on the other fixture: `letter` is the only featured product, and
    // `productUpdateSchema` defaults `featured` to false — so a form that simply STOPPED sending
    // the key would pass this test while failing the one above it. The pair is what pins the
    // value as sent rather than as defaulted.
    signedIn()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'PUT') return json({ product: { ...letter, featured: false } })
      return catalogue()
    })
    renderAdmin('/admin/products/p-letter')

    const featured = await screen.findByLabelText('Página inicial')
    expect(featured).toHaveValue('marked')

    await userEvent.selectOptions(featured, 'unmarked')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))

    await waitFor(() => expect(calls(spy, 'PUT')).toHaveLength(1))
    expect(bodyOf(calls(spy, 'PUT')[0]!)['featured']).toBe(false)
  })

  it('reseeds the photo list from the upload’s answer, so the next save is not a 400', async () => {
    // Task 5's finding, and the one the plan says costs a `{ photos: ['must_match_existing'] }`:
    // adding a photo is an IMMEDIATE server call that answers with the WHOLE product, while the
    // order and the alt text ride on the product's own PUT. A container that kept its stale list
    // would send two keys for a product that now has three.
    signedIn()
    const third = { key: 'products/letter/3.webp', url: 'https://img.example.com/3.webp', alt: { pt: '', en: '' } }
    const spy = stubFetch((url, init) => {
      if (init?.method === 'POST' && url.includes('/photos'))
        return json({ product: { ...letter, photos: [...letter.photos, third] } }, 201)
      if (init?.method === 'PUT') return json({ product: letter })
      return catalogue()
    })
    renderAdmin('/admin/products/p-letter')

    const picker = await screen.findByLabelText(/Adicionar foto/)
    await userEvent.upload(picker, new File(['x'], 'nova.png', { type: 'image/png' }))

    await waitFor(() => expect(calls(spy, 'POST')).toHaveLength(1))
    // The multipart POST carries no JSON content-type of its own: the boundary is the body's.
    expect(calls(spy, 'POST')[0]![1]!.body).toBeInstanceOf(FormData)

    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))
    await waitFor(() => expect(calls(spy, 'PUT')).toHaveLength(1))
    expect((bodyOf(calls(spy, 'PUT')[0]!)['photos'] as unknown[]).map((p) => (p as { key: string }).key)).toEqual([
      'products/letter/1.webp',
      'products/letter/2.webp',
      'products/letter/3.webp',
    ])
  })

  it('reseeds the photo list from the delete’s answer too, and asks first', async () => {
    signedIn()
    // Held for the reason the products table's delete is held: once the card is gone its
    // confirmation is gone too, and the assertion would be reading the reseed instead of the commit.
    const held = deferred<Response>()
    const spy = stubFetch((url, init) => {
      if (init?.method === 'DELETE' && url.includes('/photos')) return held.promise
      if (init?.method === 'PUT') return json({ product: letter })
      return catalogue()
    })
    renderAdmin('/admin/products/p-letter')

    await userEvent.click(await screen.findByRole('button', { name: /Apagar.*Foto principal/ }))
    expect(calls(spy, 'DELETE')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: /Sim, apagar.*Foto principal/ }))

    await waitFor(() => expect(calls(spy, 'DELETE')).toHaveLength(1))
    // Gone with the request, while the card is still on screen: a second press cannot ask the API
    // to remove a key the first press has already sent for.
    expect(screen.queryByRole('button', { name: /Sim, apagar.*Foto principal/ })).toBeNull()
    expect(screen.getByLabelText(/Alt \(PT\), Foto principal/)).toBeInTheDocument()
    // The R2 key is a path with slashes in it and has to survive the query string.
    expect(String(calls(spy, 'DELETE')[0]![0])).toBe(
      'http://localhost:3001/api/admin/products/p-letter/photos?key=products%2Fletter%2F1.webp',
    )

    held.settle(json({ product: { ...letter, photos: [letter.photos[1]!] } }))

    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))
    await waitFor(() => expect(calls(spy, 'PUT')).toHaveLength(1))
    expect((bodyOf(calls(spy, 'PUT')[0]!)['photos'] as unknown[]).map((p) => (p as { key: string }).key)).toEqual([
      'products/letter/2.webp',
    ])
  })

  it('refuses a draft the schema rejects without asking the API', async () => {
    signedIn()
    const spy = stubFetch(() => catalogue())
    renderAdmin('/admin/products/new')

    await userEvent.type(await screen.findByLabelText('Identificador'), 'Carta Nova')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))

    expect(calls(spy, 'POST')).toHaveLength(0)
    // The slug's own error, at the field, and the summary beside the button — not a request that
    // would have come back 400 with the same information after a round trip.
    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos marcados acima.')
  })

  it('creates a product and moves to its own address', async () => {
    signedIn()
    const created: PublicProduct = { ...letter, id: 'p-new', slug: 'caderno-novo', photos: [], featured: false }
    const spy = stubFetch((url, init) => {
      if (init?.method === 'POST') return json({ product: created }, 201)
      return catalogue([...CATALOGUE, created])
    })
    renderAdmin('/admin/products/new')

    // With a trailing space, which is what a paste carries: the schema's `/^[a-z0-9-]+$/` would
    // reject it with a message about a character nobody can see on the screen.
    await userEvent.type(await screen.findByLabelText('Identificador'), 'caderno-novo ')
    await userEvent.type(screen.getByLabelText(/^Preço/), '19,99')
    await userEvent.type(screen.getByLabelText('Nome'), 'Caderno novo')
    await userEvent.type(screen.getByLabelText('Name'), 'New notebook')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Um caderno.')
    await userEvent.type(screen.getByLabelText('Description'), 'A notebook.')
    await userEvent.type(screen.getByLabelText('Estoque'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))

    await waitFor(() => expect(calls(spy, 'POST')).toHaveLength(1))
    const body = bodyOf(calls(spy, 'POST')[0]!)
    // 1999 and not 1998: the digits are combined as integers because `19.99 * 100` is
    // 1998.9999999999998, which loses a centavo under floor and is not an integer at all.
    expect(body['slug']).toBe('caderno-novo')
    expect(body['priceCents']).toBe(1999)
    expect(body['stock']).toBe(3)
    // No `photos` on a create: there is no id to key them by and the API strips the field anyway.
    expect(body['photos']).toBeUndefined()

    await waitFor(() => expect(lastLocation).toBe('/admin/products/p-new'))
  })

  it('does not repaint the draft with what the server last had', async () => {
    // A save invalidates the list, so a NEW product object arrives moments later — and a container
    // that reseeded from it, or from the save's own answer, would overwrite anything typed while
    // the request was in flight. The Save button is disabled during it; the fields are not.
    signedIn()
    stubFetch((url, init) => (init?.method === 'PUT' ? json({ product: letter }) : catalogue()))
    renderAdmin('/admin/products/p-letter')

    const name = await screen.findByLabelText('Nome')
    await userEvent.clear(name)
    await userEvent.type(name, 'Carta renomeada')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))

    // The stub answers with the ORIGINAL name, which is what makes this readable: reseeding from
    // either the response or the refetch would put "Carta escrita à mão" back in the box.
    expect(await screen.findByText('Produto salvo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Carta renomeada')
  })

  it('says a slug is taken in words rather than in the API’s code', async () => {
    signedIn()
    stubFetch((url, init) => (init?.method === 'PUT' ? fail(409, 'SLUG_TAKEN') : catalogue()))
    renderAdmin('/admin/products/p-letter')

    await userEvent.click(await screen.findByRole('button', { name: 'Salvar produto' }))

    // `useErrorMessage` returns the code itself for anything it does not know, so a container that
    // forwarded `SLUG_TAKEN` straight through would print SLUG_TAKEN at the reader.
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse identificador já está em uso.')
  })

  /**
   * THE UPLOAD'S FAILURES, IN THE ONLY SLOT THIS SCREEN HAS FOR THEM. `PhotosEditor` has no error
   * prop — its own message line carries the checks the browser makes BEFORE posting — so a server
   * refusal lands in the action bar at the bottom of the form, beside Save, and not beside the
   * photos. That is the deferred gap, not a choice made here.
   *
   * All three of these were the same `INTERNAL` until now, because this container answered every
   * upload failure with a hard-coded code and never read the one the API sent.
   */
  it('says a photo the server could not read in words rather than in the API’s code', async () => {
    // THE ONE OF THE THREE THE PANEL CAN ACTUALLY PRODUCE. `photoProblem` checks the type the
    // BROWSER reports, and a browser derives it largely from the extension — so a renamed PDF, a
    // truncated download or a renamed HEIC is `image/jpeg` to this check, passes it, and fails
    // inside sharp on the other side.
    signedIn()
    stubFetch((url, init) =>
      init?.method === 'POST' && url.includes('/photos') ? fail(400, 'PHOTO_UNREADABLE') : catalogue(),
    )
    renderAdmin('/admin/products/p-letter')

    const picker = await screen.findByLabelText(/Adicionar foto/)
    await userEvent.upload(picker, new File(['%PDF-1.4'], 'foto.jpg', { type: 'image/jpeg' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não consegui ler este arquivo como foto. Mande um JPEG, PNG ou WebP.',
    )
  })

  it('names the real limit when the server refuses a photo for its size', async () => {
    // REACHABLE ONLY IF THE TWO GUARDS DRIFT, and that is why the mapping is here rather than left
    // out: `photoProblem` refuses `>= MAX_PHOTO_BYTES` in the browser and multer only errors ABOVE
    // it, so today no file passes one and trips the other. What this pins is that the panel has a
    // sentence for the answer the API gives — an unmapped code is printed RAW at the reader — and
    // that the sentence names the shared constant instead of a literal.
    signedIn()
    stubFetch((url, init) =>
      init?.method === 'POST' && url.includes('/photos') ? fail(413, 'PHOTO_TOO_LARGE') : catalogue(),
    )
    renderAdmin('/admin/products/p-letter')

    const picker = await screen.findByLabelText(/Adicionar foto/)
    await userEvent.upload(picker, new File(['x'], 'nova.png', { type: 'image/png' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta foto passa de 8 MB. Mande uma menor.')
  })

  it('still collapses an upload failure it has no sentence for', async () => {
    // The other direction, and the one that keeps the two tests above from being satisfied by a
    // container that forwards whatever arrives: `PHOTO_NOT_FOUND` has no entry in the table, so
    // forwarding it would print PHOTO_NOT_FOUND in English capitals at the one person who reads
    // this screen. Task 8's finding, and the reason `SLUG_TAKEN` needed a line of its own.
    signedIn()
    stubFetch((url, init) =>
      init?.method === 'POST' && url.includes('/photos') ? fail(404, 'PHOTO_NOT_FOUND') : catalogue(),
    )
    renderAdmin('/admin/products/p-letter')

    const picker = await screen.findByLabelText(/Adicionar foto/)
    await userEvent.upload(picker, new File(['x'], 'nova.png', { type: 'image/png' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo quebrou do meu lado. Tente de novo em instantes.')
  })

  it('deletes the product it is editing and goes back to the table', async () => {
    signedIn()
    let list: PublicProduct[] = [...CATALOGUE]
    const spy = stubFetch((url, init) => {
      if (init?.method === 'DELETE') {
        list = list.filter((product) => product.id !== letter.id)
        return noContent()
      }
      return catalogue(list)
    })
    renderAdmin('/admin/products/p-letter')

    await userEvent.click(await screen.findByRole('button', { name: 'Apagar este produto' }))
    expect(calls(spy, 'DELETE')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Sim, apagar Carta escrita à mão' }))

    await waitFor(() => expect(calls(spy, 'DELETE')).toHaveLength(1))
    await waitFor(() => expect(lastLocation).toBe('/admin/products'))
  })

  it('sends an unknown id back to the table rather than waiting forever', async () => {
    signedIn()
    stubFetch(() => catalogue())
    renderAdmin('/admin/products/p-does-not-exist')

    await waitFor(() => expect(lastLocation).toBe('/admin/products'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Produtos' })).toBeInTheDocument()
  })
})
