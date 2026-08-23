import { useTranslation } from 'react-i18next'
import { useLang } from '../i18n'

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const lang = useLang()
  const next = lang === 'pt' ? 'en' : 'pt'
  return (
    <button onClick={() => i18n.changeLanguage(next)} className="text-sm underline underline-offset-4" aria-label={`Switch to ${next}`}>
      {next.toUpperCase()}
    </button>
  )
}
