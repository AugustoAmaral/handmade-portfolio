import { useTranslation } from 'react-i18next'

export function AboutPage() {
  const { t } = useTranslation()
  return (
    <article className="prose max-w-2xl font-serif">
      <h1 className="text-2xl font-bold">{t('about.title')}</h1>
      <p className="mt-4 whitespace-pre-line leading-relaxed text-stone-700">{t('about.body')}</p>
    </article>
  )
}
