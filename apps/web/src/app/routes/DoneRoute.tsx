import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { DonePage } from '../../ui/pages'
import { useOrder } from '../api/queries'
import { useShop } from '../ShopShellContainer'

/**
 * spec:202's "max ~30 s". After this the page stops asking and says so: the promise that it
 * refreshes itself is one it has stopped keeping, and a tab left open on the thank-you page is
 * otherwise a client hitting the API every two seconds until someone closes it.
 */
const GIVE_UP_MS = 30_000

/**
 * The page Stripe sends the buyer back to.
 *
 * THE CART IS CLEARED WHEN THE ORDER IS FOUND, never on mount. The two are a whole task apart in
 * their failure modes: clearing on mount empties a valid bag on any refresh whose lookup fails,
 * and a wrong `session_id` in a link someone shared is enough to do it. Once, too — the lookup
 * repeats while the order is pending, and a clear per poll would wipe a bag the buyer had started
 * refilling from the header while they waited.
 *
 * BOTH HALVES OF THE CREDENTIAL GATE THE REQUEST. The session id is the order's password: spec
 * makes it the reason an order number cannot be enumerated. A request without it is a request that
 * cannot succeed, and `useOrder`'s `enabled` is what keeps it from being sent at all.
 */
export function DoneRoute() {
  const { lang, cart } = useShop()
  const [params] = useSearchParams()
  const [gaveUp, setGaveUp] = useState(false)

  // `Number.parseInt` on a missing or non-numeric `?order=` gives NaN, which is a number and would
  // sail through a `!= null` check into `/api/orders/NaN`.
  const parsedOrderNumber = Number.parseInt(params.get('order') ?? '', 10)
  const orderNumber = Number.isInteger(parsedOrderNumber) ? parsedOrderNumber : null
  const sessionId = params.get('session_id')
  const { data: order } = useOrder(orderNumber, sessionId, !gaveUp)

  const clear = cart.clear
  useEffect(() => {
    // The condition is the whole rule and it points the way it does for a measured reason: with it
    // inverted, the "clears once the order is found" test still passes — the bag is empty by the
    // time the order lands because it was emptied on mount — and only "does not clear when the
    // lookup fails" catches it. Neither half of that pair is redundant.
    if (order) clear()
  }, [order, clear])

  useEffect(() => {
    // Started once, from mount, and deliberately not restarted per poll: `order` is a fresh object
    // on every refetch, so a timer keyed on it would be cancelled and re-armed every two seconds
    // and would never fire. What it means is "thirty seconds on this page", not "thirty seconds
    // since the last answer".
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [])

  // `gaveUp` only ever changes the two unconfirmed states — `DonePage` reads `order.status` first —
  // so an order that settles inside the window is unaffected by the timer still running behind it.
  return <DonePage order={order ?? null} lang={lang} gaveUp={gaveUp} />
}
