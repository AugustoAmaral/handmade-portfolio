const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('shop_admin_token')
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData)) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> } }).error
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? 'Request failed', e?.fieldErrors)
  }
  return data as T
}
