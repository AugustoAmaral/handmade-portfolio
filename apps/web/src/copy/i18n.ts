import i18next, { type i18n as I18n } from 'i18next'
import pt from './pt.json'

export type Lang = 'pt' | 'en'
export const LANGS: readonly Lang[] = ['pt', 'en']

/**
 * A dedicated instance rather than the i18next singleton: the v1 app still initialises the
 * global one with its own (dotted-key) resources, and the two must not fight. Keys here are
 * the English sentence itself, so English needs no resource bundle — a missing key renders
 * as the key.
 *
 * Deliberately NOT wired with `initReactI18next`: that plugin makes whichever instance calls
 * `init()` last react-i18next's module-level default, which would hand this instance every bare
 * `useTranslation()` in the app — including v1's, whose dotted keys it cannot resolve. Consumers
 * get it through `I18nextProvider` instead, which `useTranslation` reads before the default.
 */
export function createCopyInstance(lang: Lang = 'pt'): I18n {
  return i18next.createInstance({
    lng: lang,
    resources: { pt: { translation: pt } },
    supportedLngs: [...LANGS],
    fallbackLng: false,
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  })
}

export const copyI18n = createCopyInstance('pt')
