import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../src/lib/api'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('api client', () => {
  it('parses JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 })))
    await expect(api('/api/health')).resolves.toEqual({ ok: 1 })
  })
  it('throws ApiError with code on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'PRODUCT_NOT_FOUND', message: 'nope' } }), { status: 404 }),
      ),
    )
    const err = (await api('/api/products/x').catch((e) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('PRODUCT_NOT_FOUND')
    expect(err.status).toBe(404)
  })
  it('attaches the admin token when present', async () => {
    localStorage.setItem('shop_admin_token', 'tok123')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await api('/api/admin/orders')
    const headers = new Headers(fetchMock.mock.calls[0][1].headers)
    expect(headers.get('authorization')).toBe('Bearer tok123')
  })
})
