import { type AdminOrder, formatOrderNumber } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { Price, StatusPill } from '../primitives'
import { routes } from '../routes'

export interface OrdersListProps {
  orders: readonly AdminOrder[]
  /** The `?order=` in the URL. Nothing is selected on a first visit to the screen. */
  selectedId?: string
  lang: 'pt' | 'en'
}

/**
 * THE PANEL SHOWS THE SHOP'S DAY, NOT THE READER'S. `createdAt`, `paidAt` and `shippedAt` are ISO
 * instants, so an unpinned formatter prints a different calendar day depending on where the browser
 * is — an order placed at 21:15 in Belo Horizonte would read as the next morning from Lisbon, and
 * "05 set" would mean two different things on two machines. Everything this panel dates happened in
 * one place, so it is dated there.
 *
 * It belongs beside `formatPrice` in `@shop/shared`, which is the same kind of fact about the same
 * shop, and it is here only because this task may not change that package. Sweep item.
 */
export const SHOP_TIME_ZONE = 'America/Sao_Paulo'

/**
 * The design's `DD mmm YYYY` — `05 set 2026`, lowercase, no trailing period — in both languages.
 *
 * COMPOSED PART BY PART rather than handed to a single format string, because no locale produces
 * this shape: `pt-BR` writes `05 de set. de 2026` and `en-US` puts the month first. The only thing
 * the language decides is the abbreviation itself, and pt-BR's carries a period the design does not
 * have.
 */
export function formatOrderDate(iso: string, lang: 'pt' | 'en'): string {
  const parts = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: SHOP_TIME_ZONE,
  }).formatToParts(new Date(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('day')} ${value('month').replace('.', '')} ${value('year')}`
}

/** Pieces, not lines: two of one drawing is two items on one row. */
export function pieceCount(order: AdminOrder): number {
  return order.items.reduce((total, item) => total + item.qty, 0)
}

const FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent'

const ROW = `border-ink/20 flex flex-col gap-2 border-b px-[clamp(16px,4vw,32px)] py-[18px] ${FOCUS}`

/**
 * The selected row, in the two halves a state needs. `aria-current` is the announced half and this
 * is the seen one.
 *
 * AN INSET SHADOW AND NOT A BORDER, which `ProductGallery` settled for the selected thumb and which
 * applies here for the same two reasons: a shadow occupies no space, so nothing moves by a pixel
 * when the selection changes and no other row needs a transparent border to compensate; and it
 * leaves `outline` free, which is the focus indicator on every control of this branch and would
 * otherwise be hidden on the row most likely to have focus.
 *
 * SPELLED AS AN ARBITRARY PROPERTY rather than `shadow-[…]` so the computed value is exactly one
 * shadow. The utility composes five variables into `box-shadow`, and the four empty ones serialise
 * as transparent shadows the story would then have to pick its way through to measure the bar.
 *
 * The tint is `paper-3` — the design's own held surface, its outline-pill hover — and it cannot
 * carry the state alone: it is 1.17:1 against paper, where SC 1.4.11 asks 3:1 of a graphical
 * object. The bar is the indicator and measures 15.69:1; the tint is what makes the row read as
 * held at a glance. Both are gone under forced colors, where a background is flattened and a shadow
 * is dropped — `aria-current` is what survives there, which is the other half of why it is on.
 */
const SELECTED = 'bg-paper-3 [box-shadow:inset_3px_0_0_var(--color-ink)]'

/**
 * The orders list: the left column of the admin's orders screen, one row per order, each a link to
 * that order's own URL.
 *
 * EVERY ROW IS AN `<a href>`, NOT A `<div onClick>`. The selection lives in `?order=` (spec:195),
 * so a row is a destination rather than an event: middle-click, open-in-new-tab and copy-link all
 * work, the browser gives the keyboard behaviour away, and the app root upgrades the same-origin
 * click to client-side routing.
 *
 * THE COLUMN DRAWS NO RIGHT EDGE. The prototype puts `border-right:1px solid #1a1713` here
 * unconditionally, over an `auto-fit` grid that collapses to one column at 640px — the dangling
 * rule both shop heroes had. PR 3 fixed those with the hairline grid rather than a media query,
 * because the design has none and a breakpoint would have to guess the width at which THIS
 * container collapses, which is not the viewport's. So the separator belongs to the page that puts
 * this column beside the detail (Task 7): two cells of a `gap-px` grid over `bg-ink`, each painting
 * its own paper. This component paints that paper and no edge.
 *
 * THE STATUS IS A `StatusPill` AND THE DESIGN'S PLAIN TEXT IS NOT TRANSCRIBED. Two reasons, and the
 * second is the one that would have bitten later: the design shows three of the five statuses and
 * never draws `oversold` or `expired`, which as 11px muted text would be indistinguishable from
 * `Despachado` — the pill already carries a tone per state, including a DASHED border so `expired`
 * and `pending` differ by more than an opacity. And `STATUS_LABELS` is the single home of that
 * wording, reached through the one runtime-built `t()` call `copy.test.ts` allows in `src/ui`; a
 * second one here would redden that count.
 *
 * THE HEADER BAND IS NOT HERE. `Pedidos`, the `4 pedidos · 2 em aberto` summary and any filter
 * belong to the page, which owns the `<h1>` — the same cut `ProductsTable` made.
 */
export function OrdersList({ orders, selectedId, lang }: OrdersListProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-paper">
      {orders.length === 0 ? (
        // No list at all rather than an empty one, following the empty catalogue. There is no call
        // to action with it either: orders arrive from the shop, so there is nothing anyone can do
        // from this screen to make one appear.
        <p className="font-display px-[clamp(16px,4vw,32px)] py-10 text-[26px] leading-[1.2] opacity-65">
          {t('No orders yet.')}
        </p>
      ) : (
        <ul aria-label={t('Orders')}>
          {orders.map((order) => {
            const selected = order.id === selectedId
            const pieces = pieceCount(order)
            return (
              <li key={order.id}>
                <a
                  href={routes.adminOrders(order.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`${ROW} ${selected ? SELECTED : 'hover:bg-paper-2'}`}
                >
                  {/* THE OPACITY IS ON THE WORDS, NEVER ON THE ROW. The whole row is a link here,
                      and `opacity` composites a subtree as one group — a muted class on the anchor
                      would dim the customer's name, the total and the status pill with it, and a
                      child's `opacity:1` cancels nothing. The prototype's `.6` is 4.47:1 on paper
                      and 4.38:1 over the hover tint, both under AA; 65% is 5.26:1 and 5.13:1. */}
                  <span className="font-mono flex justify-between gap-3.5 text-[11px] uppercase tracking-[0.12em] opacity-65">
                    <span>{formatOrderNumber(order.orderNumber)}</span>
                    <span>{formatOrderDate(order.createdAt, lang)}</span>
                  </span>

                  <span className="flex items-baseline justify-between gap-3.5">
                    <span className="font-display text-[22px] leading-[1.15]">{order.buyer.name}</span>
                    <Price cents={order.amounts.totalCents} lang={lang} className="text-sm" />
                  </span>

                  <span className="flex flex-wrap items-center gap-2.5">
                    {/* Two literal keys and a condition, not a plural suffix. `copy.test.ts` fails
                        on a `_one`/`_other` key because no literal call site names it, and the
                        prototype's own `total + " itens"` prints `1 itens` for a single piece. */}
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] opacity-65">
                      {pieces === 1 ? t('1 item') : t('{{count}} items', { count: pieces })}
                    </span>
                    <StatusPill status={order.status} />
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
