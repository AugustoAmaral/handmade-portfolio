import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Outlet, useLocation, useOutletContext } from 'react-router'
import type { AdminSection } from '../ui/admin'
import { AdminShell } from '../ui/pages'
import { LoginRoute } from './routes/admin/LoginRoute'
import { type AdminSessionApi, useAdminSession } from './state/useAdminSession'
import { type Lang, useLang } from './state/useLang'

/**
 * What the panel's shell hands to the screen under it. Client state only, the same split
 * `ShopContext` makes and for the same reason: a route that needs the catalogue calls
 * `useAdminProducts()` itself, because react-query's cache already is the one shared copy and a
 * second channel carrying the same rows is how the two start disagreeing.
 *
 * `session` travels whole rather than as a token, because the screens under here do not want the
 * token at all — `client.ts` reads it out of storage on every request. What they want is the two
 * things only the session can answer: which language the panel is in, and how to end it.
 */
export interface AdminContext {
  lang: Lang
  session: AdminSessionApi
}

export function useAdmin(): AdminContext {
  return useOutletContext<AdminContext>()
}

/**
 * Every admin query key starts with this, which `queries.ts` states as a contract rather than as a
 * convention: it is what lets a session ending drop the whole subtree in one call.
 */
const ADMIN_KEY = ['admin'] as const

/**
 * The bar's current section, from the path. Both branches are spelled out because the failure mode
 * is a derivation that answers the same thing everywhere — `startsWith('/admin')` alone marks both
 * links on both screens, and on a screen with one link it would look exactly right.
 */
function sectionOf(pathname: string): AdminSection | undefined {
  if (pathname.startsWith('/admin/orders')) return 'orders'
  if (pathname.startsWith('/admin/products')) return 'products'
  return undefined
}

/**
 * The panel's chrome and its session. `ShopShellContainer`'s twin, and much smaller: there is no
 * drawer, no cart and no language toggle, so what is left is the guard.
 *
 * AN UNAUTHENTICATED VISIT RENDERS THE LOGIN. It does not navigate to it, and that is the whole
 * defence against the redirect loop Task 1 was asked to design against: there is no second URL to
 * bounce between, and the address the reader asked for is still the address they are on when they
 * sign in. `/admin/orders` opened cold shows the login and then shows the orders — one journey,
 * no lost destination.
 *
 * THE LOGIN IS RENDERED IN PLACE OF `<Outlet/>` AND IS THEREFORE NOT AN OUTLET CHILD, which is why
 * it takes props where the three real screens read `useAdmin()`. Handing it the two things it needs
 * also keeps the import one-way: `LoginRoute` knows nothing about this file.
 *
 * A 401 ENDS THE SESSION FROM HERE, ONCE, FOR EVERY REQUEST THE PANEL MAKES. The alternative was a
 * call to `endIfRejected` in each container's error path, which is four copies of one rule and a
 * fifth one missing the day somebody adds a screen. Subscribing to the two caches catches the
 * mutations as well — an expired token first shows up on a save at least as often as on a read —
 * and `endIfRejected` is deliberately narrow enough to be safe as a blanket: it ends the session
 * for a 401 whose code is `UNAUTHORIZED` and for nothing else, so a 500, a dropped connection and
 * the login's own `INVALID_CREDENTIALS` all pass through it untouched.
 *
 * AND THE ADMIN CACHE GOES WITH THE SESSION. Keyed on `isAuthenticated` rather than done inside
 * the sign-out handler, so the rejection path gets it too: by the time this effect runs the guard
 * has already swapped `<Outlet/>` for the login, so nothing is observing those queries and
 * removing them cannot provoke a refetch. What it buys is that the next session never opens on the
 * last one's rows, or on its error.
 */
export function AdminShellContainer() {
  const session = useAdminSession()
  const { lang } = useLang()
  const { pathname } = useLocation()
  const client = useQueryClient()
  const { endIfRejected, isAuthenticated, signIn, signOut, rejected } = session

  useEffect(() => {
    const unsubscribeQueries = client.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'error') endIfRejected(event.query.state.error)
    })
    const unsubscribeMutations = client.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.mutation.state.status === 'error')
        endIfRejected(event.mutation.state.error)
    })
    return () => {
      unsubscribeQueries()
      unsubscribeMutations()
    }
  }, [client, endIfRejected])

  useEffect(() => {
    if (!isAuthenticated) client.removeQueries({ queryKey: ADMIN_KEY })
  }, [isAuthenticated, client])

  const context: AdminContext = { lang, session }

  return (
    <AdminShell
      header={{
        // `undefined` while signed out, which is `AdminHeaderProps`'s own reading of the login:
        // a screen that is neither section. The bar hides both links then anyway, so this is the
        // contract being kept rather than a difference anyone can see.
        current: isAuthenticated ? sectionOf(pathname) : undefined,
        signedIn: isAuthenticated,
        onSignOut: signOut,
      }}
    >
      {isAuthenticated ? <Outlet context={context} /> : <LoginRoute onSignedIn={signIn} sessionEnded={rejected} />}
    </AdminShell>
  )
}
