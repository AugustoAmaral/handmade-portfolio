import type { ReactNode } from 'react'
import { CartDrawer, type CartDrawerProps, ShopHeader, type ShopHeaderProps } from '../shop'

export interface ShopShellProps {
  header: ShopHeaderProps
  drawer: CartDrawerProps
  children: ReactNode
}

/**
 * The chrome every shop page renders inside: the sticky header, the one `<main>`, and the drawer.
 *
 * THIS IS WHERE THE PAGE'S LANDMARKS ARE DECIDED, and it is the only place they can be decided
 * once. `ShopHeader` brings its own `<header>` and its own named `<nav>`; the `<main>` is here,
 * exactly one of it, and every page renders into it. A page that opened its own `<main>` would put
 * two unnamed landmarks of the same role on the document, which is what axe's `landmark-unique`
 * fails on — and it is the failure that only ever appears once components are composed, because a
 * component story renders one landmark and passes.
 *
 * THE DRAWER IS OUTSIDE `<main>`, not inside it. It is fixed to the viewport and it belongs to the
 * shell rather than to whatever page is under it, so nesting it in the page's landmark would say
 * the bag is part of the article you are reading. It renders `null` when closed, so the closed
 * state costs the document nothing at all — no hidden tab stops, no second checkout link a
 * keyboard user can reach through a drawer they never opened.
 *
 * THE PROPS ARE TWO BAGS, `header` and `drawer`, rather than eighteen flattened ones. Both are
 * whole component contracts owned elsewhere: spreading them keeps this file from having to grow a
 * line every time either component learns a prop, and it makes the shell's own job — landmarks and
 * nesting — the only thing in it.
 *
 * NOT IMPLEMENTED HERE, ON PURPOSE, and the drawer's own note says the same: keeping focus inside
 * the open bag, returning it to the button that opened it, and closing on Escape. All three need
 * an effect and a handle on a rendered node, and `test/ui-boundaries.test.ts` rejects both
 * anywhere under `src/ui` — by scanning the source as text, which is why this paragraph cannot
 * name them. `ShopShellContainer` (Task 11) owns them.
 *
 * The root paints the page's own background and base type rather than leaving it to `index.css`'s
 * `body`, so that a story, the app and the eventual admin shell all get it from the same place.
 */
export function ShopShell({ header, drawer, children }: ShopShellProps) {
  return (
    <div className="bg-paper text-ink font-body min-h-screen">
      <ShopHeader {...header} />
      <main>{children}</main>
      <CartDrawer {...drawer} />
    </div>
  )
}
