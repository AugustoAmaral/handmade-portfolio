import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { Price } from '../primitives'
import { routes } from '../routes'

export interface ProductRowProps {
  product: PublicProduct
  lang: 'pt' | 'en'
  /**
   * This row's `Apagar` has been pressed once and is waiting for the second press. The value
   * itself is held by the container (PR 4 Task 8); this layer only draws the two shapes.
   */
  confirmingDelete?: boolean
  onToggleActive(product: PublicProduct): void
  onAskDelete(product: PublicProduct): void
  onCancelDelete(): void
  onConfirmDelete(product: PublicProduct): void
}

/**
 * The column template, exported because `ProductsTable`'s header row has to line up with it and a
 * second copy of five track sizes is exactly the drift the branch already paid for once.
 *
 * FIVE COLUMNS, NOT THE PROTOTYPE'S SIX. `Idiomas` is dropped (spec:221): it is the design's only
 * use of accent as a status colour, and the state it reports — a product missing one language — is
 * unreachable, because `localizedTextSchema` requires `pt` and `en` at `.min(1)`. A column that can
 * only ever say `PT ✓ EN ✓` is a column that says nothing.
 *
 * Its width comes back to `Situação`, which needs it: the delete confirmation puts three controls
 * in that cell where the design has two. Every other track keeps the prototype's number, so the
 * horizontal-scroll floor drops from the prototype's 900px by exactly the dropped track and its
 * gap (150 + 16) — see `MIN_TABLE_WIDTH` in ProductsTable.
 */
export const ROW_GRID =
  'px-gutter-admin grid grid-cols-[minmax(220px,2fr)_110px_90px_120px_minmax(130px,1fr)] items-center gap-4'

/**
 * Accent on paper is 5.58:1, over the 3:1 a focus indicator needs — the shop's ring, and the right
 * one here, unlike inside the dark bar where the same accent measures 2.81:1 and had to become
 * paper.
 *
 * `outline-offset-2` IS LOAD-BEARING ON THE ACTIVE CHIP AND NOT COSMETIC. That chip paints its own
 * `bg-ink`, so a ring drawn at offset 0 would be adjacent to ink on the inside — 2.81:1 again, the
 * dark-bar failure in the middle of a paper screen. Held 2px clear of the border box the ring has
 * paper on both sides. `ProductsTable.stories.tsx` measures it, because axe has no rule for
 * non-text contrast at all and nothing else would notice.
 */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const CHIP = `font-mono text-[10px] uppercase tracking-[0.12em] ${FOCUS}`
/**
 * The two chips differ by 1px of padding (12/5 filled, 11/4 outlined) so the 1px border keeps the
 * outer box identical and the row does not jitter when it is toggled. That compensation is the
 * prototype's and it is deliberate.
 *
 * The outlined chip is `opacity-70` and not the prototype's `.6`: ink at 60% over paper measures
 * 4.47:1, failing AA by 0.03, and 70% measures 6.21:1. `StatusPill`'s `pending` tone already made
 * this exact correction and this is the same shape, one role short of being the same component —
 * see the note on `ProductsTable` about why it is not reused.
 *
 * The border composites to 1.85:1 and stays there, which is under SC 1.4.11's 3:1 for a graphical
 * object. It is exempt rather than broken: the chip says `Inativo` in words inside itself and
 * carries `aria-checked`, so the outline is the third telling of a thing already told twice. The
 * on/off difference is filled-versus-outlined AND a different word — never colour alone.
 */
const CHIP_ACTIVE = `${CHIP} bg-ink text-paper px-3 py-[5px]`
const CHIP_INACTIVE = `${CHIP} border-ink/40 border px-[11px] py-1 opacity-70`

const ACTION = `text-[11px] uppercase tracking-[0.06em] ${FOCUS}`

