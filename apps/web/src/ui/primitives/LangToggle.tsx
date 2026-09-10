import { useTranslation } from 'react-i18next'

/**
 * Two whole sentences as keys rather than one interpolated `Switch to {{lang}}`: the language
 * name has to decline with the sentence around it, and an interpolated key would have shipped
 * "Mudar para English". The visible affordance stays the bare two-letter code — it is the target
 * language, not a word to translate — so only the accessible name is language-aware.
 */
export function LangToggle({ lang, onToggle }: { lang: 'pt' | 'en'; onToggle: () => void }) {
  const { t } = useTranslation()
  const next = lang === 'pt' ? 'en' : 'pt'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={next === 'en' ? t('Switch to English') : t('Switch to Portuguese')}
      className="font-mono text-[12px] uppercase tracking-[0.1em] underline underline-offset-4"
    >
      {next}
    </button>
  )
}
