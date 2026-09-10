import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '../../src/app/api/client'
import { useAdminSession } from '../../src/app/state/useAdminSession'

const KEY = 'shop_admin_token'

/**
 * A structurally real JWT: three base64url segments, unpadded, exactly what `jsonwebtoken` writes
 * in `routes/admin/auth.ts`. The signature is not verifiable here and never needs to be — the hook
 * reads the payload to decide when NOT to bother the API, never to decide that a token is good.
 */
function jwt(claims: Record<string, unknown>): string {
  const segment = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(claims)}.c2lnbmF0dXJl`
}

const HOUR = 3600
const live = () => jwt({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 12 * HOUR })
const dead = () => jwt({ sub: 'admin', exp: Math.floor(Date.now() / 1000) - HOUR })

beforeEach(() => localStorage.clear())

describe('useAdminSession', () => {
  it('starts signed out when nothing is stored', () => {
    const { result } = renderHook(() => useAdminSession())
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.rejected).toBe(false)
  })

  it('restores a stored token that is still within its lifetime', () => {
    const token = live()
    localStorage.setItem(KEY, token)
    const { result } = renderHook(() => useAdminSession())
    expect(result.current.token).toBe(token)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('signs in, and writes the token where the API client reads it', () => {
    const { result } = renderHook(() => useAdminSession())
    const token = live()

    act(() => result.current.signIn(token))

    // Two separate claims. The state is what the guard renders from; the stored value is what
    // `client.ts` puts in the authorization header, and it reads storage directly on every
    // request rather than being handed this token. One without the other is a session that
    // renders signed in and sends anonymous requests, or the reverse.
    expect(result.current.isAuthenticated).toBe(true)
    expect(localStorage.getItem(KEY)).toBe(token)
  })

  it('signs out, clearing both the state and the stored token', () => {
    localStorage.setItem(KEY, live())
    const { result } = renderHook(() => useAdminSession())

    act(() => result.current.signOut())

    expect(result.current.token).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('does not flag a deliberate sign-out as a rejection', () => {
    // `rejected` is what tells the login screen to explain itself. Setting it here would greet
    // someone who just pressed "Sair" with "your session ended" — an explanation for something
    // they did on purpose.
    localStorage.setItem(KEY, live())
    const { result } = renderHook(() => useAdminSession())
    act(() => result.current.signOut())
    expect(result.current.rejected).toBe(false)
  })

  it('discards a stored value that is not shaped like a token, and stops storing it', () => {
    localStorage.setItem(KEY, 'not-a-jwt')
    const { result } = renderHook(() => useAdminSession())
    expect(result.current.token).toBeNull()
    // Dropping it from state alone is not enough: `client.ts` reads the key, not this hook, so a
    // value rejected here but left behind keeps riding on every request until the API refuses it.
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('discards a stored value with the right number of segments and nothing in them', () => {
    // Not implied by the count check above, and it is the one shape that would otherwise slip
    // past every later guard: `atob('')` is '', `JSON.parse('')` throws, and the decoder is
    // deliberately forgiving, so an empty payload would be read as "could not check" and kept.
    localStorage.setItem(KEY, 'aGVhZGVy..c2ln')
    const { result } = renderHook(() => useAdminSession())
    expect(result.current.token).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('keeps a well-formed token that simply carries no expiry', () => {
    // Same rule as the undecodable payload, one level in: a claim that is not there is not a claim
    // that has passed. `jsonwebtoken` always writes `exp` here, so this is a token from somewhere
    // else — and somewhere else is the API's problem to refuse, not this hook's to guess at.
    const token = jwt({ sub: 'admin' })
    localStorage.setItem(KEY, token)
    const { result } = renderHook(() => useAdminSession())
    expect(result.current.token).toBe(token)
  })

  it('discards a stored token whose lifetime has already run out', () => {
    // Separate from the shape guard above and not implied by it: this value IS a well-formed JWT.
    // The API issues twelve-hour tokens, so the admin who opens the tab the next morning is the
    // normal case — without this he gets a flash of the products screen and then a 401.
    localStorage.setItem(KEY, dead())
    const { result } = renderHook(() => useAdminSession())
    expect(result.current.token).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('keeps a well-formed token whose payload it cannot read', () => {
    // Never deny on a check that could not be performed. The expiry read is an optimisation, and
    // a decoder that failed on some future token shape must cost a round trip, not the session.
    const token = 'aGVhZGVy.@@not-base64@@.c2ln'
    localStorage.setItem(KEY, token)
    const { result } = renderHook(() => useAdminSession())
    expect(result.current.token).toBe(token)
  })

  it('ends the session when the API rejects the token, and says why', () => {
    localStorage.setItem(KEY, live())
    const { result } = renderHook(() => useAdminSession())

    act(() => result.current.endIfRejected(new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid token')))

    expect(result.current.token).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(result.current.rejected).toBe(true)
  })

  it('leaves the session alone when a wrong password is refused', () => {
    // Both are 401. `adminGuard` answers UNAUTHORIZED, `POST /api/admin/login` answers
    // INVALID_CREDENTIALS, and only the first is a statement about the stored token. A guard that
    // branched on the status alone would let a typo on the login form clear a session that is
    // still perfectly good — and, once the login screen is the thing rendering, would clear it on
    // every failed attempt.
    localStorage.setItem(KEY, live())
    const { result } = renderHook(() => useAdminSession())

    act(() => result.current.endIfRejected(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')))

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.rejected).toBe(false)
  })

  it('leaves the session alone when something that is not the guard says UNAUTHORIZED', () => {
    // The status is the half worth trusting. `code` is read straight out of whatever JSON came
    // back — `data.error?.code ?? 'UNKNOWN'` — so a proxy or an upstream service is perfectly able
    // to put that string in a 5xx envelope, and a predicate that matched on the code alone would
    // read a gateway having a bad minute as this API refusing this token.
    localStorage.setItem(KEY, live())
    const { result } = renderHook(() => useAdminSession())

    act(() => result.current.endIfRejected(new ApiError(503, 'UNAUTHORIZED', 'upstream unavailable')))

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.rejected).toBe(false)
  })

  it('leaves the session alone when the API is merely broken or unreachable', () => {
    // A 500 and a dropped connection say nothing about the token, and `retryQuery` already treats
    // both as worth repeating. Signing the admin out on them turns a blip into a logout.
    localStorage.setItem(KEY, live())
    const { result } = renderHook(() => useAdminSession())

    act(() => result.current.endIfRejected(new ApiError(500, 'INTERNAL', 'Internal server error')))
    expect(result.current.isAuthenticated).toBe(true)

    act(() => result.current.endIfRejected(new TypeError('Failed to fetch')))
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('clears the rejection notice on the next successful sign-in', () => {
    localStorage.setItem(KEY, live())
    const { result } = renderHook(() => useAdminSession())
    act(() => result.current.endIfRejected(new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid token')))

    act(() => result.current.signIn(live()))

    // Otherwise the notice outlives the problem and every screen after the next login carries an
    // explanation for a session that has already been replaced.
    expect(result.current.rejected).toBe(false)
  })
})
