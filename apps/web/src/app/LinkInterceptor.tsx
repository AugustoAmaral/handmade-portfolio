import { type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

// Six independent reasons to leave a click alone, each of them something a person deliberately
// does: a middle click or a held modifier opens the link in a second tab, `target` asks for
// another browsing context, `download` saves a file, a cross-origin or `mailto:` href leaves the
// app entirely, and a click that is not inside a link is not a navigation at all. They are
// separate `if`s rather than one condition because they are separate decisions — merging them
// would make a single test able to "cover" all six while proving none of them.
//
// This is deliberately the same rule, line for line, as `interceptableAnchor` in
// `.storybook/preview.tsx`, which `AnchorGuard.stories.tsx` pins in real Chromium. A story that
// shows a link falling through is only evidence about the app if the app decides it identically.
// The two copies exist because the preview lives outside `src/` and standing in for the app is
// its whole job — importing the app into it would make the twin a mirror instead of a witness.
function interceptableAnchor(event: MouseEvent<HTMLElement>): HTMLAnchorElement | null {
  // Capture phase means "before anything inside the app sees this click", not "before anything at
  // all". A handler bound above the root — a modal backdrop, a native listener on `document` —
  // still runs first, and if it cancelled the click it has already decided what happens.
  if (event.defaultPrevented) return null
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
 * One click handler at the app root upgrades same-origin anchor clicks to client-side navigation,
 * so every component in `ui/` can render a real `<a href>` built from `ui/routes.ts` and none of
 * them imports the router. The links stay real links: right-click, "copy link address", middle
 * click and view-source all keep working, and the page is still navigable before JS has run.
 */
export function LinkInterceptor({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div
      onClickCapture={(event) => {
        const anchor = interceptableAnchor(event)
        if (!anchor) return
        event.preventDefault()
        // Path, query and fragment rather than `href`: the router wants a location inside the app,
        // and handing it the absolute URL would make it a relative path — `/https:/localhost/…`.
        void navigate(anchor.pathname + anchor.search + anchor.hash)
      }}
    >
      {children}
    </div>
  )
}
