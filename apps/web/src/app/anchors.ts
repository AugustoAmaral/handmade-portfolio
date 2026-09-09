import { type MouseEvent } from 'react'

/**
 * The one rule for "is this click the router's, or the browser's?".
 *
 * Two things apply it: `LinkInterceptor` at the app root, and the `AnchorGuard` decorator in
 * `.storybook/preview.tsx`, which has to make the same call because a real `<a href>` in a story
 * is a live link with no router behind it. `AnchorGuard.stories.tsx` exercises the decorator in
 * real Chromium, so as long as both sides call THIS function, that story is evidence about the
 * app. It used to be a second copy of the rule, and Task 4 came within one review of shipping four
 * differences between them — none of which any test could have caught, because each copy was only
 * ever exercised by its own project. A story that passes while the app is broken is worse than no
 * story, because it reads as proof.
 *
 * Kept free of react-router (and of anything else the app pulls in) on purpose: it is a pure DOM
 * predicate, so importing it into the Storybook preview does not drag the router into every
 * story bundle. The `react` import is types only and disappears at compile time.
 *
 * Six independent reasons to leave a click alone, each of them something a person deliberately
 * does: a middle click or a held modifier opens the link in a second tab, `target` asks for
 * another browsing context, `download` saves a file, a cross-origin or `mailto:` href leaves the
 * app entirely, and a click that is not inside a link is not a navigation at all. They are
 * separate `if`s rather than one condition because they are separate decisions — merged, a single
 * test could "cover" all six while proving none of them.
 */
export function interceptableAnchor(event: MouseEvent<HTMLElement>): HTMLAnchorElement | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  if (!(event.target instanceof Element)) return null
  // `closest`, not `event.target`: a real click lands on whatever is innermost — the <span> in a
  // card title, the <img> in a thumbnail — and only equals the <a> when the link is bare text.
  const anchor = event.target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return null
  // `_self` is the explicit spelling of "no target"; any other value asks for another browsing
  // context, which is the browser's job and not the router's.
  const target = anchor.getAttribute('target')
  if (target && target !== '_self') return null
  // `anchor.origin` is the RESOLVED origin of the href, so a relative path is same-origin while a
  // non-HTTP scheme (`mailto:`, `tel:`) serialises to the string "null" and falls through here.
  // Reading it off the element rather than building `new URL(href, location.href)` also means a
  // malformed href can never throw out of a click handler.
  if (anchor.origin !== window.location.origin) return null
  return anchor
}

/**
 * Where the router should go for an anchor it has taken over: the location INSIDE the app, never
 * `href`. An absolute URL handed to `navigate()` is treated as a relative path — `/https:/…`.
 */
export function routeTargetOf(anchor: HTMLAnchorElement): string {
  return anchor.pathname + anchor.search + anchor.hash
}
