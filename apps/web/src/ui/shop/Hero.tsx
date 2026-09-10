import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { Eyebrow, ImageFrame, PillButton } from '../primitives'
import { routes } from '../routes'
import { FeaturedCard } from './FeaturedCard'

export interface HeroProps {
  /** `null` until a product is flagged `featured` in the admin — the API ships the shop that way. */
  featured: PublicProduct | null
  lang: 'pt' | 'en'
}

/**
 * The home hero: a two-cell band, copy on the left, the featured photo on the right.
 *
 * THE DANGLING EDGE, FIXED ON PURPOSE. The prototype puts `border-right:1px solid #1a1713` on the
 * left cell unconditionally, and the two cells are `auto-fit minmax(320px,1fr)`. Below ~640px the
 * grid collapses to one column and that border becomes a 1px rule down the right-hand side of the
 * copy, attached to nothing. The fix here is not a breakpoint — the extract is explicit that the
 * design has no media queries and that its whole responsive behaviour is `auto-fit` plus `clamp()`,
 * and a breakpoint would have to guess the width at which THIS container collapses, which is not
 * the viewport width in Storybook or inside any narrower parent. It is the hairline grid the design
 * already uses for the catalogue, the specs table and the shipping options: `gap-px` over `bg-ink`
 * with each cell painting `bg-paper`. Two columns render an identical 1px rule between them; one
 * column turns it into a 1px rule between the stacked cells, which is what the separator meant in
 * the first place. No rule ever ends in mid-air, at any width, with no query to keep in sync.
 *
 * WITH NO FEATURED PRODUCT, two things go and one stays. The call to action goes: it exists to open
 * a specific product page, and the only other destination on offer is the catalogue directly below
 * it on the same page. The overlay card goes with it, since it names the product. The photo cell
 * stays, holding `ImageFrame`'s paper placeholder — spec:219 already makes that the house answer
 * for a missing photo, and dropping the cell entirely would give the shop a second hero layout to
 * maintain for a state that lasts until someone ticks a checkbox.
 *
 * ALT TEXT comes from the photo's own `alt`, and falls back to `Photo of {{name}}` when the
 * catalogue entry has none — the schema allows an empty string and one fixture has one. This is the
 * planted key's designed use: the hero photo stands alone in its cell, so an empty `alt` would drop
 * the only description of it from the page. `ProductCard` decides the opposite way for the opposite
 * reason; the note there explains why. Task 7 makes the same call for the gallery.
 */
export function Hero({ featured, lang }: HeroProps) {
  const { t } = useTranslation()
  const photo = featured?.photos.at(0)
  return (
    <section className="bg-ink border-ink grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-px border-b">
      <div className="bg-paper flex flex-col justify-between gap-10 p-[clamp(32px,6vw,72px)]">
        <div>
          <Eyebrow className="mb-6">{t('A portfolio disguised as a shop')}</Eyebrow>
          <h1 className="font-display mb-6 text-[clamp(44px,7vw,86px)] leading-[0.98] text-balance">
            {t('Things I')}
            <br />
            <em>{t('make with my hands')}</em>
            {t(', actually for sale.')}
          </h1>
          <p className="max-w-[44ch] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-pretty opacity-80">
            {t(
              'Handwritten letters, drawings, and whatever else I decide to learn. Every purchase goes through Stripe and arrives by post. I am a developer — this site is a piece of the catalogue too.',
            )}
          </p>
        </div>
        <div className="font-mono flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.08em]">
          {featured ? (
            <PillButton href={routes.product(featured.slug)}>{t('See the featured piece')}</PillButton>
          ) : null}
          {/* opacity-65, not the prototype's .55: 12px ink at 55% over paper is 3.83:1. */}
          <span className="opacity-65">{t('Ships anywhere in Brazil')}</span>
        </div>
      </div>
      <div className="bg-paper relative min-h-[min(66vh,540px)]">
        <ImageFrame
          ratio="fill"
          src={photo?.url}
          alt={photo?.alt[lang] || (featured ? t('Photo of {{name}}', { name: featured.name[lang] }) : '')}
        />
        {featured ? <FeaturedCard product={featured} lang={lang} /> : null}
      </div>
    </section>
  )
}
