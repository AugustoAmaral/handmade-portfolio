import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { Eyebrow, PillButton, Price } from '../primitives'
import { CatalogBackBar, ProductGallery, SpecsTable, useAvailabilityLabel } from '../shop'

export interface ProductPageProps {
  product: PublicProduct
  lang: 'pt' | 'en'
  /** Index into `product.photos`; the gallery degrades to the placeholder for an index it has no
   *  photo for, and Task 11 decides whether the container resets or clamps it across products. */
  selectedPhoto: number
  onSelectPhoto(index: number): void
  onAddToCart(slug: string): void
}

/**
 * One piece: the gallery on the left, everything you need to buy it on the right.
 *
 * THE BAND IS A HAIRLINE GRID, for the third time on this branch and for the same reason both
 * heroes are. The prototype puts `border-right` on the gallery cell over an `auto-fit` grid, so
 * the rule is left hanging in mid-air the moment the band collapses to one column. `gap-px` over
 * `bg-ink` renders the identical rule between two columns and turns it into a rule between two
 * stacked cells at one, with no media query to keep in sync. The gallery paints `bg-paper-2` and
 * the buying column `bg-paper`, which is the design's lighter-card-on-darker-panel and also what
 * keeps the ink from showing anywhere but the 1px gap.
 *
 * ADD TO BAG IS A `<button>`, not a link: it changes the cart on this page and navigates nowhere.
 * That is the split `ShopHeader` already makes between `Sobre` and the bag, and it is why this
 * page takes a callback where every other destination on it is an `<a href>`.
 *
 * SOLD OUT DISABLES IT, and the label beside it says why. The prototype has no such state — its
 * CTA is live over every product — and a live "Colocar na sacola" on a piece with `stock: 0` puts
 * a line in the bag that `checkoutRules` and then the API will refuse, several screens later. The
 * pairing is the one `CartLine` settled on for the quantity cap: a control that stops responding
 * owes the reader a sentence, and the availability label is already that sentence, so nothing new
 * is invented here. It is the same `useAvailabilityLabel` the catalogue card prints, which is what
 * keeps the card and the page from disagreeing about whether a piece can be bought.
 *
 * THE SUBTITLE IS AN `Eyebrow`, NOT A HEADING. It sits above the `<h1>` in the design and reads as
 * a label; promoting it would put a heading before the page's only `<h1>` and make the outline
 * start in the middle. The `<h1>` is the piece's name, which is the one thing this page is about.
 *
 * THE FOOTER NOTE stays at the prototype's `.75` and the availability label moves to `opacity-65`
 * from `.55`: 16px ink at 75% is 7.36:1, 12px at 55% is 3.83:1 against a 4.5:1 floor, and 65% is
 * 5.26:1. Same three numbers this branch has now measured six times.
 */
export function ProductPage({ product, lang, selectedPhoto, onSelectPhoto, onAddToCart }: ProductPageProps) {
  const { t } = useTranslation()
  const availabilityOf = useAvailabilityLabel()
  const soldOut = product.stock === 0
  return (
    <>
      <CatalogBackBar />
      <div className="bg-ink border-ink grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-px border-b">
        <ProductGallery product={product} lang={lang} selectedPhoto={selectedPhoto} onSelectPhoto={onSelectPhoto} />
        <div className="bg-paper flex flex-col gap-7 p-[clamp(28px,5vw,64px)]">
          <div>
            <Eyebrow>{product.subtitle[lang]}</Eyebrow>
            <h1 className="font-display mt-3.5 mb-[18px] text-[clamp(36px,5vw,60px)] leading-[1.02] text-balance">
              {product.name[lang]}
            </h1>
            <Price cents={product.priceCents} lang={lang} className="text-[18px]" />
          </div>
          <p className="max-w-[46ch] text-[18px] leading-[1.6] text-pretty opacity-85">{product.description[lang]}</p>
          <SpecsTable specs={product.specs} lang={lang} />
          <div className="font-mono flex flex-wrap items-center gap-[14px] text-xs uppercase tracking-[0.08em]">
            <PillButton disabled={soldOut} onClick={() => onAddToCart(product.slug)}>
              {t('Add to bag')}
            </PillButton>
            <span className="opacity-65">{availabilityOf(product)}</span>
          </div>
          <p className="border-ink/25 max-w-[44ch] border-t pt-5 text-[16px] leading-[1.55] text-pretty opacity-75">
            {t('Written, packed and posted by me, within 5 business days. Payment processed by Stripe.')}
          </p>
        </div>
      </div>
    </>
  )
}
