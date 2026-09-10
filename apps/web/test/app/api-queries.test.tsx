import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../src/app/api/client'
import {
  useAdminLogin,
  useAdminOrders,
  useAdminProducts,
  useDeletePhoto,
  useDeleteProduct,
  useMarkShipped,
  useSaveProduct,
  useUploadPhoto,
} from '../../src/app/api/queries'
import { adminOrders, paidOrder, shippedOrder } from '../../src/fixtures/orders'
import { inactiveGuide, letter } from '../../src/fixtures/products'

/**
 * These hooks exist to take the API's envelopes off, so the stubs below answer in the envelopes the
 * routes actually write — `{ products }`, `{ product }`, `{ orders }`, `{ order }`, `{ token }`,
 * quoted from `apps/api/src/routes/admin/*.ts`. A stub that answered the bare value would let an
 * unwrapping bug pass, which is exactly how PR 3 shipped one that survived ten tasks.
 */
function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', spy)
  return spy
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** `retry: false` on both: without it every error-path test sits through three backoffs. */
function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

/**
 * `client` is a parameter because two hooks sharing ONE cache is the only arrangement in which a
 * query key can be tested at all — give each render its own client and every hook refetches
 * whatever the key says, so a key that lost half its parts would still look right.
 */
function render<T>(hook: () => T, client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...renderHook(hook, { wrapper }) }
}

const urls = (spy: ReturnType<typeof stubFetch>) => spy.mock.calls.map(([input]) => String(input))
const lastInit = (spy: ReturnType<typeof stubFetch>) => spy.mock.calls.at(-1)![1]!

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('useAdminProducts', () => {
  it('unwraps { products } and asks the admin endpoint', async () => {
    const spy = stubFetch(() => json({ products: [letter, inactiveGuide] }))
    const { result } = render(() => useAdminProducts())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([letter, inactiveGuide])
    // Not `/api/products`: the public route filters `{ active: true }`, so an admin table built on
    // it would silently omit every product the admin most needs to find — the disabled ones.
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/products'])
  })
})

