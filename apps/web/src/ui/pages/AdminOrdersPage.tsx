import { type AdminOrder, type AdminOrderFilter, ORDER_STATUSES, type OrderStatus, canTransition } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { OrderDetail, type OrderDetailProps, OrdersList } from '../admin'
import { FieldLabel, PillButton, STATUS_LABELS, Select } from '../primitives'

/**
 * The `<option>` value standing for "send no `status` at all". It cannot be the empty string: the
 * API parses `status` with `z.enum([...]).optional()`, so `?status=` is a 400 rather than a default,
 * and an empty option value is exactly the shape a careless container would forward.
 */
const NO_FILTER = 'default'

export interface AdminOrdersPageProps {
  orders: readonly AdminOrder[]
  /** The `?order=` in the URL (spec:195). Unknown or absent is the ordinary first-load case. */
  selectedId?: string
  lang: 'pt' | 'en'
  filter?: AdminOrderFilter
  /**
   * The list could not be fetched. NOT the same screen as a shop with no orders: handed `[]` on a
   * failed request this page would say "nenhum pedido ainda", which is the collapse `NoticePage`
   * was written to fix on the storefront.
   */
  loadFailed?: boolean
  onFilterChange(filter: AdminOrderFilter | undefined): void
  /** Wired to the query's own refetch. */
  onRetry?(): void
  /** `OrderDetail`'s whole contract minus the two things the page owns. */
  dispatch: Omit<OrderDetailProps, 'order' | 'lang'>
}

/** `NO_FILTER` and anything unrecognised mean absent; nothing is coerced into a status. */
function filterFromOption(value: string): AdminOrderFilter | undefined {
  if (value === 'all') return 'all'
  return ORDER_STATUSES.find((status) => status === value)
}

const BAND =
  'border-ink px-gutter-admin flex flex-wrap items-end justify-between gap-5 border-b pt-[clamp(26px,4vw,44px)] pb-5'

const NOTHING = 'font-display px-gutter-admin py-10 text-[26px] leading-[1.2] opacity-65'

const FILTER_ID = 'admin-orders-filter'

/**
 * The panel's orders screen: the header band, the filter, and the list beside the detail.
 *
 * THE TWO-COLUMN HAIRLINE IS THIS PAGE'S. The prototype gives the list column an unconditional
 * `border-right`, over an `auto-fit` grid that collapses to one column at 640px — the dangling edge
 * both shop heroes had, which PR 3 fixed with a hairline grid rather than a media query, because
 * the design has no breakpoints and the width at which THIS container collapses is not the
 * viewport's. So Task 6 shipped a column that paints paper and no edge, and the rule is made here:
 * two cells of a `gap-px` grid over `bg-ink`, each painting its own opaque ground. The cells must
 * STRETCH — a start-aligned cell stops painting where its content ends and lets the ink through,
 * which is the trap `CheckoutPage` documents for the same construction.
 *
 * "NOTHING SELECTED" IS THIS PAGE'S TOO. `OrderDetail` requires an order and `OrdersList` owns the
 * empty list, so neither could draw it. The prototype has no defence at all: it binds to
 * `ORDERS[s.order] || ORDERS[0]` and dereferences `.code` on `undefined`. Selection lives in
 * `?order=`, so an id that matches nothing — a stale link, an order the filter has just hidden — is
 * ordinary rather than exceptional.
 *
 * THE ORDER IS LOOKED UP ONCE, HERE, AND THE LIST IS HANDED WHAT WAS FOUND. Today that is the same
 * value as the id it was given — an id matching nothing marks nothing either way — so this is a
 * statement of intent rather than a fix. What it rules out is the shape that would need one: a
 * container resolving the selected order separately from the list's own highlight, or a fallback
 * like the prototype's `ORDERS[s.order] || ORDERS[0]`, either of which puts one order's contents
 * beside another order's mark.
 *
 * THE FILTER IS THE API'S THREE MODES AND NOT THE TWO A CONTROL SUGGESTS. `all` is no filter, a
 * named status is that status, and NOTHING is the API's own default of everything except `expired`.
 * A control that could only express the first two would silently lose the mode the panel opens in.
 *
 * A `<select>` AND NOT LINKS, unlike the row selection beside it. Putting the filter in the URL
 * would make every row link carry it forward — otherwise opening an order resets it — and would
 * grow a second parameter in `routes.adminOrders`. The trade is that the filter is not shareable
 * and not in the history, where the selected order, the thing worth linking to, still is.
 */
