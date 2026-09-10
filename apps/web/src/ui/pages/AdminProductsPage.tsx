import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { ProductsTable, type ProductsTableProps } from '../admin'
import { PillButton } from '../primitives'
import { routes } from '../routes'

/**
 * What just happened to a product, as a CODE and not a sentence. The container that fills it lives
 * outside `src/ui` and `test/copy.test.ts` scans only `src/ui`, so a sentence resolved out there is
 * invisible to the scanner and a missing translation ships as fluent English with nothing red —
 * the trade `LoginCard` and `TrackingInlineForm` already made.
 */
export type ProductDeleteResult = 'deleted' | 'delete-failed'

export interface AdminProductsPageProps {
  products: readonly PublicProduct[]
  lang: 'pt' | 'en'
  /**
   * The list could not be fetched. NOT the same screen as an empty catalogue, and the reason this
   * prop exists at all: handed `[]` on a failed request this page would say "nenhum produto ainda",
   * so a panel that is down and a shop with nothing in it would be pixel-identical. That collapse
   * is exactly what `NoticePage` was written for on the storefront.
   */
  loadFailed?: boolean
  result?: ProductDeleteResult
  /** Wired to the query's own refetch. Omitted where retrying is not on offer. */
  onRetry?(): void
  /** `ProductsTable`'s whole contract minus the two things the page owns. */
  table: Omit<ProductsTableProps, 'products' | 'lang'>
}

const BAND =
  'border-ink px-gutter-admin flex flex-wrap items-end justify-between gap-5 border-b pt-[clamp(26px,4vw,44px)] pb-5'

/**
 * The panel's products screen: the header band, and the table under it.
 *
 * THE BAND IS THE PAGE'S AND THE TABLE IS NOT. `ProductsTable` deliberately brings no heading — its
 * accessible name is a visually hidden `<caption>` — so the `<h1>`, the summary and `+ Novo produto`
 * are here, which is also the only place that knows how many products there are.
 *
 * THE OUTLINE IS ONE HEADING DEEP, so axe's `heading-order` cannot fire on this screen at all: it
 * returns true at index 0 and needs three headings before a jump is expressible. An `<h1>` that
 * became a styled `<div>` would pass every rule in the gate; the story asserts the level directly.
 *
 * THE SUMMARY DROPS THE DESIGN'S THIRD STAT. The prototype computes `5 cadastrados · 4 ativos ·
 * 1 digitais`, and the third is the one number the table already answers per row in its own `Tipo`
 * column while the other two answer questions the table does not. It also drops all three of the
 * design's missing singular branches: `1 digitais` renders as written there, and i18next's plural
 * suffixes are structurally unavailable here — `copy.test.ts` rejects a `_one`/`_other` key because
 * no literal call site names it — so the branch's idiom is two keys and a condition.
 *
 * THE SUMMARY GOES WITH THE TABLE. `0 cadastrados · 0 ativos` over "nenhum produto ainda" is
 * arithmetic about nothing, which is the call `HomePage` made for the empty catalogue.
 *
 * `NoticePage` IS NOT REUSED FOR THE FAILURE, and that is a decision. Its three kinds are shop
 * facts, its body talks about the catalogue, and its way out is `routes.home()` — the storefront,
 * which for a panel nothing links back to (spec:11) is a one-way door. Keeping the band means the
 * nav, `+ Novo produto` and the way back to the orders screen all survive a failed request.
 * `LoadingPage` IS reused, by the container: it carries no heading and no landmark, so it cannot
 * disturb this outline, and waiting says the same thing on both halves of the app. Its one mismatch
 * is `px-gutter` where the panel uses `px-gutter-admin` — 24px at the widest viewport, for as long
 * as one request takes.
 */
export function AdminProductsPage({ products, lang, loadFailed, result, onRetry, table }: AdminProductsPageProps) {
  const { t } = useTranslation()
  const total = products.length
  const active = products.filter((product) => product.active).length
  const registered = total === 1 ? t('1 registered') : t('{{count}} registered', { count: total })
  const inShop = active === 1 ? t('1 active') : t('{{count}} active', { count: active })

  return (
    <>
      <div className={BAND}>
        <div>
          <h1 className="font-display text-[clamp(30px,4vw,48px)] leading-none font-normal">{t('Products')}</h1>
          {/* The design's `.55` measures 3.82:1 on paper against a 4.5:1 floor; 65% is 5.26:1 and
              is where every muted mono label on this branch ended up. */}
          {loadFailed || total === 0 ? null : (
            <p className="font-mono mt-2.5 text-[11px] uppercase tracking-[0.14em] opacity-65">
              {`${registered} · ${inShop}`}
            </p>
          )}
        </div>
        <PillButton href={routes.adminNewProduct()}>
          {/* The design's `+ Novo produto`. The glyph says nothing a reader needs spelled out and
              is a one-character element, which `color-contrast` skips as a suspected icon
              ligature — it is paper on ink at full strength inside the pill for that reason. */}
          <span aria-hidden="true">+</span> {t('New product')}
        </PillButton>
      </div>

      {/*
        ALWAYS RENDERED, EMPTY OR NOT. A live region has to be on the page BEFORE its content
        changes or nothing is announced, and one that mounts already holding its message is the
        version that stays silent — so the result of a delete can only be spoken by a region that
        was here while it was happening. Empty it has no height and no padding.

        A DELETE IS WHERE THIS IS MOST MISSED. The row is gone and so is the button that was
        pressed, which took focus with it; the extract lists aria-live among the things the design
        has nowhere at all. The failure shares the region rather than mounting an alert beside it:
        a refused delete is not more urgent than the delete itself, and an alert inserted with its
        content already in it is the unreliable shape.
      */}
      <p
        role="status"
        className={`font-mono px-gutter-admin pt-4 text-[11px] tracking-[0.04em] empty:pt-0 ${
          result === 'delete-failed' ? 'text-accent' : 'opacity-80'
        }`}
      >
        {result === 'deleted'
          ? t('Product deleted.')
          : result === 'delete-failed'
            ? t('Something broke on my side. Try again in a moment.')
            : ''}
      </p>

      {loadFailed ? (
        <div className="px-gutter-admin flex flex-col items-start gap-6 py-10">
          <p role="alert" className="font-body max-w-[46ch] text-[17px] leading-[1.6] text-pretty opacity-80">
            {t('Something broke on my side. Try again in a moment.')}
          </p>
          {/* A retry that cannot help is worse than no button — `NoticePage` refuses one on a 404
              for that reason. A list that did not arrive is the opposite case: asking again is
              exactly what might work, and it is the only thing this screen can offer. */}
          {onRetry ? (
            <PillButton variant="outline" onClick={onRetry}>
              {t('Try again')}
            </PillButton>
          ) : null}
        </div>
      ) : (
        <ProductsTable products={products} lang={lang} {...table} />
      )}
    </>
  )
}
