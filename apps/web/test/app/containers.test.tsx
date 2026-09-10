import { SHIPPING_METHODS, formatPrice } from '@shop/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, type NavigateFunction, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShopShellContainer } from '../../src/app/ShopShellContainer'
import { AboutRoute } from '../../src/app/routes/AboutRoute'
import { CheckoutRoute } from '../../src/app/routes/CheckoutRoute'
import { DoneRoute } from '../../src/app/routes/DoneRoute'
import { HomeRoute } from '../../src/app/routes/HomeRoute'
import { ProductRoute } from '../../src/app/routes/ProductRoute'
import { copyI18n } from '../../src/copy/i18n'
import { digitalLetter, drawing, letter } from '../../src/fixtures/products'

// Testing-library only auto-unmounts with `globals: true`, which this project does not use. Without
// this every query after the first test also sees the previous render's DOM.
afterEach(cleanup)

/**
 * `fetch` is the only fake in this file. The QueryClient, the router, the i18n instance, `useCart`,
 * `useLang` and every container are the real ones — this is the layer where the wiring between them
 * is the thing under test, and a mocked hook would be testing the mock.
 *
 * `retry: false` is load-bearing rather than tidy: with the default, the error-path tests sit
 * through three retries and time out, which reads as a flake instead of a failed assertion.
 */
function renderShop(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={copyI18n}>
        <MemoryRouter initialEntries={[path]}>
          <CaptureNavigate />
          {/* The real route table, nested under the real shell. The containers read the cart, the
              language and the drawer intents off the shell's outlet context, which is the only way
              one cart and one drawer can exist: a route holding its own `useCart` would show a bag
              that stops agreeing with the header's the moment either changes it. So they are
              rendered the way the app renders them, not stripped to one element. */}
          <Routes>
            <Route element={<ShopShellContainer />}>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/exhibit/:slug" element={<ProductRoute />} />
              <Route path="/about" element={<AboutRoute />} />
              <Route path="/checkout" element={<CheckoutRoute />} />
              <Route path="/thanks" element={<DoneRoute />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

// A handle on the router's own `navigate`, so a test can move between routes the way a link does —
// leaving the matched route element MOUNTED across the change, which is the entire premise of the
// selected-photo test below. Re-rendering with different `initialEntries` would remount instead and
// reset the state the test is about.
let navigateTo: NavigateFunction | null = null
function CaptureNavigate() {
  navigateTo = useNavigate()
  return null
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', spy)
  return spy
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// The API's real envelopes. `routes/products.ts` answers `{ products }` and `{ product }`,
// `routes/orders.ts` answers `{ order }` — never the bare value — and the query hooks are what take
// them off. A stub that returned the bare value would let an unwrapping bug pass.
const catalogue = (...products: unknown[]) => json({ products })
const orderBody = (order: unknown) => json({ order })

const postsIn = (spy: ReturnType<typeof stubFetch>) =>
  spy.mock.calls.filter(([, init]) => init?.method === 'POST')
const orderCallsIn = (spy: ReturnType<typeof stubFetch>) =>
  spy.mock.calls.filter(([input]) => String(input).includes('/api/orders'))

const realLocation = window.location
/** jsdom throws "Not implemented: navigation" on a real `assign`, and the URL is the assertion. */
function stubAssign() {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: realLocation.origin, href: realLocation.href, assign },
  })
  return assign
}

