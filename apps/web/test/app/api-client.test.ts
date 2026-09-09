import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../../src/app/api/client'

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
