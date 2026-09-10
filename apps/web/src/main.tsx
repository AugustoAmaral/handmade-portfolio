import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router'
import App from './App'
import { retryQuery } from './app/api/client'
import { copyI18n } from './copy/i18n'
import './index.css'

/**
 * `retryQuery` rather than react-query's default, and it is the difference between a mistyped
 * `/exhibit/:slug` showing the not-found screen at once and showing it after about seven seconds of
 * backoff spent re-asking a question the API has already answered. See the note on the predicate.
 */
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: retryQuery } } })

/**
 * The copy instance is provided rather than installed as react-i18next's default: `src/copy/i18n.ts`
 * deliberately skips `initReactI18next`, so a bare `useTranslation()` only reaches it through this
 * provider. `useLang` drives whichever instance its tree was given, which is what lets Storybook
 * hand each story a different one.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={copyI18n}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </StrictMode>,
)