beforeEach(async () => {
  localStorage.clear()
  // jsdom reports `navigator.language` as 'en-US', so a shell left to sniff it renders the whole
  // app in English and every assertion below reads a key instead of its translation. A stored
  // preference is what a returning Brazilian visitor actually has.
  localStorage.setItem('shop_lang', 'pt')
  await copyI18n.changeLanguage('pt')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

function putInCart(...items: { slug: string; qty: number }[]) {
  localStorage.setItem('shop_cart', JSON.stringify(items))
}

function storedCart(): { slug: string; qty: number }[] {
  return JSON.parse(localStorage.getItem('shop_cart') ?? 'null') as { slug: string; qty: number }[]
}

/** The `<dd>` beside a totals `<dt>`, read structurally: `Intl`'s no-break space never survives a
 *  text query, and the row's meaning is "the value that belongs to THIS label". */
function valueOf(label: string | RegExp): HTMLElement {
  const term = screen.getByText(label)
  const value = term.nextElementSibling
  if (!value) throw new Error(`the totals row "${String(label)}" has no value cell after its label`)
  return value as HTMLElement
}

async function fill(label: string, value: string) {
  const field = screen.getByLabelText(label)
  await userEvent.clear(field)
  if (value !== '') await userEvent.type(field, value)
}

/** The smallest form `checkoutRequestSchema` AND `checkoutRules` both accept for a Brazilian bag. */
async function fillValidBrazilianForm() {
  await fill('Nome completo', 'Ma')
  await fill('E-mail', 'ma@example.com')
  await fill('CEP', '30150-904')
  await fill('Rua / logradouro', 'Rua Sapucaí')
  await fill('Número', '388')
  await fill('Bairro', 'Floresta')
  await fill('Cidade', 'Belo Horizonte')
  await fill('Estado', 'MG')
  await userEvent.click(await screen.findByRole('radio', { name: /SEDEX/ }))
}

describe('ShopShellContainer', () => {
  it('prices the bag from the catalogue and shows only what is in it', async () => {
    // FOUR DIFFERENT NUMBERS, on purpose. Two lines at two quantities make the unit price, the line
    // total, the subtotal and the item count all distinct — at one line of one piece they collapse
    // into the same figure and every assertion below would pass for a container that printed any
    // of them in any of the others' places. Task 9 and Task 10 each lost a mutation to exactly that.
    putInCart({ slug: letter.slug, qty: 2 }, { slug: drawing.slug, qty: 1 })
    stubFetch(() => catalogue(letter, drawing, digitalLetter))
    renderShop('/')

    // 3, not 2: the count is the sum of the quantities and not the number of lines, and it lives
    // inside the control's accessible NAME, so this reads the header's wiring at the same time.
    await userEvent.click(await screen.findByRole('button', { name: 'Sacola (3)' }))

    const drawer = within(screen.getByRole('dialog'))
    expect(drawer.getByText(letter.name.pt)).toBeInTheDocument()
    // The catalogue's third piece is not in the bag. A container that handed the drawer the
    // catalogue instead of the cart would pass every other assertion here.
    expect(drawer.queryByText(digitalLetter.name.pt)).toBeNull()

    // The line's own total, read off the trailing cell of its `<li>`: 2 × R$ 45,00, which is
    // neither the unit price nor the subtotal.
    const letterLine = drawer.getByText(letter.name.pt).closest('li')!
    expect(letterLine.lastElementChild?.textContent).toBe(formatPrice(letter.priceCents * 2, 'pt'))
    expect(valueOf('Subtotal').textContent).toBe(
      formatPrice(letter.priceCents * 2 + drawing.priceCents, 'pt'),
    )
    // Not chosen yet, and the bag is not where it is chosen.
    expect(valueOf('Frete').textContent).toBe('—Calculado no pagamento')
  })

  it('changes the quantity from inside the bag, and removes the line at one', async () => {
    putInCart({ slug: letter.slug, qty: 2 })
    stubFetch(() => catalogue(letter))
    renderShop('/')
    await userEvent.click(await screen.findByRole('button', { name: 'Sacola (2)' }))
    const drawer = within(screen.getByRole('dialog'))

    await userEvent.click(drawer.getByRole('button', { name: 'Aumentar quantidade' }))
    expect(screen.getByRole('button', { name: 'Sacola (3)' })).toBeInTheDocument()

    await userEvent.click(drawer.getByRole('button', { name: 'Diminuir quantidade' }))
    await userEvent.click(drawer.getByRole('button', { name: 'Diminuir quantidade' }))
    // Both directions, and the subtotal follows: a container that wired the two the same way round
    // passes a count assertion in one direction and nothing else.
    expect(screen.getByRole('button', { name: 'Sacola (1)' })).toBeInTheDocument()
    expect(valueOf('Subtotal').textContent).toBe(formatPrice(letter.priceCents, 'pt'))

    await userEvent.click(drawer.getByRole('button', { name: 'Diminuir quantidade' }))
    // There is no separate remove control, in the design or here: decrementing the last one is it.
    expect(screen.getByText('A sacola está vazia.')).toBeInTheDocument()
    expect(storedCart()).toEqual([])
  })

  it('closes the bag on Escape', async () => {
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch(() => catalogue(letter))
    renderShop('/')

    await userEvent.click(await screen.findByRole('button', { name: 'Sacola (1)' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('moves focus into the bag when it opens and back to the opener when it closes', async () => {
    // THE TWO ASSERTIONS ONLY WORK TOGETHER. "Focus comes back to the bag button" passes for a
    // container that never moved focus at all — it never left the button. "Focus went into the
    // drawer" passes for one that traps a reader inside a bag they have closed. The first is what
    // makes the second mean anything, which is why it is also first in the file.
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch(() => catalogue(letter))
    renderShop('/')

    const bag = await screen.findByRole('button', { name: 'Sacola (1)' })
    await userEvent.click(bag)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar a sacola' }))

    await userEvent.keyboard('{Escape}')
    expect(document.activeElement).toBe(bag)
  })

  it('keeps Tab inside the open bag, in both directions', async () => {
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch(() => catalogue(letter))
    renderShop('/')
    await userEvent.click(await screen.findByRole('button', { name: 'Sacola (1)' }))

    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Fechar a sacola' })
    const checkout = within(dialog).getByRole('link', { name: 'Ir para o pagamento' })

    // Forwards off the end. jsdom moves focus for nobody, so the browser's own Tab cannot get in
    // the way here — what is being read is the handler, which is the whole of the trap in a real
    // browser: cancel the default move and place focus itself.
    checkout.focus()
    expect(pressTab()).toBe(true)
    expect(document.activeElement).toBe(close)

    // Backwards off the front, which is a separate branch and a separate promise: without it Shift
    // and Tab walks straight out of the top of a dialog that claims to be modal.
    close.focus()
    expect(pressTab({ shift: true })).toBe(true)
    expect(document.activeElement).toBe(checkout)
  })

  it('adds from the product page, opens the bag, and returns focus to the button that opened it', async () => {
    stubFetch((url) => (url.includes(`/products/${letter.slug}`) ? json({ product: letter }) : catalogue(letter)))
    renderShop(`/exhibit/${letter.slug}`)

    const addToBag = await screen.findByRole('button', { name: 'Colocar na sacola' })
    await userEvent.click(addToBag)

    // Three claims, and each fails on its own: the line went in, the bag opened to show it, and the
    // header counted it. A container that added without opening passes none of the first two.
    const drawer = within(screen.getByRole('dialog'))
    expect(drawer.getByText(letter.name.pt)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sacola (1)' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    // The opener, not the bag button — the reader is put back where they were reading. A container
    // that hard-coded the header's control would send them to the top of the page instead.
    expect(document.activeElement).toBe(addToBag)
  })
})

describe('HomeRoute', () => {
  it('features the first FEATURED piece rather than the first piece', async () => {
    // `drawing` first, `letter` second, and only `letter` carries `featured: true`. spec:58 is "the
    // first active featured product, else the first active one", and with the featured piece at the
    // head of the list — which is how the shipped fixtures are ordered — a container that simply
    // took `products[0]` would be indistinguishable from one that read the flag.
    stubFetch(() => catalogue(drawing, letter))
    renderShop('/')

    // Synchronous, before the catalogue answers: `CatalogGrid`'s empty state describes a shop with
    // nothing to sell, which is not what a shop that is still loading is.
    expect(screen.queryByText('Nenhuma peça no catálogo ainda.')).toBeNull()

    expect(await screen.findByRole('link', { name: 'Ver a peça em destaque' })).toHaveAttribute(
      'href',
      `/exhibit/${letter.slug}`,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('waits on a loading screen rather than on nothing at all', async () => {
    // Task 11 rendered `null` here, so the first paint of every visit was the header alone over
    // blank paper. The request is held open on purpose: a stub that answers immediately never lets
    // the pending branch reach a paint, and the assertion would be about a frame nobody sees.
    let release = () => {}
    const answered = new Promise<void>((resolve) => {
      release = resolve
    })
    stubFetch(async () => {
      await answered
      return catalogue(letter)
    })
    renderShop('/')

    expect(screen.getByRole('status').textContent).toBe('Carregando…')
    // And the page under it has not started: the outline belongs to the catalogue, which is not
    // there yet, so a heading at this point would be one the reader hears replaced a moment later.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()

    release()
    expect(await screen.findByRole('link', { name: 'Ver a peça em destaque' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says the shop is down rather than empty, and asks again on demand', async () => {
    // THE BUG THIS CLOSES, stated as an assertion: a failed catalogue used to fall through to
    // `CatalogGrid`'s "nenhuma peça no catálogo ainda", so a shop that was down and a shop with
    // nothing to sell were the same screen.
    let attempt = 0
    const fetchSpy = stubFetch(() => {
      attempt += 1
      return attempt === 1 ? json({ error: { code: 'INTERNAL', message: 'boom' } }, 500) : catalogue(letter)
    })
    renderShop('/')

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Não consegui carregar o catálogo.')
    expect(screen.queryByText('Nenhuma peça no catálogo ainda.')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    // The retry is wired to the query and not to a re-render: a second request goes out and the
    // catalogue it answers with is what ends up on screen.
    expect(await screen.findByRole('link', { name: 'Ver a peça em destaque' })).toHaveAttribute(
      'href',
      `/exhibit/${letter.slug}`,
    )
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).endsWith('/api/products'))).toHaveLength(2)
  })

  it('falls back to the first piece, and to none at all for an empty catalogue', async () => {
    // The other two rungs of the same ladder, and they are separate guards: a container that only
    // read the flag would show no hero call to action for a catalogue where nobody has ticked the
    // box, and one that never handled the empty list would read `products[0].slug` off undefined.
    stubFetch(() => catalogue(drawing))
    renderShop('/')

    expect(await screen.findByRole('link', { name: 'Ver a peça em destaque' })).toHaveAttribute(
      'href',
      `/exhibit/${drawing.slug}`,
    )

    cleanup()
    vi.unstubAllGlobals()
    stubFetch(() => catalogue())
    renderShop('/')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: 'Ver a peça em destaque' })).toBeNull()
  })
})

describe('AboutRoute', () => {
  it('builds the mail link from the one address the shop has', async () => {
    stubFetch(() => catalogue(letter))
    renderShop('/about')

    // Two pages build a `mailto:` and this is the constant behind both of them, so a route wired to
    // the wrong address is a message that reaches nobody and no test anywhere else would notice.
    expect(await screen.findByRole('link', { name: 'Falar comigo' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:contato@augustoamaral.com'),
    )
  })
})

/** Dispatches a real Tab keydown at whatever has focus and reports whether the handler took it. */
function pressTab({ shift = false } = {}): boolean {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true })
  ;(document.activeElement ?? document.body).dispatchEvent(event)
  return event.defaultPrevented
}

describe('ProductRoute', () => {
  it('drops the selected photo when the piece changes', async () => {
    // `letter` has two photos and `drawing` has one, so an index held across the navigation lands
    // past the end of the new piece's list — where `ProductGallery` shows the placeholder rather
    // than throwing, which is exactly why the bug would be silent.
    stubFetch((url) => {
      if (url.includes(`/products/${letter.slug}`)) return json({ product: letter })
      if (url.includes(`/products/${drawing.slug}`)) return json({ product: drawing })
      return catalogue(letter, drawing)
    })
    renderShop(`/exhibit/${letter.slug}`)

    await userEvent.click((await screen.findAllByRole('button', { name: /ver foto/i }))[1]!)
    // The selection really is on the second photo before the navigation, so the assertion after it
    // is about the reset and not about a click that never landed.
    expect(screen.getByRole('img')).toHaveAttribute('alt', letter.photos[1]!.alt.pt)

    await act(async () => {
      await navigateTo!(`/exhibit/${drawing.slug}`)
    })

    // react-router renders the same element for both slugs, so this component is not remounted and
    // the index survives unless the container ends it. With a stale 1, `photos.at(1)` on a
    // one-photo piece is undefined and the gallery paints the "ainda sem foto" placeholder with no
    // `<img>` at all — so this query is what reddens, and it reddens for the right reason.
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', drawing.photos[0]!.url))
    // `drawing`'s own alt is empty in the fixture, so the gallery falls back to the planted key —
    // which also proves the photo on screen belongs to the new piece and not to the old one.
    expect(screen.getByRole('img')).toHaveAttribute('alt', `Foto de ${drawing.name.pt}`)
  })

  it('waits on a loading screen rather than on a blank page', async () => {
    // The catalogue answers immediately and only the piece is held: the shell renders either way,
    // so holding both would prove nothing about which request this screen is waiting for.
    let release = () => {}
    const answered = new Promise<void>((resolve) => {
      release = resolve
    })
    stubFetch(async (url) => {
      if (!url.includes('/api/products/')) return catalogue(letter)
      await answered
      return json({ product: letter })
    })
    renderShop(`/exhibit/${letter.slug}`)

    expect(screen.getByRole('status').textContent).toBe('Carregando…')
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()

    release()
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(letter.name.pt)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('gives a mistyped slug a screen instead of a blank page', async () => {
    // `/api/products/` with the trailing slash is the single-piece route; the catalogue the shell
    // fetches is `/api/products` and still has to answer, or the header has nothing to count.
    stubFetch((url) =>
      url.includes('/api/products/')
        ? json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }, 404)
        : catalogue(letter),
    )
    renderShop('/exhibit/nao-existe')

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Essa peça não está no catálogo.')
    expect(screen.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
    // No retry, and that is the branch rather than a styling choice: a 404 answers the same way
    // however many times it is asked, so a button here would make the reader responsible for a
    // dead end. Its ABSENCE is what separates this screen from the one below.
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('separates a piece that is gone from a shop that is down', async () => {
    // The same blank page in Task 11, and it must not say the piece was sold: the split is the
    // status on the thrown `ApiError`, and with it collapsed a 500 tells a buyer their piece left
    // the catalogue.
    stubFetch((url) =>
      url.includes('/api/products/') ? json({ error: { code: 'INTERNAL', message: 'boom' } }, 500) : catalogue(letter),
    )
    renderShop(`/exhibit/${letter.slug}`)

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Não consegui carregar esta peça.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  })
})

describe('CheckoutRoute', () => {
  it('hides the address and shipping sections for a digital-only bag', async () => {
    putInCart({ slug: digitalLetter.slug, qty: 1 })
    stubFetch(() => catalogue(letter, digitalLetter))
    renderShop('/checkout')

    await screen.findByText('01 · Quem está comprando')
    // `hasPhysicalItems` is false, so `checkoutRules` asks for neither — showing them would collect
    // an address the API ignores and block a valid submit on fields it never required.
    expect(screen.queryByText('02 · Endereço de entrega')).toBeNull()
    expect(screen.queryByText('03 · Envio')).toBeNull()
    expect(screen.queryByLabelText('País')).toBeNull()
    // Nothing to post and nothing to choose, so a real zero rather than the "not chosen yet" dash.
    expect(valueOf('Frete').textContent).toBe(formatPrice(0, 'pt'))
  })

  it('starts on BR with both domestic options, and offers only the international one elsewhere', async () => {
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch(() => catalogue(letter))
    renderShop('/checkout')

    // Synchronous, before the catalogue has answered: with no lines yet, a page rendered now says
    // the bag is empty over a bag that is not, and then flickers into the real one.
    expect(screen.queryByText('A sacola está vazia.')).toBeNull()

    // Step 1d, on screen: the field is pre-filled, so the first thing under "03 · Envio" is two
    // options rather than "Nenhuma opção de envio para este endereço".
    expect(await screen.findByLabelText('País')).toHaveValue('BR')
    expect(await screen.findByRole('radio', { name: /PAC/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /SEDEX/ })).toBeInTheDocument()

    // LOWERCASE on purpose. `checkoutRules` runs on the parsed request, where zod has already
    // trimmed and upper-cased the country, so a container that offered options for the raw string
    // would show none at all for `fr` and then be told `not_allowed` by an API that read it as FR.
    await fill('País', 'fr')

    await waitFor(() => expect(screen.queryByRole('radio', { name: /PAC/ })).toBeNull())
    expect(screen.queryByRole('radio', { name: /SEDEX/ })).toBeNull()
    expect(screen.getByRole('radio', { name: /Internacional/ })).toBeInTheDocument()
  })

  it('drops a chosen shipping method the new country does not offer', async () => {
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch(() => catalogue(letter))
    renderShop('/checkout')

    await userEvent.click(await screen.findByRole('radio', { name: /SEDEX/ }))
    expect(valueOf(`Frete (${SHIPPING_METHODS.sedex.name.pt})`).textContent).toBe(
      formatPrice(SHIPPING_METHODS.sedex.cents, 'pt'),
    )

    await fill('País', 'FR')

    // The charge goes with the option. A stored selection would keep R$ 41,00 on a summary for a
    // service that does not go to France, with no radio checked to explain it — and the API would
    // then reject the order with `not_available` after the buyer had read a total they can never
    // be charged.
    await waitFor(() => expect(screen.queryByText(`Frete (${SHIPPING_METHODS.sedex.name.pt})`)).toBeNull())
    expect(valueOf('Frete').textContent).toBe('—Escolha uma opção de envio')
    expect(screen.getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(0)
  })

  it('does not POST when the schema rejects the form', async () => {
    putInCart({ slug: letter.slug, qty: 1 })
    const fetchSpy = stubFetch(() => catalogue(letter))
    renderShop('/checkout')

    await userEvent.click(await screen.findByRole('button', { name: /pagar/i }))

    // The assertion that matters is not "an error appeared" but "nothing was sent": a form that
    // shows errors AND posts anyway creates a pending order and a Stripe session per click.
    expect(postsIn(fetchSpy)).toHaveLength(0)
    expect(screen.getByLabelText('Nome completo')).toHaveAttribute('aria-invalid', 'true')
    // The button is at the bottom of a screen the fields have scrolled off, so the rejection has to
    // say something next to the button too.
    expect(screen.getByRole('alert').textContent).toBe('Confira os campos marcados acima.')
  })

  it('does not POST when the cross-field rules reject a form the schema accepts', async () => {
    // THIS AND THE TEST ABOVE ARE A PAIR. The schema and the rules are two gates in a row, and the
    // API runs them in this order too (`routes/checkout.ts:21` then `:36`), so a form can pass one
    // and fail the other. Delete the schema's early return and only the test above reddens; delete
    // the rules' and only this one does. Either alone reports "the checkout validates".
    putInCart({ slug: letter.slug, qty: 1 })
    const fetchSpy = stubFetch(() => catalogue(letter))
    renderShop('/checkout')

    await screen.findByLabelText('Nome completo')
    await fill('Nome completo', 'Ma')
    await fill('E-mail', 'ma@example.com')
    await fill('Rua / logradouro', 'Rua Sapucaí')
    await fill('Cidade', 'Belo Horizonte')
    // Three characters, so `postalCode`'s `.min(3)` is satisfied and the only thing left to reject
    // it is the BR rule. Number, district, state and the method stay empty for the same reason.
    await fill('CEP', '3015')

    await userEvent.click(screen.getByRole('button', { name: /pagar/i }))

    expect(postsIn(fetchSpy)).toHaveLength(0)
    // Codes, translated — which is what the schema gate cannot produce. A zod rejection of the same
    // form would put raw English prose in these places.
    const cep = screen.getByLabelText('CEP')
    expect(screen.getByText('Informe um CEP válido, como 30150-904.').id).toBe(cep.getAttribute('aria-errormessage'))
    expect(screen.getByLabelText('Estado').getAttribute('aria-errormessage')).toBe(
      screen.getByText('Use a sigla do estado, como MG.').id,
    )
    expect(screen.getByLabelText('Número')).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits on Enter in a text field, and posts what the form says', async () => {
    // Step 1c, pinned by the gesture rather than by the attribute: an assertion that the button
    // carries `form="checkout-form"` passes for an id that matches no form on the page, which is
    // the same sixteen inputs doing nothing on Enter.
    putInCart({ slug: letter.slug, qty: 1 })
    const assign = stubAssign()
    const fetchSpy = stubFetch((_url, init) =>
      init?.method === 'POST' ? json({ url: 'https://stripe.test/session', orderNumber: 413 }) : catalogue(letter),
    )
    renderShop('/checkout')

    await screen.findByLabelText('Nome completo')
    await fillValidBrazilianForm()
    await userEvent.type(screen.getByLabelText('Nome completo'), '{Enter}')

    await waitFor(() => expect(postsIn(fetchSpy)).toHaveLength(1))
    // The association is stated, not merely inherited from where the panel happens to sit. This
    // assertion alone would be worthless — it passes for an id matching no form on the page — but
    // beside the Enter above it is what says the panel's contract does not depend on its ancestors.
    expect(screen.getByRole('button', { name: /pagar/i })).toHaveAttribute('form', 'checkout-form')
    const body = JSON.parse(String(postsIn(fetchSpy)[0]![1]!.body)) as Record<string, unknown>
    expect(body.items).toEqual([{ slug: letter.slug, qty: 1 }])
    expect(body.locale).toBe('pt')
    expect(body.shippingMethod).toBe('sedex')
    expect(body.buyer).toEqual({ name: 'Ma', email: 'ma@example.com' })
    expect(body.shippingAddress).toMatchObject({ country: 'BR', postalCode: '30150-904', state: 'MG' })
    // The only way off this page is the URL the API hands back.
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/session'))
  })

  it('removes only the offending line on OUT_OF_STOCK and keeps the rest', async () => {
    putInCart({ slug: letter.slug, qty: 1 }, { slug: digitalLetter.slug, qty: 1 })
    const fetchSpy = stubFetch((_url, init) => {
      if (init?.method !== 'POST') return catalogue(letter, digitalLetter)
      // The real shape: `routes/checkout.ts:31` throws a 400 whose message is the only place the
      // slug appears — no `fieldErrors`, no 409.
      return json({ error: { code: 'OUT_OF_STOCK', message: `Not enough stock for: ${letter.slug}` } }, 400)
    })
    renderShop('/checkout')

    await screen.findByLabelText('Nome completo')
    await fillValidBrazilianForm()
    await userEvent.click(screen.getByRole('button', { name: /pagar/i }))

    await waitFor(() => expect(screen.queryByText(letter.name.pt)).toBeNull())
    // The other line survives, and so does the bag on disk. "Removes the offending line" and
    // "keeps the rest" are one mutation apart: a handler that cleared the whole cart passes the
    // first assertion and fails these two.
    expect(screen.getByText(digitalLetter.name.pt)).toBeInTheDocument()
    expect(storedCart()).toEqual([{ slug: digitalLetter.slug, qty: 1 }])
    // A code, put through the panel's table — never a sentence built out here, where
    // `copy.test.ts` cannot see it.
    expect(screen.getByRole('alert').textContent).toBe(
      'Não tenho estoque suficiente de uma das peças. Diminua a quantidade na sacola.',
    )
    expect(postsIn(fetchSpy)).toHaveLength(1)
  })

  it('says something when the request never reaches the API', async () => {
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch((_url, init) => {
      if (init?.method !== 'POST') return catalogue(letter)
      // A dropped connection rejects with a TypeError, not an ApiError — and `useCheckout` types
      // its error as an ApiError, so reading `.code` off this gives `undefined`, which renders no
      // alert at all. A submit that fails in silence is the worst state this page has.
      throw new TypeError('Failed to fetch')
    })
    renderShop('/checkout')

    await screen.findByLabelText('Nome completo')
    await fillValidBrazilianForm()
    await userEvent.click(screen.getByRole('button', { name: /pagar/i }))

    expect((await screen.findByRole('alert')).textContent).toBe('Algo quebrou do meu lado. Tente de novo em instantes.')
  })
})

describe('DoneRoute', () => {
  it('does not clear the bag when the lookup fails', async () => {
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch((url) =>
      url.includes('/api/orders')
        ? json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } }, 404)
        : catalogue(letter),
    )
    renderShop('/thanks?order=413&session_id=cs_test')

    await screen.findByText(/Confirmando o pagamento\./)
    // Clearing on mount empties a valid bag on any refresh whose lookup fails, and a wrong session
    // id in a link someone shared is enough to cause one.
    expect(storedCart()).toHaveLength(1)
  })

  it('clears the bag once the order is found', async () => {
    // THE PAIR. This one alone passes for a container that clears on mount; the one above alone
    // passes for a container that never clears at all. Only together do they pin the rule.
    putInCart({ slug: letter.slug, qty: 1 })
    stubFetch((url) =>
      url.includes('/api/orders')
        ? orderBody({
            orderNumber: 413,
            status: 'paid',
            items: [],
            totalCents: 4500,
            currency: 'brl',
            shippingMethod: 'pac',
            eta: null,
          })
        : catalogue(letter),
    )
    renderShop('/thanks?order=413&session_id=cs_test')

    await waitFor(() => expect(storedCart()).toEqual([]))
  })

  it('never asks for an order without both halves of the credential', async () => {
    // Three separate guards, and a test that exercised one would leave the other two free to go.
    // The session id is the order's password — it is what stops order numbers being enumerated —
    // and `NaN` is a number, so a missing `?order=` sails through a null check into `/orders/NaN`.
    for (const path of ['/thanks?order=413', '/thanks?session_id=cs_test', '/thanks?order=abc&session_id=cs_test']) {
      const fetchSpy = stubFetch(() => catalogue(letter))
      renderShop(path)
      await screen.findByRole('heading', { level: 1 })
      expect(orderCallsIn(fetchSpy), `${path} asked the API for an order`).toHaveLength(0)
      cleanup()
      vi.unstubAllGlobals()
    }
  })

  it('stops polling once the order is no longer pending', async () => {
    vi.useFakeTimers()
    let status = 'pending'
    const fetchSpy = stubFetch((url) =>
      url.includes('/api/orders')
        ? orderBody({
            orderNumber: 413,
            status,
            items: [],
            totalCents: 4500,
            currency: 'brl',
            shippingMethod: 'pac',
            eta: null,
          })
        : catalogue(letter),
    )
    renderShop('/thanks?order=413&session_id=cs_test')

    await act(async () => void (await vi.advanceTimersByTimeAsync(2100)))
    expect(orderCallsIn(fetchSpy).length).toBeGreaterThan(1)

    status = 'paid'
    await act(async () => void (await vi.advanceTimersByTimeAsync(2100)))
    const afterPaid = orderCallsIn(fetchSpy).length

    // The assertion is that it STOPS. Asserting only "it polled while pending" passes for a
    // container that polls forever, which is the real failure: a tab left open on the thank-you
    // page hitting the API every two seconds until someone closes it.
    await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)))
    expect(orderCallsIn(fetchSpy).length).toBe(afterPaid)
  })

  it('gives up after about thirty seconds and stops asking', async () => {
    vi.useFakeTimers()
    const fetchSpy = stubFetch((url) =>
      url.includes('/api/orders')
        ? orderBody({
            orderNumber: 413,
            status: 'pending',
            items: [],
            totalCents: 4500,
            currency: 'brl',
            shippingMethod: 'pac',
            eta: null,
          })
        : catalogue(letter),
    )
    renderShop('/thanks?order=413&session_id=cs_test')

    await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)))
    // Still promising to refresh itself, and still keeping that promise.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Confirmando o pagamento.')

    await act(async () => void (await vi.advanceTimersByTimeAsync(25_000)))
    // Both halves, and neither implies the other: a container that changed the wording and kept
    // polling keeps the request rate it was meant to stop, and one that stopped silently leaves
    // "esta página se atualiza sozinha" on screen as a promise it has given up on.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Ainda confirmando.')
    const afterGivingUp = orderCallsIn(fetchSpy).length

    await act(async () => void (await vi.advanceTimersByTimeAsync(20_000)))
    expect(orderCallsIn(fetchSpy).length).toBe(afterGivingUp)
  })
})