describe('useAdminOrders', () => {
  it('unwraps { orders }', async () => {
    stubFetch(() => json({ orders: adminOrders }))
    const { result } = render(() => useAdminOrders())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(adminOrders)
  })

  it('sends no status parameter when no filter is chosen', async () => {
    // The API parses `status` with `z.enum([...ORDER_STATUSES, 'all']).optional()`, so an empty
    // `?status=` is a 400, not a default — and the default it would have skipped is its own:
    // no parameter means "everything except expired", which is a third state, not a synonym for
    // `all`.
    const spy = stubFetch(() => json({ orders: [] }))
    const { result } = render(() => useAdminOrders())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/orders'])
  })

  it('sends the chosen filter', async () => {
    const spy = stubFetch(() => json({ orders: [paidOrder] }))
    const { result } = render(() => useAdminOrders('paid'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/orders?status=paid'])
  })

  it('caches each filter separately', async () => {
    // The filter has to be part of the query key, and ONE client is what makes that testable: with
    // a client each, both hooks fetch no matter what the key says. Sharing it, a key that dropped
    // the filter serves the second hook the first one's rows and never asks — the admin picks
    // "Enviados" and goes on reading the paid list.
    const spy = stubFetch((url) => json({ orders: url.includes('shipped') ? [shippedOrder] : [paidOrder] }))
    const client = newClient()
    const first = render(() => useAdminOrders('paid'), client)
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = render(() => useAdminOrders('shipped'), client)
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(second.result.current.data).toEqual([shippedOrder])
    expect(urls(spy)).toEqual([
      'http://localhost:3001/api/admin/orders?status=paid',
      'http://localhost:3001/api/admin/orders?status=shipped',
    ])
  })
})

describe('useAdminLogin', () => {
  it('posts the credentials and returns the bare token', async () => {
    const spy = stubFetch(() => json({ token: 'jwt.from.api' }))
    const { result } = render(() => useAdminLogin())

    let token: string | undefined
    await act(async () => {
      token = await result.current.mutateAsync({ email: 'a@b.com', password: 'hunter2' })
    })

    expect(token).toBe('jwt.from.api')
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/login'])
    expect(lastInit(spy).method).toBe('POST')
    expect(JSON.parse(String(lastInit(spy).body))).toEqual({ email: 'a@b.com', password: 'hunter2' })
  })

  it('surfaces the refusal as an ApiError carrying the code the session guard branches on', async () => {
    stubFetch(() => json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401))
    const { result } = render(() => useAdminLogin())

    let error: unknown
    await act(async () => {
      error = await result.current.mutateAsync({ email: 'a@b.com', password: 'wrong' }).catch((e: unknown) => e)
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })
})

describe('useSaveProduct', () => {
  const input = {
    slug: 'carta-escrita',
    name: letter.name,
    description: letter.description,
    priceCents: letter.priceCents,
    type: letter.type,
    stock: letter.stock,
    active: true,
  }

  it('creates a new product with POST on the collection', async () => {
    const spy = stubFetch(() => json({ product: letter }, 201))
    const { result } = render(() => useSaveProduct())

    let saved: unknown
    await act(async () => {
      saved = await result.current.mutateAsync({ input })
    })

    expect(saved).toEqual(letter)
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/products'])
    expect(lastInit(spy).method).toBe('POST')
    expect(JSON.parse(String(lastInit(spy).body))).toEqual(input)
  })

  it('updates an existing product with PUT on its own path', async () => {
    // The id, not the slug: `findProduct` calls `Product.findById`, so a PUT keyed by slug is a
    // cast failure caught into a 404. Being able to change the slug is the whole reason the two
    // cannot be the same identifier.
    const spy = stubFetch(() => json({ product: letter }))
    const { result } = render(() => useSaveProduct())

    await act(async () => {
      await result.current.mutateAsync({ id: 'p-letter', input })
    })

    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/products/p-letter'])
    expect(lastInit(spy).method).toBe('PUT')
  })

  it('marks the shop catalogue stale as well as the admin list', async () => {
    // The header's "Ver a loja" is a same-origin link, so `LinkInterceptor` reaches the shop
    // without a page load — and the shop would then paint the catalogue this session cached
    // before the edit. The admin list alone is not enough.
    stubFetch(() => json({ product: letter }))
    const { client, result } = render(() => useSaveProduct())
    client.setQueryData(['admin', 'products'], [])
    client.setQueryData(['products'], [])
    client.setQueryData(['product', 'carta-escrita'], letter)

    await act(async () => {
      await result.current.mutateAsync({ id: 'p-letter', input })
    })

    expect(client.getQueryState(['admin', 'products'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['products'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['product', 'carta-escrita'])?.isInvalidated).toBe(true)
  })
})

describe('useDeleteProduct', () => {
  it('deletes by id and survives the 204 that carries no body at all', async () => {
    // The only endpoint on the branch that answers 204. `res.json()` REJECTS on an empty body, so
    // without the parse guard in `client.ts` this rejects with a SyntaxError and the admin sees a
    // failure for a deletion that succeeded.
    const spy = stubFetch(() => new Response(null, { status: 204 }))
    const { client, result } = render(() => useDeleteProduct())
    client.setQueryData(['admin', 'products'], [])

    await act(async () => {
      await result.current.mutateAsync('p-letter')
    })

    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/products/p-letter'])
    expect(lastInit(spy).method).toBe('DELETE')
    expect(client.getQueryState(['admin', 'products'])?.isInvalidated).toBe(true)
  })
})

describe('useUploadPhoto', () => {
  const file = () => new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })

  it('posts the file under the field name multer is listening for', async () => {
    const spy = stubFetch(() => json({ product: letter }, 201))
    const { result } = render(() => useUploadPhoto())

    let product: unknown
    await act(async () => {
      product = await result.current.mutateAsync({ id: 'p-letter', file: file() })
    })

    // The endpoint answers with the WHOLE PRODUCT, not the photo it just stored — `toPublicProduct`
    // after the push. Anything expecting a photo back gets a product-shaped object with no `url`.
    expect(product).toEqual(letter)
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/products/p-letter/photos'])

    const body = lastInit(spy).body as FormData
    expect(body).toBeInstanceOf(FormData)
    // `upload.single('photo')`. Any other field name leaves `req.file` undefined and the route
    // answers 400 VALIDATION "Missing photo file" — a failure with nothing wrong with the file.
    expect((body.get('photo') as File).name).toBe('photo.jpg')
  })

  it('sends the alt text the route reads, keyed as altPt and altEn', async () => {
    const spy = stubFetch(() => json({ product: letter }, 201))
    const { result } = render(() => useUploadPhoto())

    await act(async () => {
      await result.current.mutateAsync({
        id: 'p-letter',
        file: file(),
        alt: { pt: 'Carta sobre a mesa', en: 'Letter on a table' },
      })
    })

    const body = lastInit(spy).body as FormData
    // Flat `altPt`/`altEn`, not a nested `alt` object: multipart text fields are strings, and
    // `altSchema` parses exactly these two names off `req.body`.
    expect(body.get('altPt')).toBe('Carta sobre a mesa')
    expect(body.get('altEn')).toBe('Letter on a table')
  })

  it('omits alt fields that carry nothing', async () => {
    const spy = stubFetch(() => json({ product: letter }, 201))
    const { result } = render(() => useUploadPhoto())

    await act(async () => {
      await result.current.mutateAsync({ id: 'p-letter', file: file(), alt: { pt: 'Só em português' } })
    })

    const body = lastInit(spy).body as FormData
    expect(body.get('altPt')).toBe('Só em português')
    expect(body.get('altEn')).toBeNull()
  })
})

describe('useDeletePhoto', () => {
  it('names the photo in the query string, encoded, because R2 keys contain slashes', async () => {
    const spy = stubFetch(() => json({ product: letter }))
    const { result } = render(() => useDeletePhoto())

    let product: unknown
    await act(async () => {
      product = await result.current.mutateAsync({ id: 'p-letter', key: 'products/p-letter/a b.webp' })
    })

    // This one answers with the whole product too, and 200 rather than the 204 the product
    // deletion uses — the two DELETEs on this router do not agree with each other.
    expect(product).toEqual(letter)
    expect(urls(spy)).toEqual([
      'http://localhost:3001/api/admin/products/p-letter/photos?key=products%2Fp-letter%2Fa%20b.webp',
    ])
    expect(lastInit(spy).method).toBe('DELETE')
  })
})

describe('useMarkShipped', () => {
  it('patches the order to shipped and unwraps { order }', async () => {
    const spy = stubFetch(() => json({ order: shippedOrder }))
    const { client, result } = render(() => useMarkShipped())
    client.setQueryData(['admin', 'orders', 'paid'], [paidOrder])

    let order: unknown
    await act(async () => {
      order = await result.current.mutateAsync({ id: 'o-2', trackingCode: 'BR123456789BR' })
    })

    expect(order).toEqual(shippedOrder)
    expect(urls(spy)).toEqual(['http://localhost:3001/api/admin/orders/o-2'])
    expect(lastInit(spy).method).toBe('PATCH')
    expect(JSON.parse(String(lastInit(spy).body))).toEqual({ status: 'shipped', trackingCode: 'BR123456789BR' })
    // Every filter, not just the one showing: an order that leaves `paid` changes what both the
    // paid list and the shipped list should contain.
    expect(client.getQueryState(['admin', 'orders', 'paid'])?.isInvalidated).toBe(true)
  })

  it('leaves the tracking code out entirely when the field was left blank', async () => {
    // `z.string().trim().min(1).max(60).optional()` — optional means absent, not empty. Sending
    // `trackingCode: ''` is a 400 VALIDATION on a shipment that is otherwise perfectly legal, and
    // an empty input is the normal case for anything handed over in person.
    const spy = stubFetch(() => json({ order: shippedOrder }))
    const { result } = render(() => useMarkShipped())

    await act(async () => {
      await result.current.mutateAsync({ id: 'o-2', trackingCode: '   ' })
    })

    expect(JSON.parse(String(lastInit(spy).body))).toEqual({ status: 'shipped' })
  })

  it('trims a tracking code that was pasted with surrounding space', async () => {
    // The API trims before validating, so an untrimmed code is accepted — and then stored and
    // shown with the padding. The customer copies it into the carrier's site with the space.
    const spy = stubFetch(() => json({ order: shippedOrder }))
    const { result } = render(() => useMarkShipped())

    await act(async () => {
      await result.current.mutateAsync({ id: 'o-2', trackingCode: ' BR123456789BR\n' })
    })

    expect(JSON.parse(String(lastInit(spy).body))).toEqual({ status: 'shipped', trackingCode: 'BR123456789BR' })
  })
})
