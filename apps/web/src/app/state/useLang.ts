import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGS, type Lang } from '../../copy/i18n'

export type { Lang }

const STORAGE_KEY = 'shop_lang'

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

// Two independent decisions, not one: whether a stored preference exists AND is a language we
// ship, and what to pick when it does not. `shop_lang` is user-editable and survives deploys, so
// an unsupported value degrades to the browser's choice rather than reaching i18next as a
// language with no resources.
function initialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isLang(stored)) return stored
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

/**
 * The only place the language changes. The instance comes from the provider rather than an
 * import, because `src/copy/i18n.ts` deliberately keeps itself out of react-i18next's global
 * default — the hook drives whichever instance its tree was given.
 */
export function useLang(): { lang: Lang; toggle(): void } {
  const { i18n } = useTranslation()
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    // `language`, not `resolvedLanguage`: only pt has a resource bundle (English keys render
    // themselves), and i18next only resolves to a language that HAS translations, so
    // `resolvedLanguage` is undefined while the app is in English. Guarding on it would compare
    // undefined to 'en' and re-issue the call on every run.
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
  }, [lang, i18n])

  // Persisting belongs here and not in the effect: `shop_lang` records a CHOICE. Written on mount
  // it would record a sniff instead, freezing the first visit's browser setting forever — a
  // visitor who later switched their browser to Portuguese would keep getting English. Reading
  // `lang` rather than the functional update is what makes the next value available to write, and
  // is why this closes over `[lang]`; it is a prop two components deep and changes once per switch.
  const toggle = useCallback(() => {
    const next: Lang = lang === 'pt' ? 'en' : 'pt'
    localStorage.setItem(STORAGE_KEY, next)
    setLang(next)
  }, [lang])

  return { lang, toggle }
}
