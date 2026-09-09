import { type CartItem, type PublicProduct, computeTotals, hasPhysicalItems } from '@shop/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useOutletContext } from 'react-router'
import { ShopShell } from '../ui/pages'
import type { CartLineData } from '../ui/shop'
import { useProducts } from './api/queries'
import { type CartApi, useCart } from './state/useCart'
import { type Lang, useLang } from './state/useLang'

/**
 * The shop's one address. Configuration rather than copy — `ClosingBlock` and `AboutClosing` both
 * build a `mailto:` from it, and spec:"Assumptions" names this exact address.
 */
export const CONTACT_EMAIL = 'contato@augustoamaral.com'

/**
 * What the shell hands to the route under it. Client state only: the cart, the language and the
 * two drawer intents. SERVER STATE IS DELIBERATELY ABSENT — a route that needs the catalogue calls
 * `useProducts()` itself, because react-query's cache already is the one shared copy and passing
 * the same data down a second channel is how the two start disagreeing.
 *
 * `lines` is the exception and it is here for the same reason it is not a second copy: turning
 * `cart.items` plus the catalogue into priced, named lines is ONE derivation, the drawer and the
 * checkout both need its result, and `CartLineData`'s own note argues that two derivations of
 * "what is in the bag and what does it cost" is how the drawer and the checkout start disagreeing.
 */
export interface ShopContext {
  lang: Lang
  cart: CartApi
  lines: CartLineData[]
  /** Opens the drawer without touching the cart — the header's bag and the checkout's back bar. */
  openCart(): void
  /** Adds the piece AND opens the drawer, so the bag is visible the moment it changes. */
  addToCart(slug: string): void
}

export function useShop(): ShopContext {
  return useOutletContext<ShopContext>()
}

/**
 * A cart line the catalogue cannot name is DROPPED rather than rendered from the slug alone. The
 * bag holds slugs; a piece that has since gone inactive is no longer in `/api/products`, so there
 * is no name and no price for it — and a line reading `carta-escrita · R$ 0,00` in a total is
 * worse than one that is not there. Dropping it from the display also drops it from the checkout
 * POST, which is the point: the buyer is never charged for something the page could not price.
 *
 * The header's count deliberately keeps counting it. It comes off `cart.items`, which needs no
 * network, so the bag has a number on the very first paint instead of a zero that fills in a
 * moment later — and while the catalogue is in flight EVERY line is unnameable, so a count derived
 * from these lines would read "Sacola (0)" on every page load.
 */
function cartLinesOf(products: readonly PublicProduct[], items: readonly CartItem[], lang: Lang): CartLineData[] {
  const bySlug = new Map(products.map((product) => [product.slug, product]))
  return items.flatMap((item) => {
    const product = bySlug.get(item.slug)
    if (!product) return []
    return [
      {
        slug: product.slug,
        name: product.name[lang],
        subtitle: product.subtitle[lang],
        unitCents: product.priceCents,
        qty: item.qty,
        lineCents: product.priceCents * item.qty,
        type: product.type,
      },
    ]
  })
}

// Everything a keyboard can land on inside the open bag. Queried fresh on every keypress rather
// than captured once: the drawer's contents change as lines are removed, and a list captured at
// open time would wrap Tab onto a button that is no longer there.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusablesIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
}

/**
 * The shop's chrome and every piece of client state under it: the cart, the language, and whether
 * the bag is open. The routes below render into `<Outlet/>` and read it all from the context.
 *
 * THE DRAWER'S KEYBOARD BEHAVIOUR LIVES HERE, and both `CartDrawer` and `ShopShell` carry a note
 * saying so. Neither could own it: it needs a lasting handle on a rendered node and work that runs
 * after the paint, and `test/ui-boundaries.test.ts` rejects both anywhere under `src/ui` — by
 * scanning the source as text, which is why those two notes cannot even name the APIs involved.
 * Three behaviours, and they are three separate promises the markup was making on its own:
 *
 * - ESCAPE CLOSES IT. The drawer's scrim is `aria-hidden` and carries no role, so a mouse can
 *   dismiss the bag by clicking beside it and, without this, a keyboard could only do it by
 *   finding the ✕. Escape is the one gesture every modal owes its reader.
 * - FOCUS GOES IN WHEN IT OPENS. The drawer is appended after `<main>`, so on open the reader's
 *   focus is still somewhere up the page and everything they Tab to next is behind the scrim.
 * - FOCUS COMES BACK WHEN IT CLOSES. To the control that opened it, whichever that was: the
 *   header's bag on one route, a product page's "Colocar na sacola" on another. Recording the
 *   active element beats hard-coding the bag button, which would throw a buyer who added from the
 *   catalogue back up to the header instead of leaving them where they were reading.
 *
 * And the trap, which is what makes `aria-modal="true"` true. Without it the attribute tells a
 * screen reader the rest of the page is inert while Tab walks straight out into it.
 */
export function ShopShellContainer() {
  const cart = useCart()
  const { lang, toggle } = useLang()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // The control focus returns to. Held in a ref rather than state because nothing renders from it
  // and writing it must not cost a render on its own.
  const openerRef = useRef<HTMLElement | null>(null)
  const { data: products } = useProducts()

  const lines = useMemo(() => cartLinesOf(products ?? [], cart.items, lang), [products, cart.items, lang])
  const totalsLines = lines.map((line) => ({ priceCents: line.unitCents, qty: line.qty, type: line.type }))
  const totals = computeTotals(totalsLines, null)

  const openCart = useCallback(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDrawerOpen(true)
  }, [])

  const closeCart = useCallback(() => setDrawerOpen(false), [])

  const add = cart.add
  const addToCart = useCallback(
    (slug: string) => {
      add(slug)
      openCart()
    },
    [add, openCart],
  )

  useEffect(() => {
    if (!drawerOpen) return
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) return
    focusablesIn(dialog)[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (!dialog) return
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusables = focusablesIn(dialog)
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement
      // "Not inside" is handled by both branches on purpose: focus can be on the body (nothing was
      // focusable when the bag opened) or on the page behind it, and either way the next Tab
      // belongs to the drawer rather than to whatever is under the scrim.
      const inside = active instanceof HTMLElement && dialog.contains(active)
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  useEffect(() => {
    if (drawerOpen) return
    const opener = openerRef.current
    openerRef.current = null
    // `isConnected`, because closing the bag by going to the checkout unmounts the page the opener
    // was on. Focusing a detached node silently sends focus to the body instead.
    if (opener?.isConnected) opener.focus()
  }, [drawerOpen])

  const context: ShopContext = { lang, cart, lines, openCart, addToCart }

  return (
    <ShopShell
      header={{ cartCount: cart.count, lang, onToggleLang: toggle, onOpenCart: openCart }}
      drawer={{
        open: drawerOpen,
        lines,
        lang,
        itemsCents: totals.itemsCents,
        // `null` is "not chosen yet" and renders the dash plus "calculado no checkout". A bag with
        // nothing to post has nothing to choose, so it gets a real zero instead of a dash beside a
        // promise that the next screen will price something it will not.
        shippingCents: hasPhysicalItems(totalsLines) ? null : 0,
        totalCents: totals.totalCents,
        onInc: (slug) => cart.add(slug),
        onDec: (slug) => cart.setQty(slug, (cart.items.find((item) => item.slug === slug)?.qty ?? 0) - 1),
        onClose: closeCart,
      }}
    >
      <Outlet context={context} />
    </ShopShell>
  )
}