export function AdminOrdersPage({
  orders,
  selectedId,
  lang,
  filter,
  loadFailed,
  onFilterChange,
  onRetry,
  dispatch,
}: AdminOrdersPageProps) {
  const { t } = useTranslation()

  const selected = orders.find((order) => order.id === selectedId)
  const total = orders.length
  // The same table `OrderDetail` consults before offering the button, so the count and the
  // affordance cannot drift: `paid` and `oversold` are dispatchable and nothing else is. The
  // design's `2 em aberto` is `status !== "Despachado"`, which counts an expired order — never
  // paid, nothing to do about it — as work waiting.
  const waiting = orders.filter((order) => canTransition(order.status, 'shipped')).length

  return (
    <>
      <div className={BAND}>
        <div>
          <h1 className="font-display text-[clamp(30px,4vw,48px)] leading-none font-normal">{t('Orders')}</h1>
          {/* The design's `.55` measures 3.82:1 on paper against a 4.5:1 floor; 65% is 5.26:1.
              Two keys and a condition for the COUNT OF ORDERS, not a plural suffix: `copy.test.ts`
              rejects a `_one`/`_other` key because no literal call site names it, and the
              prototype's own template prints `1 itens`.

              And ONE key for the other half, which is the correction a surviving mutation forced.
              `para despachar` is a verb phrase and does not inflect, so `1 para despachar` and
              `{{count}} para despachar` at one are the same string in Portuguese AND in English —
              the branch's recurring defect of two values that coincide, this time hiding a key with
              a call site nothing could ever tell apart from its neighbour. The pair stays where the
              noun really does inflect (`1 pedido` against `1 pedidos`). */}
          {loadFailed || total === 0 ? null : (
            <p className="font-mono mt-2.5 text-[11px] uppercase tracking-[0.14em] opacity-65">
              {`${total === 1 ? t('1 order') : t('{{count}} orders', { count: total })} · ${t(
                '{{count}} to dispatch',
                { count: waiting },
              )}`}
            </p>
          )}
        </div>
        <div className="flex min-w-[220px] flex-col gap-2">
          <FieldLabel htmlFor={FILTER_ID}>{t('Status')}</FieldLabel>
          <Select
            id={FILTER_ID}
            value={filter ?? NO_FILTER}
            options={[
              { value: NO_FILTER, label: t('Everything except expired') },
              { value: 'all', label: t('Everything') },
              // `StatusPill`'S OWN MAP, not a second copy of it. This used to be a five-branch
              // switch spelling the same five sentences out again, because `copy.test.ts` allowed
              // exactly one runtime-built `t()` in the whole of `src/ui` and the pill had spent it.
              // The scan now registers the key SET per file instead of rationing call sites, so the
              // filter and the pill it has to agree with read one map.
              ...ORDER_STATUSES.map((status) => ({ value: status, label: t(STATUS_LABELS[status]) })),
            ]}
            onChange={(value) => onFilterChange(filterFromOption(value))}
          />
        </div>
      </div>

      {loadFailed ? (
        <div className="px-gutter-admin flex flex-col items-start gap-6 py-10">
          <p role="alert" className="font-body max-w-[46ch] text-[17px] leading-[1.6] text-pretty opacity-80">
            {t('Something broke on my side. Try again in a moment.')}
          </p>
          {onRetry ? (
            <PillButton variant="outline" onClick={onRetry}>
              {t('Try again')}
            </PillButton>
          ) : null}
        </div>
      ) : total === 0 ? (
        // A list emptied BY THE FILTER is not a shop that has never sold anything, and `OrdersList`
        // cannot tell the two apart — it is handed a list and knows nothing about why. Saying
        // "nenhum pedido ainda" to somebody who just asked for the expired ones is a lie the page
        // is the only layer able to avoid. Under the API's default, and under `all`, the list's own
        // sentence is the true one and stays.
        filter && filter !== 'all' ? (
          <p className={NOTHING}>{t('No orders with this status.')}</p>
        ) : (
          <OrdersList orders={orders} lang={lang} />
        )
      ) : (
        <div className="bg-ink grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-px">
          <OrdersList orders={orders} selectedId={selected?.id} lang={lang} />
          {selected ? (
            <OrderDetail order={selected} lang={lang} {...dispatch} />
          ) : (
            // Paints its own paper for the same reason the two real cells do: a cell that does not
            // is a cell the container's ink shows through.
            <div className="bg-paper flex items-start p-[clamp(24px,4vw,40px)]">
              <p className="font-display text-[26px] leading-[1.2] opacity-65">{t('Pick an order from the list.')}</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
