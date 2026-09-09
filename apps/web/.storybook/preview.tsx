import type { Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { copyI18n } from '../src/copy/i18n'
import '../src/index.css'

// The instance is created by `createInstance` but not initialised by it. Until `init()` runs,
// `t()` returns undefined and `changeLanguage()` throws, so this has to happen before the first
// story renders. With inline resources and no backend, `init()` completes synchronously, so
// there is nothing to await here.
void copyI18n.init()

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
      const locale = (context.globals.locale as 'pt' | 'en') ?? 'pt'
      useEffect(() => {
        void copyI18n.changeLanguage(locale)
      }, [locale])
      return (
        <I18nextProvider i18n={copyI18n} defaultNS="translation">
          <div className="bg-paper text-ink font-body p-6">
            <Story />
          </div>
        </I18nextProvider>
      )
    },
  ],
}

export default preview
