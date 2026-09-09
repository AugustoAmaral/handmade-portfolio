import { useTranslation } from 'react-i18next'

interface Props {
  src?: string
  alt: string
  ratio?: '4/5' | '1/1' | '16/9' | 'fill'
  placeholder?: string
}

/**
 * Product photography slot: keeps the prototype's aspect ratios and degrades to paper.
 * The placeholder sits at `opacity-65` (5.13:1 on paper-2), not the lighter grey the eye wants
 * here — it is real text on a real background, so it is held to AA like any other copy.
 *
 * `ratio="fill"` is the hero's shape, added in Task 6: a band whose height comes from its parent's
 * `min-height` rather than from a ratio, with the featured card sitting on top of the photo. The
 * frame stretches to the parent instead of measuring itself, so that parent has to be positioned —
 * and because an absolutely positioned box is itself the origin for the absolute placeholder
 * inside it, the no-photo branch needs no change to keep working in either mode.
 */
export function ImageFrame({ src, alt, ratio = '4/5', placeholder }: Props) {
  const { t } = useTranslation()
  const fill = ratio === 'fill'
  return (
    <div
      className={`bg-paper-2 overflow-hidden ${fill ? 'absolute inset-0' : 'relative w-full'}`}
      style={fill ? undefined : { aspectRatio: ratio }}
    >
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
