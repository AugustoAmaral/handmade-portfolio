import { useCallback, useState } from 'react'
import { ApiError } from '../api/client'

const STORAGE_KEY = 'shop_admin_token'

/**
 * Whether the API is refusing the STORED TOKEN, as opposed to refusing anything else.
 *
 * Two different 401s reach the browser and only one of them is about the session: `adminGuard`
 * answers `UNAUTHORIZED` when the bearer token is missing, forged or past its expiry, while
 * `POST /api/admin/login` answers `INVALID_CREDENTIALS` for a wrong email or password. Branching on
 * the status alone would treat a typo on the login form as an expired session — harmless while
 * signed out, and a way to lose a perfectly good session the moment anything else on the screen
 * can post credentials.
 *
 * Everything else is deliberately not a rejection. A 500 or a dropped connection says nothing about
 * the token, and `retryQuery` already treats both as worth repeating; ending the session on them
 * would turn a blip in the API into a logout.
 */
function isTokenRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === 'UNAUTHORIZED'
}

/**
 * Whether a stored token is worth sending at all — never whether it is valid, which only the API
 * can say. The check is allowed to say "no" early and is never allowed to say "yes" instead of the
 * API.
 *
 * Two independent guards. The shape guard rejects anything that is not three non-empty base64url
 * segments, which is what `jsonwebtoken` writes and what a hand-edited value will not be. The
 * expiry guard reads `exp` out of the payload without verifying the signature: the API issues
 * twelve-hour tokens, so the admin opening the tab the next morning is the ordinary case, and
 * without this he gets a flash of the products screen before the 401 puts him back on the login.
 *
 * A payload that will not decode is KEPT. Never deny on a check that could not be performed — a
 * decoder that failed on some future token shape should cost one round trip, not the session. Clock
 * skew lands the same way round: a client running fast throws away a live token and costs a login,
 * a client running slow keeps a dead one and the 401 path collects it.
 */
function isUsable(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => part === '')) return false
  try {
    const payload: unknown = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    const exp = (payload as { exp?: unknown }).exp
    return typeof exp !== 'number' || exp * 1000 > Date.now()
  } catch {
    return true
  }
}

function load(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return null
  if (isUsable(stored)) return stored
  // Dropped from storage as well as from state. `client.ts` reads this key directly on every
  // request rather than being handed the token, so a value rejected here but left behind would
  // keep riding along on requests this hook already believes are anonymous.
  localStorage.removeItem(STORAGE_KEY)
  return null
}

export interface AdminSessionApi {
  token: string | null
  /** A claim about what is stored, never proof the API accepts it. Only a request settles that. */
  isAuthenticated: boolean
  /** The last session ended because the API refused its token, rather than because anyone left. */
  rejected: boolean
  signIn(token: string): void
  signOut(): void
  /** Ends the session if — and only if — `error` is the API refusing the stored token. */
  endIfRejected(error: unknown): void
}

/**
 * The admin session: one token, in `localStorage` under the key `client.ts` already reads.
 *
 * Shaped like `useCart` in the way that matters — the stored value is validated on read, because it
 * is user-editable and survives deploys — and like `useLang` in where it persists: in the action,
 * not in an effect. The token records an EVENT (a login that succeeded) rather than derived state,
 * and writing it from an effect would put the render and the request layer briefly out of step,
 * with the client reading storage on its own schedule.
 *
 * WHAT HAPPENS WHEN A STORED TOKEN MEETS A 401. The token is cleared, `rejected` is raised so the
 * login screen can say why it is being shown, and nothing navigates. The redirect loop this could
 * have been — guard sends you to the login, login sees a token and sends you back — is ruled out
 * twice over: clearing the token means the second pass is unauthenticated, and the guard renders
 * the login in place rather than redirecting, so there is no URL to bounce between and a deep link
 * survives signing in. The two are independent and both are wanted; the clearing is the half this
 * file owns.
 *
 * Note what is NOT decidable here: whether the token expired, was forged, or was signed with a
 * secret the last deploy rotated. The API answers all three with the same 401, and all three mean
 * the same thing to the person at the screen — sign in again — which is why `rejected` is one flag
 * and not a diagnosis.
 */
export function useAdminSession(): AdminSessionApi {
  const [token, setToken] = useState<string | null>(load)
  const [rejected, setRejected] = useState(false)

  const signIn = useCallback((next: string) => {
    localStorage.setItem(STORAGE_KEY, next)
    // Cleared here rather than left to decay: otherwise the notice outlives the problem and
    // explains a session that has already been replaced.
    setRejected(false)
    setToken(next)
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setRejected(false)
    setToken(null)
  }, [])

  const endIfRejected = useCallback((error: unknown) => {
    if (!isTokenRejection(error)) return
    localStorage.removeItem(STORAGE_KEY)
    setRejected(true)
    setToken(null)
  }, [])

  return { token, isAuthenticated: token !== null, rejected, signIn, signOut, endIfRejected }
}
