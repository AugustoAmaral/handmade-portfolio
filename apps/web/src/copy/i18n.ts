import i18next, { type i18n as I18n } from 'i18next'
import { initReactI18next } from 'react-i18next'
import pt from './pt.json'

export type Lang = 'pt' | 'en'
export const LANGS: readonly Lang[] = ['pt', 'en']

/**
 * A dedicated instance rather than the i18next singleton: the v1 app still initialises the
 * global one with its own (dotted-key) resources, and the two must not fight. Keys here are
 * the English sentence itself, so English needs no resource bundle — a missing key renders
 * as the key.
 */
export function createCopyInstance(lang: Lang = 'pt'): I18n {
  const instance = i18next.createInstance({
    lng: lang,
    resources: { pt: { translation: pt } },
    supportedLngs: LANGS as string[],
    fallbackLng: false,
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  })
  instance.use(initReactI18next)
  return instance
}

export const copyI18n = createCopyInstance('pt')
