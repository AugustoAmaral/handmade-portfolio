import type { ReactNode } from 'react'
import { AdminHeader, type AdminHeaderProps } from '../admin'

export interface AdminShellProps {
  /**
   * The bar's whole contract, as one bag rather than three flattened props — `ShopShell`'s trade
   * and the same reason: the bar is a component owned elsewhere, and spreading it keeps this file
   * from growing a line every time it learns a prop.
   *
   * THIS IS THE FIRST SUPPLIER OF `signedIn`, `current` AND `onSignOut`. Task 2 shipped all three
   * with nothing filling them and named that itself as the shape PR 3's hook layer failed in — a
   * layer whose unit tests are strong and whose wiring nothing exercises. `AdminShell.stories.tsx`
   * is the wiring test.
   */
  header: AdminHeaderProps
  children: ReactNode
}

/**
 * The chrome every panel screen renders inside: the sticky dark bar and the one `<main>`.
 * `ShopShell`'s twin, and the comments there state most of these rules first.
 *
 * THIS IS WHERE THE PANEL'S LANDMARKS ARE DECIDED, and it is the only place they can be decided
 * once. `AdminHeader` brings its own `<header>` and its own NAMED `<nav>`; the `<main>` is here,
 * exactly one of it, and every page renders into it. A page that opened its own would put two
 * unnamed landmarks of the same role on the document — `landmark-unique` and
 * `landmark-no-duplicate-main` both fail that, and it is a failure no component story can produce.
 *
 * THE GATE CANNOT SEE THE OTHER HALF OF THIS. `landmark-one-main`, `page-has-heading-one` and
 * `bypass` all select `html:not(html *)` and the addon runs axe against the body, so a shell that
 * forgot its `<main>` altogether, or a page whose `<h1>` is really a styled `<div>`, passes in
 * silence. The stories assert both directly, which is the only thing that can.
 *
 * NO DRAWER AND NO CART, unlike the shop: the panel has no second overlay surface, so this shell
 * is the header and the main and nothing else.
 *
 * NO LANGUAGE TOGGLE, AND THAT IS A DECISION RATHER THAN AN OMISSION. The panel shares the shop's
 * copy instance and its English-sentence keys — so `test/copy.test.ts` covers every string in it
 * and they all live in `src/ui` — but it renders in whatever language the shop was left in, chosen
 * over there and persisted by `useLang`. A second toggle for a screen with exactly one reader is
 * surface nobody asked for, and it would be a fourth control in a bar that already carries three.
 * Nobody should add one by reflex on seeing the shop's; `AdminShell.stories.tsx` reddens if they do.
 *
 * The root paints the panel's own background and base type rather than leaving it to `index.css`'s
 * body, so a story and the app get it from the same place. `AdminHeader` paints its own `bg-ink`
 * over this, which is load-bearing: the bar is sticky and the page scrolls under it.
 */
export function AdminShell({ header, children }: AdminShellProps) {
  return (
    <div className="bg-paper text-ink font-body min-h-screen">
      <AdminHeader {...header} />
      <main>{children}</main>
    </div>
  )
}
