import type { FieldErrors } from '@shop/shared'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: FieldErrors,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; fieldErrors?: FieldErrors }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('shop_admin_token')
  const headers = new Headers(init.headers)
  // FormData must set its own content-type: it carries the multipart boundary, and overwriting
  // it with application/json makes the server parse an empty body.
  if (!(init.body instanceof FormData)) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  // A 502 from a proxy is HTML, not JSON. Swallowing the parse failure is what keeps the thrown
  // value an ApiError the callers can branch on instead of a SyntaxError from deep in the client.
  const data = (await res.json().catch(() => ({}))) as ErrorEnvelope
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error?.code ?? 'UNKNOWN',
      data.error?.message ?? 'Request failed',
      data.error?.fieldErrors,
    )
  }
  return data as T
}
