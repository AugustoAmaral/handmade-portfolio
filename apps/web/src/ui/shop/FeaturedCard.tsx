import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { Eyebrow, Price } from '../primitives'

export interface FeaturedCardProps {
  product: PublicProduct
  /** The card names a product and prints its price; both need the language the page is in. */
  lang: 'pt' | 'en'
}

/**
 * The card that sits on the bottom-left corner of the hero photo. It carries its own absolute
 * position because that is the only place it exists — the prototype has no second use for it, and
 * a `className` prop for a component with one call site is a seam that has to be maintained
 * without ever being exercised. Its story supplies the positioned box the hero would.
 *
 * It is deliberately NOT a link and NOT a heading:
 * - not a link, because the hero's "Ver a peça em destaque" button already goes there, and two
 *   controls to the same destination is two stops for a screen reader user to sort out. It keeps
 *   the prototype's `pointer-events-none`, so it never eats a click meant for the photo either.
 * - not a heading, because the hero's `<h1>` sits beside it. An `<h2>` here would put a section
 *   label inside a photo caption, and any level below `<h2>` would skip a level outright.
 *
 * The eyebrow is the `Eyebrow` primitive rather than the prototype's inline 10px/`opacity:.6`
 * label: 11px and `opacity-65` instead. The 1px is rounding; the opacity is not — ink at 60% over
 * paper measures 4.48:1 against a 4.5:1 floor for text this size.
 *
 * A product with no subtitle takes the separator with it. `subtitle` is the one localized field
 * the schema lets an admin leave empty, and `R$ 45,00 · ` with nothing after it is the kind of
 * detail that ships because no catalogue entry happened to be missing one on the day.
 */
export function FeaturedCard({ product, lang }: FeaturedCardProps) {
  const { t } = useTranslation()
  const subtitle = product.subtitle[lang]
  return (
    <div className="border-ink bg-paper pointer-events-none absolute bottom-[clamp(16px,3vw,28px)] left-[clamp(16px,3vw,28px)] max-w-[min(300px,72%)] border px-5 py-4">
      <Eyebrow>{t('Featured')}</Eyebrow>
      <div className="font-display mt-1.5 text-[26px] leading-[1.1]">{product.name[lang]}</div>
      <div className="font-mono mt-2 text-xs">
        <Price cents={product.priceCents} lang={lang} />
        {subtitle ? ` · ${subtitle}` : ''}
      </div>
    </div>
  )
}
