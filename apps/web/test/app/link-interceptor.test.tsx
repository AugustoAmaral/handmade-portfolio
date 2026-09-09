import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type AnchorHTMLAttributes, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { LinkInterceptor } from '../../src/app/LinkInterceptor'

// Testing-library only auto-unmounts when vitest runs with `globals: true`, and this project does
// not. Without this, every `screen` query after the first test also sees the previous renders and
// the file dies on "found multiple elements" instead of on anything it means to assert.
afterEach(cleanup)

// The router's own idea of where it is, spelled exactly the way the interceptor spells it.
// Asserting on the rendered route alone would prove the path and silently drop the query and the
// fragment, which is the half of a location that a naive interceptor loses.
function Here() {
  const { pathname, search, hash } = useLocation()
  return <output data-testid="here">{pathname + search + hash}</output>
}

// `.textContent`, never `toHaveTextContent('/')`: that matcher takes a string as a SUBSTRING, so
// '/about' satisfies it and the assertion passes after a navigation it was written to forbid.
// Measured, not assumed — with the matcher in place, nine separate guard mutations sailed past
// this line and were caught only by the `defaultPrevented` assertion after it.
function currentLocation() {
  return screen.getByTestId('here').textContent
}

// A hand-built event rather than `userEvent`: these are the cases the browser really would act on,
// and `button` and the modifier flags have to be set exactly. jsdom does act on them — an
// uncancelled link click schedules a real navigation, surfacing as "Not implemented: navigation"
// from a timer that fires after the test has already finished.
//
// So the outcome is read the way `AnchorGuard.stories.tsx` reads it, for the same reason and in
// the same order: the interceptor decides in the CAPTURE phase, so by the BUBBLE phase the flag
// is its decision. Record first, cancel second. In Chromium that story is buying back the
// runner's own page; here it is only buying quiet, but a test whose failure mode is a stray async
// log is a test nobody reads.
function clickAndReportOutcome(anchor: Element, init: MouseEventInit = {}): boolean | undefined {
  let intercepted: boolean | undefined
  const record = (event: Event) => {
    intercepted = event.defaultPrevented
    event.preventDefault()
  }
  document.addEventListener('click', record)
  try {
    // `act`, even though a raw `dispatchEvent` is synchronous: React queues the state update from
    // a `navigate()` outside act and does not flush it, so `Here` keeps rendering the OLD route
    // and any "the route did not change" assertion passes while a navigation is pending. Measured
    // — without this, nine guard mutations navigated and the route assertion below stayed green.
    act(() => {
      anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }))
    })
  } finally {
    document.removeEventListener('click', record)
  }
  // `undefined` means the click never reached the document, which is a broken test rather than a
  // fall-through — it fails the comparisons below instead of passing as "not intercepted".
  return intercepted
}

