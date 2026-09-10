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

/** react-query's default, and the ceiling this predicate keeps for the failures worth repeating. */
const MAX_ATTEMPTS = 3

/**
 * Whether the API has said its last word.
 *
 * A 4XX IS THE SERVER'S FINAL ANSWER: the reply is identical however many times it is asked, so
 * nothing is fixed by asking again and the reader pays the whole wait. Anything else may NOT be
 * final — a 5xx and a dropped connection (which never becomes an `ApiError` at all, because `fetch`
 * rejects before there is a status to read) are both states that can be over a moment later.
 *
 * This lives here, alone, because two layers decide whether to ask again and they have to agree:
 * `retryQuery` below, and `useOrder`'s poll. A second copy of the range check is how the two would
 * come to disagree, and no test in either would see it.
 */
export function isFinalAnswer(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
}

/**
 * Whether a failed query is worth asking again, wired as the QueryClient's default in `main.tsx`.
 *
 * Without this a mistyped `/exhibit/:slug` spends about seven seconds of exponential backoff on the
 * loading screen, re-asking for a piece the API has already said three times does not exist, and
 * only then shows the not-found screen.
 */
export function retryQuery(failureCount: number, error: unknown): boolean {
  if (isFinalAnswer(error)) return false
  return failureCount < MAX_ATTEMPTS
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
