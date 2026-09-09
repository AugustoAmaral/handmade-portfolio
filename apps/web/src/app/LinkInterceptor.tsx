import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { interceptableAnchor, routeTargetOf } from './anchors'

/**
 * One click handler at the app root upgrades same-origin anchor clicks to client-side navigation,
 * so every component in `ui/` can render a real `<a href>` built from `ui/routes.ts` and none of
 * them imports the router. The links stay real links: right-click, "copy link address", middle
 * click and view-source all keep working, and the page is still navigable before JS has run.
 *
 * Which clicks those are is `interceptableAnchor`'s decision, shared with the Storybook preview
 * so the `AnchorGuard` stories exercise this exact rule in a real browser.
 */
export function LinkInterceptor({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div
      onClickCapture={(event) => {
        // Not part of the shared rule, because it is a different question: `interceptableAnchor`
        // asks "is this the router's click?", and this asks "has this click already been decided?"
        // Only the app root ever needs it. Capture phase means "before anything INSIDE the app
        // sees this click", not "before anything at all" — a handler bound above the root, a modal
        // backdrop or a native listener on `document`, still runs first. The Storybook decorator
        // is the outermost element in the preview iframe, so nothing can get there before it.
        if (event.defaultPrevented) return
        const anchor = interceptableAnchor(event)
        if (!anchor) return
        event.preventDefault()
        void navigate(routeTargetOf(anchor))
      }}
    >
      {children}
    </div>
  )
}
