import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { ImageFrame, Price } from '../primitives'
import { routes } from '../routes'

export interface ProductCardProps {
  product: PublicProduct
  lang: 'pt' | 'en'
}

/**
 * One cell of the catalogue grid: an `<li>` wrapping a single `<a>` that covers the whole card,
 * like `CartLine` is the drawer's `<li>`. The prototype is a `<div onClick>` — not focusable, not
 * announced, no destination to copy, middle-click dead. The whole card is the link rather than the
 * name alone because the picture and the price are part of the same target in the design, and a
 * 240px card with a 24px hit area is a worse answer than a slightly long accessible name.
 *
 * THE PHOTO IS DECORATIVE HERE — `alt=""`, deliberately, even when the catalogue entry carries alt
 * text. The image sits inside a link whose own text already reads the product's name, subtitle,
 * price and availability; giving the photo a name as well makes the link announce the piece twice
 * (W3C's technique for a functional image next to its own text says the same). `Hero` goes the
 * other way and the note there says why: its photo is not inside a link and has no text of its own.
 * A product with no photos falls through to `ImageFrame`'s paper placeholder, whose visible label
 * does join the link name — that is a real cost, and it is smaller than a broken image or a card
 * with a hole in it.
 *
 * AVAILABILITY IS TEXT, not a colour and not a position, and it is the one thing on this card the
 * design does not have: the prototype's cards are name, subtitle and price. Sold out is the state
 * that has to survive being read aloud, so the card states all four rather than styling the one.
 * The order of the branches is the interesting part — `stock === 0` is checked BEFORE `digital`,
 * because a digital item whose stock ran to zero is sold out and saying "delivered by e-mail" over
 * a piece nobody can buy is worse than saying nothing. `stock === null` means made to order, per
 * spec:53, and only then does a number mean a count. The digital wording is spec:221's, which
 * overrides the prototype's `download imediato`: there is no automatic download.
 *
 * The meta and availability lines sit at `opacity-65`, not the prototype's `.55` (3.83:1 at 11px).
 */
export function ProductCard({ product, lang }: ProductCardProps) {
  const { t } = useTranslation()
  const availability =
    product.stock === 0
      ? t('Sold out')
      : product.type === 'digital'
        ? t('Delivered by e-mail')
        : product.stock === null
          ? t('Made to order')
          : t('{{count}} in stock', { count: product.stock })
  return (
    <li className="bg-paper flex flex-col">
      <a
        href={routes.product(product.slug)}
        className="hover:bg-paper-2 flex flex-1 flex-col gap-[14px] px-[18px] pt-[18px] pb-[22px] transition-colors"
      >
        <ImageFrame src={product.photos.at(0)?.url} alt="" ratio="4/5" />
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-2xl leading-[1.15]">{product.name[lang]}</div>
            <div className="font-mono mt-1.5 text-[11px] uppercase tracking-[0.12em] opacity-65">
              {product.subtitle[lang]}
            </div>
          </div>
          <div className="text-right">
            <Price cents={product.priceCents} lang={lang} className="text-sm" />
            <div className="font-mono mt-1.5 text-[11px] uppercase tracking-[0.12em] opacity-65">{availability}</div>
          </div>
        </div>
      </a>
    </li>
  )
}
