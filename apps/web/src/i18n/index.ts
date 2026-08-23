import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { useTranslation } from 'react-i18next'
import en from './en.json'
import pt from './pt.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, pt: { translation: pt } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'shop_lang', caches: ['localStorage'] },
  })

export function useLang(): 'pt' | 'en' {
  const { i18n } = useTranslation()
  return i18n.language.startsWith('pt') ? 'pt' : 'en'
}

export default i18n
