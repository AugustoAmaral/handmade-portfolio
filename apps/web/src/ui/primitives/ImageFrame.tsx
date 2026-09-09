import { useTranslation } from 'react-i18next'

interface Props {
  src?: string
  alt: string
  ratio?: '4/5' | '1/1' | '16/9'
  placeholder?: string
}

/**
 * Product photography slot: keeps the prototype's aspect ratios and degrades to paper.
 * The placeholder sits at `opacity-65` (5.13:1 on paper-2), not the lighter grey the eye wants
 * here — it is real text on a real background, so it is held to AA like any other copy.
 */
export function ImageFrame({ src, alt, ratio = '4/5', placeholder }: Props) {
  const { t } = useTranslation()
  return (
    <div className="bg-paper-2 relative w-full overflow-hidden" style={{ aspectRatio: ratio }}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="font-mono absolute inset-0 flex items-center justify-center px-4 text-center text-[11px] uppercase tracking-[0.14em] opacity-65">
          {placeholder ?? t('No photo yet')}
        </div>
      )}
    </div>
  )
}