/**
 * One product, one `<tr>`. The grid lives on the row, so `<table>`, `<thead>` and `<tbody>` are
 * `display:block` in `ProductsTable` and every table element carries its ARIA role explicitly —
 * the note there says why.
 *
 * THE NAME IS THE ROW HEADER AND IS NOT A LINK. The prototype makes it a third hit target that
 * opens the same editor as `Editar`, which is 20 tab stops for five rows and two names for one
 * destination. As `<th scope="row">` it does a job no link could: it is what a screen reader reads
 * when it moves between cells, and it is the text every control in this row borrows to say WHICH
 * product it acts on. Three tab stops per row instead of four.
 *
 * EVERY CONTROL IS NAMED AFTER ITS ROW, THROUGH `aria-labelledby` AND NOT `aria-label`. Five
 * buttons called `Apagar` are unnavigable, and a table with a row header only helps a reader
 * moving cell by cell — tabbing announces the control and nothing else. Pairing the control's own
 * visible word with the row header's id gives `Apagar Carta escrita à mão` with no new copy key,
 * in whatever language the panel is in, and it satisfies SC 2.5.3 by construction: the visible
 * text is literally the first half of the accessible name. The visible word is wrapped in its own
 * `<span id>` rather than referenced through the control's own id, because a self-referencing
 * `aria-labelledby` is legal but depends on how each name computation implements the recursion
 * guard, and there is nothing to gain by finding out.
 *
 * THE SITUAÇÃO CHIP IS A `role="switch"`, NOT A LINK AND NOT A LABEL. It changes the product; it
 * navigates nowhere. `aria-checked` carries the state machine-readably so it survives a reader who
 * cannot see that filled means on, and the visible word carries it for everyone else.
 */
