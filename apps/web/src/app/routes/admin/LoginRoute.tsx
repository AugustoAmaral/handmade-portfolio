import { useState } from 'react'
import type { LoginError, LoginValues } from '../../../ui/admin'
import { AdminLoginPage } from '../../../ui/pages'
import { ApiError } from '../../api/client'
import { useAdminLogin } from '../../api/queries'

const EMPTY: LoginValues = { email: '', password: '' }

export interface LoginRouteProps {
  /** The token the API just issued. The session — not this screen — decides what to do with it. */
  onSignedIn(token: string): void
  /** The last session ended because the API refused its token, so the card can say why it is here. */
  sessionEnded: boolean
}

/**
 * The panel's front door.
 *
 * NOT MOUNTED AS A ROUTE ELEMENT, despite the name it carries in the plan's file map:
 * `AdminShellContainer` renders it in place of `<Outlet/>` whenever there is no session, so it
 * appears at whatever admin address the reader asked for and the deep link survives. That is also
 * why it takes props instead of reading `useAdmin()` — it is not an outlet child and there is no
 * outlet context under it.
 *
 * THE ERROR IS A KIND AND NOT A SENTENCE, which is `LoginCard`'s contract and the reason this file
 * has no copy in it: `test/copy.test.ts` scans `src/ui` only, so a sentence resolved out here would
 * ship as fluent English to a Portuguese reader with nothing red anywhere.
 *
 * THE SPLIT IS THE CODE AND NOT THE STATUS. `INVALID_CREDENTIALS` is the login's own 401 and is the
 * only one that means "that password is wrong"; `adminGuard`'s `UNAUTHORIZED` is about a stored
 * token and cannot reach this route, which posts anonymously. Anything else — a 500, a dropped
 * connection that never becomes an `ApiError` at all — is the shop's one "something broke" sentence.
 *
 * THE ERROR IS CLEARED WHEN A SUBMIT STARTS, not when a field changes, and the reason is the
 * `role="alert"`: browsers announce an alert as it is INSERTED, so a second failed attempt with the
 * message still mounted would say nothing at all. Clearing it here guarantees a commit without the
 * element in between.
 */
export function LoginRoute({ onSignedIn, sessionEnded }: LoginRouteProps) {
  const [values, setValues] = useState<LoginValues>(EMPTY)
  const [error, setError] = useState<LoginError | undefined>(undefined)
  const login = useAdminLogin()

  return (
    <AdminLoginPage
      values={values}
      pending={login.isPending}
      error={error}
      sessionEnded={sessionEnded}
      onChange={(field, value) => setValues((previous) => ({ ...previous, [field]: value }))}
      onSubmit={() => {
        setError(undefined)
        login.mutate(values, {
          onSuccess: onSignedIn,
          onError: (failure) =>
            setError(
              failure instanceof ApiError && failure.code === 'INVALID_CREDENTIALS'
                ? 'invalid-credentials'
                : 'unavailable',
            ),
        })
      }}
    />
  )
}