function renderWithRouter(children: ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LinkInterceptor>{children}</LinkInterceptor>
      <Here />
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/about" element={<p>about page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LinkInterceptor', () => {
  it('navigates client-side for a plain same-origin anchor', async () => {
    renderWithRouter(<a href="/about">About</a>)
    await userEvent.click(screen.getByText('About'))
    // `queryByText`, not `findByText(...)` + `toBeInTheDocument()`: `findByText` already throws
    // when the text is absent, so the matcher after it can never be the thing that fails.
    expect(screen.queryByText('about page')).toBeInTheDocument()
  })

  it('navigates when the click lands on a child of the anchor', async () => {
    // Real clicks land on the <span>, not the <a>. A handler that reads `event.target` as the
    // anchor works in a story with bare text and fails on every composed component — and every
    // link in this design is composed: a card title, a thumbnail, an eyebrow above a heading.
    renderWithRouter(
      <a href="/about">
        <span>Nested</span>
      </a>,
    )
    await userEvent.click(screen.getByText('Nested'))
    expect(screen.queryByText('about page')).toBeInTheDocument()
  })

  it('carries the query string and the fragment, not just the path', async () => {
    // Both are live in this design: `routes.thanks()` builds a query and the product page links
    // to `#specs`. Navigating with the path alone renders the right screen while losing the
    // filter and the scroll target, so nothing that checks the rendered route can catch it.
    renderWithRouter(<a href="/about?from=card#specs">Deep</a>)
    await userEvent.click(screen.getByText('Deep'))
    expect(currentLocation()).toBe('/about?from=card#specs')
  })

  it('cancels the click it takes over, so the browser does not also load the page', () => {
    // The other half of interception, and invisible to every route assertion in this file: an
    // interceptor that navigates client-side WITHOUT cancelling leaves the browser to do a full
    // page load on top, which under jsdom is a stray log and in a browser is the whole SPA
    // reloading on every link. This is `SameOriginClickIsIntercepted` from the story twin.
    renderWithRouter(<a href="/about">About</a>)
    expect(clickAndReportOutcome(screen.getByText('About'))).toBe(true)
  })

  it('intercepts target="_self", which is the explicit spelling of "no target"', async () => {
    // Pins the `!== '_self'` half of the target guard. Without it, every anchor that spells out
    // the default browsing context drops to a full page load — a real regression that looks like
    // "the target guard works" if `_blank` is the only case tested.
    renderWithRouter(
      <a href="/about" target="_self">
        Self
      </a>,
    )
    await userEvent.click(screen.getByText('Self'))
    expect(screen.queryByText('about page')).toBeInTheDocument()
  })

  it('leaves a click that is not inside a link alone, on a page that has links', async () => {
    // The link is here on purpose. The failure this guards is not "the interceptor crashed on a
    // button" but "the interceptor found SOME link and followed it" — the shape a `CartLine` hits
    // when its stepper sits next to a link to the product. With no anchor in the tree, a lookup
    // that ignores `event.target` entirely still finds nothing and the test proves nothing.
    renderWithRouter(
      <>
        <a href="/about">About</a>
        <button type="button">Add to bag</button>
      </>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(currentLocation()).toBe('/')
  })

  it('does not navigate when something above the root already handled the click', async () => {
    // Capture phase is not first in line: a native listener on `document` runs before React's,
    // which is bound to the root container. A click that has already been cancelled has already
    // been decided by whoever cancelled it, and re-deciding it here is how an interceptor turns
    // "dismiss the drawer" into "dismiss the drawer AND follow the link underneath".
    // `defaultPrevented` is true either way here, so the route is the only observable difference.
    const cancel = (event: Event) => event.preventDefault()
    document.addEventListener('click', cancel, true)
    try {
      renderWithRouter(<a href="/about">About</a>)
      await userEvent.click(screen.getByText('About'))
      expect(currentLocation()).toBe('/')
    } finally {
      document.removeEventListener('click', cancel, true)
    }
  })

  // Every row is a separate `if` in the component, and the four modifier keys are separate
  // operands of one `||`. A mutation that deletes the whole early-return block reddens all of
  // them at once and proves none of them individually, so each reason gets its own row.
  const fallThrough: Array<[string, AnchorHTMLAttributes<HTMLAnchorElement>, MouseEventInit]> = [
    ['the meta key is held', { href: '/about' }, { metaKey: true }],
    ['the ctrl key is held', { href: '/about' }, { ctrlKey: true }],
    ['the shift key is held', { href: '/about' }, { shiftKey: true }],
    ['the alt key is held', { href: '/about' }, { altKey: true }],
    ['the click is not the primary button', { href: '/about' }, { button: 1 }],
    ['the anchor has target', { href: '/about', target: '_blank' }, {}],
    ['the anchor has download', { href: '/about', download: '' }, {}],
    ['the anchor is cross-origin', { href: 'https://example.com/x' }, {}],
    ['the href is a mailto', { href: 'mailto:a@b.c' }, {}],
  ]

  it.each(fallThrough)('falls through to the browser when %s', (_case, anchorProps, clickInit) => {
    renderWithRouter(<a {...anchorProps}>Link</a>)

    const intercepted = clickAndReportOutcome(screen.getByText('Link'), clickInit)

    // Two claims, and each is the first to break under a different mutation. The router did not
    // take it: deleting any single guard navigates and reddens this line. And the browser still
    // gets it: an interceptor that cancels a click and then declines to handle it leaves the
    // route alone while killing cmd-click, download and mailto in silence, which only the flag
    // can see. The route goes first because it is the line the nine guard mutations reach.
    expect(currentLocation()).toBe('/')
    expect(intercepted).toBe(false)
  })
})
