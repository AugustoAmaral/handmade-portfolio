import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, retryQuery } from '../../src/app/api/client'

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// Typed to the shape `fetch` is actually called with. `vi.fn(async () => ...)` infers a
// zero-argument mock, and `mock.calls[0]![1]` on it is a type error rather than the init object
// every assertion below reads.
function fetchStub(respondWith: () => Response) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => respondWith())
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('api', () => {
  it('returns the parsed body on success', async () => {
    vi.stubGlobal('fetch', fetchStub(() => respond(200, { ok: true })))
    await expect(api<{ ok: boolean }>('/api/health')).resolves.toEqual({ ok: true })
  })

  it('sends the admin token when one is stored, and none when it is not', async () => {
    const fetchMock = fetchStub(() => respond(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await api('/api/products')
    const anonymous = new Headers(fetchMock.mock.calls[0]![1]!.headers)
    expect(anonymous.get('authorization')).toBeNull()

    localStorage.setItem('shop_admin_token', 'tok')
    await api('/api/products')
    const authed = new Headers(fetchMock.mock.calls[1]![1]!.headers)
    expect(authed.get('authorization')).toBe('Bearer tok')
  })

  it('does not set a JSON content-type on FormData, so the boundary survives', async () => {
    const fetchMock = fetchStub(() => respond(200, {}))
    vi.stubGlobal('fetch', fetchMock)
    await api('/api/admin/products/1/photos', { method: 'POST', body: new FormData() })
    const headers = new Headers(fetchMock.mock.calls[0]![1]!.headers)
    expect(headers.get('content-type')).toBeNull()
  })

  it('resolves on a 204, whose body is not empty JSON but no body at all', async () => {
    // `DELETE /api/admin/products/:id` is the only endpoint that answers this way, and `res.json()`
    // REJECTS on an empty body rather than returning null. The parse guard below was written for
    // HTML error pages from a proxy; this is the success path it also covers, and without it a
    // deletion that worked surfaces as a SyntaxError from inside the client.
    vi.stubGlobal('fetch', fetchStub(() => new Response(null, { status: 204 })))
    await expect(api('/api/admin/products/p-letter', { method: 'DELETE' })).resolves.toEqual({})
  })

  it('throws ApiError carrying the envelope code and fieldErrors', async () => {
    vi.stubGlobal(
      'fetch',
      fetchStub(() =>
        respond(400, { error: { code: 'VALIDATION', message: 'bad', fieldErrors: { 'buyer.email': ['invalid'] } } }),
      ),
    )
    const error = await api('/api/checkout', { method: 'POST' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION', fieldErrors: { 'buyer.email': ['invalid'] } })
  })

  it('still throws ApiError when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', fetchStub(() => new Response('<html>502</html>', { status: 502 })))
    const error = await api('/api/checkout').catch((e: unknown) => e)
    // A gateway returning HTML is the shape that breaks a client which assumes `res.json()` works.
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN' })
  })
})

describe('retryQuery', () => {
  it('never repeats a 4xx, however early the failure', () => {
    // The answer is the same every time, and the wait is paid by a reader staring at the loading
    // screen. `failureCount` 0 is the FIRST failure: a guard that only fired later would still
    // spend a backoff on a slug that does not exist.
    expect(retryQuery(0, new ApiError(404, 'PRODUCT_NOT_FOUND', 'gone'))).toBe(false)
    expect(retryQuery(0, new ApiError(400, 'VALIDATION', 'bad'))).toBe(false)
  })

  it('repeats a 5xx up to three times and then stops', () => {
    // Both ends, because they are separate guards: without the first, a shop that is briefly down
    // never recovers on its own; without the second, a shop that stays down is asked forever.
    const error = new ApiError(503, 'UNAVAILABLE', 'down')
    expect(retryQuery(0, error)).toBe(true)
    expect(retryQuery(2, error)).toBe(true)
    expect(retryQuery(3, error)).toBe(false)
  })

  it('repeats a failure that never became an ApiError at all', () => {
    // A dropped connection rejects inside `fetch`, before there is a status to read, so it arrives
    // here as a TypeError. Treating an unrecognised failure as final is how a flaky network turns
    // into a permanent error screen.
    expect(retryQuery(0, new TypeError('Failed to fetch'))).toBe(true)
  })
})
