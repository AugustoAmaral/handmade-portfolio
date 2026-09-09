import type { MouseEvent, ReactNode } from 'react'
import type { Preview } from '@storybook/react-vite'
import { action } from 'storybook/actions'
import { I18nextProvider } from 'react-i18next'
import { type Lang, createCopyInstance } from '../src/copy/i18n'
import '../src/index.css'

// One initialised instance per language, created on first use. Swapping instances instead of
// mutating a shared one means a story paints in the right language on its FIRST frame (an effect
// would only fix it on the second) and no story can leak a language into the story after it.
// `init()` completes synchronously here because the resources are inline and there is no backend
// or async detector; if either is ever added, this has to be awaited before the first render.
const instances = new Map<Lang, ReturnType<typeof createCopyInstance>>()

function copyFor(locale: Lang) {
  let instance = instances.get(locale)
  if (!instance) {
    instance = createCopyInstance(locale)
    void instance.init()
    instances.set(locale, instance)
  }
  return instance
}

// Storybook renders stories in its own iframe, so the fonts the app loads from index.html have
// to be requested here as well.
const fonts = document.createElement('link')
fonts.rel = 'stylesheet'
fonts.href =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap'
document.head.appendChild(fonts)

// Storybook has no router, so a real `<a href>` in a story is a live link. In the preview iframe a
// click leaves the story; under the vitest browser project it navigates the RUNNER's own page out
// from under itself, which is a hang or a torn-down suite rather than a red assertion. The spec
// (line 181) makes this a global decorator, and it mirrors `LinkInterceptor`'s rule exactly: only
// the click the router would own is cancelled — primary button, no modifier key, same origin, no
// `target`, no `download`. Everything else falls through untouched, so cmd-click, middle-click,
// "open in new tab", downloads, `mailto:` and external links keep their native behaviour.
const navigate = action('navigate')

function interceptableAnchor(event: MouseEvent<HTMLElement>): HTMLAnchorElement | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  if (!(event.target instanceof Element)) return null
  const anchor = event.target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return null
  // `_self` is the explicit spelling of "no target"; any other value asks for another browsing
  // context, which is the browser's job and not the router's.
  const target = anchor.getAttribute('target')
  if (target && target !== '_self') return null
  // `anchor.origin` is the RESOLVED origin of the href, so a relative path is same-origin while a
  // non-HTTP scheme (`mailto:`, `tel:`) serialises to "null" and falls through on this line.
  if (anchor.origin !== window.location.origin) return null
  return anchor
}

function AnchorGuard({ children }: { children: ReactNode }) {
  return (
    // Capture phase, like the app's interceptor: the decision is made before any handler inside
    // the story can see the click, so a component's own onClick still runs and still sees a
    // cancelled event.
    <div
      onClickCapture={(event) => {
        const anchor = interceptableAnchor(event)
        if (!anchor) return
        event.preventDefault()
        // The same string `LinkInterceptor` hands to `navigate()`, so the actions panel shows the
        // route the app would take rather than the raw (possibly relative) attribute.
        navigate(anchor.pathname + anchor.search + anchor.hash)
      }}
    >
      {children}
    </div>
  )
}

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true },
    // The a11y addon ships `test: 'todo'`, which reports violations in the panel but never fails
    // a run. Wiring the addon into the vitest project is only half the job; this is the half that
    // makes an axe violation a red test.
    a11y: { test: 'error' },
  },
  globalTypes: {
    locale: {
      description: 'Copy language',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'pt', title: 'Português' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'pt' },
  decorators: [
    (Story, context) => {
      const locale = (context.globals.locale as Lang) ?? 'pt'
      return (
        <I18nextProvider i18n={copyFor(locale)} defaultNS="translation">
          <div className="bg-paper text-ink font-body p-6">
            <Story />
          </div>
        </I18nextProvider>
      )
    },
    (Story) => (
      <AnchorGuard>
        <Story />
      </AnchorGuard>
    ),
  ],
}

export default preview
