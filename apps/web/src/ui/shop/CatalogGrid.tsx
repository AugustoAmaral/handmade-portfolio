import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { ProductCard } from './ProductCard'

export interface CatalogGridProps {
  products: readonly PublicProduct[]
  lang: 'pt' | 'en'
}

/**
 * The catalogue band: a labelled row over a hairline grid of cards.
 *
 * `auto-FILL`, not `auto-fit`, and it is the only grid on the branch that is — the extract flags it
 * because the two are one letter apart and look identical until the catalogue is short. With three
 * cards on a wide screen, `auto-fit` collapses the empty tracks and stretches the three across the
 * whole band; `auto-fill` keeps the empty tracks, so the cards stay 240-ish and the row ends where
 * it ends. That is the difference between a shop whose cards resize as stock changes and one whose
 * cards are always the same size. Keep it.
 *
 * THE COUNT IS TWO KEYS. `{{count}} peças` is the prototype's, and it prints "1 peças" the day the
 * catalogue holds one piece — the prototype builds it as `live.length + " peças"` and has the same
 * bug. The obvious fix is i18next's plural suffixes (`_one`/`_other`), and it is not available
 * here: `copy.test.ts` fails any key in `pt.json` that no literal `t('…')` call site accounts for,
 * and a suffixed key is only ever reached through the base key. Two literal keys chosen by a
 * condition are the shape that scanner can see, and they are correct in both languages.
 *
 * THE EMPTY CATALOGUE is designed here; the prototype has no such state. It follows the empty
 * drawer from Task 5: the message and nothing else. The heading stays, because it is the section's
 * name and the page's outline, and the count goes with the grid — "0 peças" over "nothing here yet"
 * is the same arithmetic-about-nothing the drawer's Total row was. An empty `<ul>` is not rendered
 * at all: a list that announces "list, 0 items" is a grid that failed to load, not a shop with
 * nothing in it.
 */
export function CatalogGrid({ products, lang }: CatalogGridProps) {
  const { t } = useTranslation()
  return (
    <section>
      <div className="font-mono px-gutter flex items-baseline justify-between pt-[22px] pb-[14px] text-[11px] uppercase tracking-[0.18em]">
        <h2>{t('The whole catalogue')}</h2>
        {/* opacity-65, not the prototype's .5, which measures 3.30:1 at this size. */}
        {products.length > 0 ? (
          <span className="opacity-65">
            {products.length === 1 ? t('1 piece') : t('{{count}} pieces', { count: products.length })}
          </span>
        ) : null}
      </div>
      {products.length === 0 ? (
        <p className="font-display px-gutter pb-10 text-[26px] leading-[1.2] opacity-60">
          {t('No pieces in the catalogue yet.')}
        </p>
      ) : (
        <ul className="bg-ink border-ink grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-px border-y">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} lang={lang} />
          ))}
        </ul>
      )}
    </section>
  )
}