export function ProductRow({
  product,
  lang,
  confirmingDelete = false,
  onToggleActive,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: ProductRowProps) {
  const { t } = useTranslation()

  // Derived from the product's own id, which is unique in the table by definition and stable
  // across a language switch. No generated id is needed and none would be more stable.
  const base = `admin-product-${product.id}`
  const nameId = `${base}-name`
  const stateId = `${base}-state`
  const editId = `${base}-edit`
  const deleteId = `${base}-delete`
  const confirmId = `${base}-confirm`
  const cancelId = `${base}-cancel`
  const questionId = `${base}-question`

  // The other language's name, not the prototype's hardcoded English one. The panel has no toggle
  // of its own and renders in whatever language the shop was left in, so `nameEn` under a
  // Portuguese name is right half the time and prints the same string twice the other half. There
  // is no `— sem versão EN —` fallback either: both languages are required by the schema, so the
  // empty case the prototype draws cannot arrive.
  const otherName = product.name[lang === 'pt' ? 'en' : 'pt']

  return (
    <tr role="row" className={`${ROW_GRID} border-ink/20 border-b py-[18px] font-mono text-[13px]`}>
      <th role="rowheader" scope="row" className="min-w-0 text-left font-normal">
        <span id={nameId} className="font-display block text-[22px] leading-[1.15]">
          {product.name[lang]}
        </span>
        {/* opacity-65 (5.26:1 measured), not the prototype's .5 — axe scores that 3.27:1 and fails it. */}
        <span className="mt-1 block text-[11px] opacity-65">
          {otherName} · {product.slug}
        </span>
      </th>

      <td role="cell">
        <Price cents={product.priceCents} lang={lang} />
      </td>

      {/*
        `stock === null` means NO LIMIT, and what no limit means depends on what is being sold: a
        physical piece with no stock number is made to order, a digital one is simply unlimited.
        A constant name here would have the panel read "sob encomenda" on a PDF. The prototype
        prints `∞` for `type === "digital"` instead, which is a different rule that happens to look
        the same on its own seed — it would print 999 for a digital product that has stock.

        The glyph is `aria-hidden` and the sentence is the thing that gets read. `color-contrast`
        skips single-character text as a suspected icon ligature, so nothing in the gate is looking
        at this cell; it is full-opacity ink on paper at 15.69:1 for that reason. `--font-mono`
        already names `ui-monospace` and `monospace` after IBM Plex, so a failed webfont still has
        a face that covers U+221E.
      */}
      <td role="cell">
        {product.stock === null ? (
          <>
            <span aria-hidden="true">∞</span>
            <span className="sr-only">{product.type === 'digital' ? t('Unlimited') : t('Made to order')}</span>
          </>
        ) : (
          product.stock
        )}
      </td>

      <td role="cell" className="text-[11px] uppercase tracking-[0.08em] opacity-70">
        {/* Two literal calls and not one key built from `product.type`: the copy scan reads keys
            out of literal call sites and pins the number of runtime-built ones at exactly one,
            which `StatusPill` already spends. `OrderSummaryPanel` makes the same pair for the same
            reason, on the same two keys.

            Writing that rule out with the call spelled literally is what reddened the scan the
            first time: its comment stripper drops whole-line `//` and `*` comments, and the lines
            of a JSX comment start with neither — so prose in one is read as code. The shared
            constraints hand this hazard to `ui-boundaries.test.ts` alone; it belongs to both. */}
        {product.type === 'digital' ? t('digital') : t('physical')}
      </td>

      <td role="cell" className="flex flex-col items-start gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={product.active}
          aria-labelledby={`${nameId} ${stateId}`}
          onClick={() => onToggleActive(product)}
          className={product.active ? CHIP_ACTIVE : CHIP_INACTIVE}
        >
          <span id={stateId}>{product.active ? t('Active') : t('Inactive')}</span>
        </button>

        {/*
          A FIXED CHILD SLOT, so this question can appear above the actions without remounting
          them. It is not a live region: focus moves to the confirmation as it mounts and the
          confirmation is `aria-describedby` this text, so it is announced once with the control
          it belongs to instead of twice by two mechanisms.
        */}
        {confirmingDelete ? (
          <p id={questionId} className="text-accent text-[11px] uppercase tracking-[0.06em]">
            {t('Delete for good?')}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={routes.adminProduct(product.id)}
            aria-labelledby={`${editId} ${nameId}`}
            className={`border-ink border-b ${ACTION}`}
          >
            <span id={editId}>{t('Edit')}</span>
          </a>

          {/*
            HOW A DESTRUCTIVE ACTION IS CONFIRMED ON THIS BRANCH, decided here because the design
            draws nothing: an inline two-step in the row itself.

            NOT A MODAL. A dialog has to trap focus, remember what to give focus back to and close
            on Escape, and every one of those is a browser API this layer is forbidden to touch —
            the whole mechanism would have to live in the container and reach back in. It would
            also re-state which product it is about, when the product's name is already on this
            line.

            NOT AN UNDO WINDOW. Undo means not sending the DELETE yet, which means an intent held
            in memory that a navigation drops without telling anyone. `DELETE /api/admin/products/
            :id` answers 204 and there is nothing to put back.

            `autoFocus` and not reconciliation. Replacing `Apagar` with the pair below would leave
            focus on the body of the page for anyone who got here with a keyboard; keeping the
            same element and changing its word would hold focus but announce nothing. Moving focus
            to the confirmation is the one shape that does both, and it needs no state and no
            handle on the node — React does it as the element mounts.
          */}
          {confirmingDelete ? (
            <>
              <button
                type="button"
                autoFocus
                aria-labelledby={`${confirmId} ${nameId}`}
                aria-describedby={questionId}
                onClick={() => onConfirmDelete(product)}
                className={`border-accent text-accent border-b ${ACTION}`}
              >
                <span id={confirmId}>{t('Yes, delete')}</span>
              </button>
              <button
                type="button"
                aria-labelledby={`${cancelId} ${nameId}`}
                onClick={onCancelDelete}
                className={ACTION}
              >
                <span id={cancelId}>{t('Cancel')}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-labelledby={`${deleteId} ${nameId}`}
              onClick={() => onAskDelete(product)}
              className={`text-accent ${ACTION}`}
            >
              <span id={deleteId}>{t('Delete')}</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
