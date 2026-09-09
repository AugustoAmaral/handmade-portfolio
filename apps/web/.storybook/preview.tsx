import type { Preview } from '@storybook/react-vite'
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
  ],
}

export default preview
