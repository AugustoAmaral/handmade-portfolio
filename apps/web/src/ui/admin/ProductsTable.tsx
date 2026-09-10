import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { ROW_GRID, ProductRow } from './ProductRow'

export interface ProductsTableProps {
  products: readonly PublicProduct[]
  lang: 'pt' | 'en'
  /**
   * The id of the product whose `Apagar` is waiting for its second press, or nothing. One at a
   * time, so this is an id and not a set: a panel with two half-finished deletions open is a panel
   * that is about to delete the wrong one.
   */
  confirmingDeleteId?: string
  onToggleActive(product: PublicProduct): void
  onAskDelete(product: PublicProduct): void
  onCancelDelete(): void
  onConfirmDelete(product: PublicProduct): void
}

/**
 * The prototype's floor is 900px, which is exactly its six minimum tracks plus its five gaps
 * (220 + 150 + 110 + 90 + 120 + 130 + 5 × 16). Dropping `Idiomas` drops its track and one gap.
 */
const MIN_TABLE_WIDTH = 'min-w-[734px]'

/**
 * The products table: five columns over a horizontal scroller, and the one screen in the panel
 * that is a table rather than a list.
 *
 * A REAL `<table>`, WHICH THE PROTOTYPE IS NOT. Six unlabelled `<div>`s in a CSS grid announce as
 * six unlabelled divs — no column headers, no row headers, no way to move by cell, and nothing in
 * the a11y gate to complain, because a grid of divs is not a broken table, it is no table.
 *
 * WITH EXPLICIT ROLES ON TOP OF THE ELEMENTS, AND THAT IS NOT BELT-AND-BRACES. The design's layout
 * is a grid template, so the rows carry `display:grid` and the levels above them carry
 * `display:block` to stay out of the way — and a table element whose `display` is neither `table`
 * nor `table-*` has historically lost its implicit role in Blink and WebKit. `role="table"`,
 * `rowgroup`, `row`, `columnheader`, `rowheader` and `cell` restore it in the browsers that drop
 * it and are inert in the ones that do not. Nothing in this repo can prove which case we are in:
 * `getByRole` resolves roles from tag names, not from the browser's accessibility tree, so it
 * stays green either way — this is one more thing guarded by a decision rather than by a test.
 *
 * THE HEADER BAND IS NOT HERE. `Produtos`, the `5 cadastrados · 4 ativos` summary and
 * `+ Novo produto` belong to the page (Task 7), which owns the `<h1>` and the heading outline.
 *
 * `RuledList`/`RuledRow` are NOT reused here, and the plan asks the question directly. They render
 * `<div>`s over a 1px ink grid gap, which is the orders list's shape (Task 6) and not this one:
 * these rows are `<tr>`s under a single hairline, and wrapping table semantics in a div primitive
 * would trade the whole point of this component for the reuse of nine class names.
 */
export function ProductsTable({
  products,
  lang,
  confirmingDeleteId,
  onToggleActive,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: ProductsTableProps) {
  const { t } = useTranslation()

  // No `<table>` at all when there is nothing in it, following the empty catalogue: a table that
  // announces its five columns and no rows reads as a grid that failed to load. The route back is
  // `+ Novo produto` in the band above, which is the page's control, so this says what is true and
  // does not point at a button it does not own.
  if (products.length === 0) {
    return (
      <p className="font-display px-gutter-admin py-10 text-[26px] leading-[1.2] opacity-65">{t('No products yet.')}</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      {/* THE ROLES BELOW ARE A DECISION, NOT A MEASUREMENT, and nothing in this repo can turn them
          into one. They are here because the rows carry `display:grid` and the levels above them
          carry `display:block`, and a table element whose `display` is not `table` or `table-*`
          has historically lost its implicit role in Blink and WebKit.

          Whether Chromium still strips it TODAY is unverified. `getByRole` resolves roles from tag
          names through the HTML-AAM mapping, and so does axe — neither reads the browser's own
          accessibility tree — so deleting every `role` attribute in this file and in `ProductRow`
          reddens nothing at all. A green suite is not evidence that they are unnecessary, and
          removing them on that basis would be reading the gate backwards. Anyone who wants to drop
          them needs a screen reader or a platform AX dump, not a test run. */}
      <table role="table" className={`block w-full ${MIN_TABLE_WIDTH}`}>
        {/* The table's accessible name. Visually hidden because the page's `<h1>` already says
            `Produtos` right above it and a second one on the screen is noise; a table with no name
            at all is the thing being avoided. */}
        <caption className="sr-only">{t('Products')}</caption>
        <thead role="rowgroup" className="block">
          {/* opacity-65 (5.26:1 measured), not the prototype's .5 — axe scores that 3.27:1 and
              fails it, and these are 10px, the smallest text on the screen. */}
          <tr
            role="row"
            className={`${ROW_GRID} border-ink border-b py-3 font-mono text-[10px] uppercase tracking-[0.16em] opacity-65`}
          >
            <th role="columnheader" scope="col" className="text-left font-normal">
              {t('Product')}
            </th>
            <th role="columnheader" scope="col" className="text-left font-normal">
              {t('Price')}
            </th>
            <th role="columnheader" scope="col" className="text-left font-normal">
              {t('Stock')}
            </th>
            <th role="columnheader" scope="col" className="text-left font-normal">
              {t('Type')}
            </th>
            <th role="columnheader" scope="col" className="text-left font-normal">
              {t('Status')}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="block">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              lang={lang}
              confirmingDelete={product.id === confirmingDeleteId}
              onToggleActive={onToggleActive}
              onAskDelete={onAskDelete}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={onConfirmDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
