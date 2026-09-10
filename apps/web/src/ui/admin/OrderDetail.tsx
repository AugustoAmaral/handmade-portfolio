import {
  type AdminOrder,
  SHIPPING_METHODS,
  type ShippingAddress,
  canTransition,
  formatOrderNumber,
  formatPrice,
} from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { PillButton, Price, RuledList, RuledRow, SectionRule, StatusPill } from '../primitives'
import { routes } from '../routes'
import { formatOrderDate } from './OrdersList'
import { type DispatchError, TrackingInlineForm } from './TrackingInlineForm'

export interface OrderDetailProps {
  order: AdminOrder
  lang: 'pt' | 'en'
  /** The tracking form is open. Held by the container (spec:196), like everything else here. */
  trackingEditing?: boolean
  trackingCode: string
  /** The PATCH is in flight. */
  dispatching?: boolean
  dispatchError?: DispatchError
  onStartDispatch(): void
  onChangeTrackingCode(value: string): void
  onConfirmDispatch(): void
  onCancelDispatch(): void
}

/**
 * The design's one-line address, exactly: street parts, an em dash (U+2014, one space each side),
 * then the locality parts. Every optional field drops out cleanly rather than leaving a stray
 * comma — `shippingAddressSchema` makes `number`, `complement`, `district` and `state` optional and
 * an international address routinely has none of them.
 *
 * THE COUNTRY IS A NAME, NOT THE STORED CODE. `Intl.DisplayNames` in the panel's own language does
 * it; a table would be a fourth place for `BR` to be spelled and would have to be grown by hand
 * alongside `INTL_ALLOWED_COUNTRIES`. The `?? code` is not defensive padding: `.of()` is typed as
 * possibly undefined and printing `US` is a better failure than printing `undefined`.
 */
export function formatAddress(address: ShippingAddress, lang: 'pt' | 'en'): string {
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'
  const country = new Intl.DisplayNames([locale], { type: 'region' }).of(address.country) ?? address.country
  const street = [address.street, address.number, address.complement].filter(Boolean).join(', ')
  const cityState = [address.city, address.state].filter(Boolean).join(' / ')
  const locality = [address.district, cityState, address.postalCode, country].filter(Boolean).join(', ')
  return `${street} — ${locality}`
}

const NAME_ID = 'admin-order-name'
const DELIVERY_ID = 'admin-order-delivery'
const ITEMS_ID = 'admin-order-items'
const NOTES_ID = 'admin-order-notes'
const GIFT_ID = 'admin-order-gift'

/** The prototype's free-text blocks: address, notes and gift message all share this recipe. */
const PROSE = 'font-body text-[17px] leading-[1.55] text-pretty opacity-85'

/** The muted mono the extract measured at `.55` and `.6`, raised to the branch's 65% floor. */
const MUTED = 'font-mono opacity-65'

/**
 * One order in full: who bought it, where it goes, what is in it, and the two things that can be
 * done about it.
 *
 * WHAT THE DESIGN GIVES AND WHAT IT DOES NOT. The layout, the copy and the five blocks are
 * transcribed. Four things are not:
 *
 *   - **CPF is deleted.** The prototype carries `["CPF", "042.118.***-**"]` on all four of its
 *     orders and renders it third of four contact rows, but spec decision 3 removed CPF from the
 *     checkout. A field that is never collected cannot be displayed. Three rows remain, which makes
 *     the design's own `hint-placeholder-count="3"` accidentally correct.
 *   - **The payment half of `status · payment` is deleted.** Its vocabulary is `Stripe · boleto`
 *     and `Stripe · Pix` on two of the four fixtures, and spec decision 2 made the real build card
 *     only — after which the line would read `Stripe · cartão` for every order that will ever
 *     exist, which is not information. `AdminOrder` carries no payment-method field at all. What
 *     takes the slot is the Stripe SESSION, which is the one thing there that can be acted on.
 *   - **`Marcar como despachado` is conditional.** See below.
 *   - **A gift message is rendered.** The checkout collects one and the design never draws it, so
 *     without this the message goes on no card and the feature is broken end to end.
 *
 * THE DISPATCH AFFORDANCE IS DERIVED FROM `canTransition`, NOT FROM A LIST WRITTEN HERE.
 * `ADMIN_ORDER_TRANSITIONS` allows `shipped` from `paid` and `oversold` and from nowhere else, and
 * the API answers `409 INVALID_TRANSITION` for the other three. The prototype draws the button
 * identically on all four of its orders, two of which are already `Despachado`. Reading the shared
 * table means the button cannot drift away from the API if that table changes.
 *
 * THE CUSTOMER'S NAME IS THE PANE'S TITLE and the sections nest under it. That is why `SectionRule`
 * grew a `level`: at one level `Envio` announces as a sibling of `Marina Bicalho`, which tells a
 * reader moving by heading that the address belongs to the screen rather than to the order.
 *
 * IT REQUIRES AN ORDER AND DRAWS NO "NOTHING SELECTED" STATE. A detail pane with no subject is not
 * a detail pane; the page that pairs this with the list (Task 7) is where that state belongs. The
 * prototype has no defence at all — it binds to `ORDERS[s.order] || ORDERS[0]` and dereferences
 * `ord.code` on `undefined` when the list is empty.
 */
export function OrderDetail({
  order,
  lang,
  trackingEditing = false,
  trackingCode,
  dispatching,
  dispatchError,
  onStartDispatch,
  onChangeTrackingCode,
  onConfirmDispatch,
  onCancelDispatch,
}: OrderDetailProps) {
  const { t } = useTranslation()

  const method = order.shippingMethod ? SHIPPING_METHODS[order.shippingMethod] : null
  // Three states, and the third is why this is not a ternary. A code replaces the estimate; with no
  // code, an order that has already gone gets NO estimate, because a delivery window on something
  // dispatched two weeks ago is a sentence that is simply false. The prototype's `previsão 12 set`
  // is a baked string and there is no delivery DATE anywhere in the model, so what can honestly be
  // shown before dispatch is the range the shipping table already publishes.
  const deliveryNote = order.trackingCode
    ? t('tracking {{code}}', { code: order.trackingCode })
    : order.shippedAt
      ? null
      : (method?.eta[lang] ?? null)

  const contact: [string, string][] = [
    [t('E-mail'), order.buyer.email],
    ...(order.buyer.phone ? ([[t('Phone / WhatsApp'), order.buyer.phone]] as [string, string][]) : []),
    ...(order.referral ? ([[t('How they found me'), order.referral]] as [string, string][]) : []),
  ]

  return (
    <section aria-labelledby={NAME_ID} className="bg-paper flex flex-col gap-[26px] p-[clamp(24px,4vw,40px)]">
      <div>
        <p className={`${MUTED} text-[11px] uppercase tracking-[0.16em]`}>
          {`${formatOrderNumber(order.orderNumber)} · ${formatOrderDate(order.createdAt, lang)}`}
        </p>
        <h2 id={NAME_ID} className="font-display mt-2.5 text-[clamp(28px,3.4vw,40px)] leading-[1.05] font-normal">
          {order.buyer.name}
        </h2>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          {/* A pill and not the design's plain mono text. The design shows three of the five
              statuses and never draws `oversold` or `expired`; as 11px muted text those would be
              indistinguishable from `Despachado`, where the pill already carries a tone per state
              (including a DASHED border, so `expired` and `pending` differ by more than opacity).
              It is also the single home of the wording, reached through the one runtime-built `t()`
              call `copy.test.ts` allows in `src/ui`. */}
          <StatusPill status={order.status} />
          {order.stripeSessionId ? (
            <span className={`${MUTED} text-xs tracking-[0.06em]`}>{`Stripe · ${order.stripeSessionId}`}</span>
          ) : (
            // `checkout.ts` writes the session id immediately after creating the session, so its
            // absence means the process died in between and this order never reached Stripe.
            // `lib/orphans.ts` sweeps it to `expired` an hour after a boot; until then it sits here
            // looking exactly like any other pending order, which is the thing being fixed.
            <span className="font-mono text-accent text-xs tracking-[0.06em]">
              {t('This order never reached Stripe.')}
            </span>
          )}
        </div>
      </div>

      {/* The hairline list the design draws, as a real `<dl>`. Four `<span>` pairs in a flex row
          announce as eight unrelated strings. */}
      <RuledList as="dl" className="font-mono text-xs">
        {contact.map(([key, value]) => (
          <RuledRow key={key} className="flex justify-between gap-4">
            {/* The opacity is on the KEY and not on the row: `opacity` composites a subtree as one
                group, so the same class one element up would dim the value with it. */}
            <dt className="uppercase tracking-[0.1em] opacity-65">{key}</dt>
            <dd className="text-right">{value}</dd>
          </RuledRow>
        ))}
      </RuledList>

      <section aria-labelledby={DELIVERY_ID}>
        <SectionRule id={DELIVERY_ID} level={3} className="mb-3.5">
          {t('Delivery')}
        </SectionRule>
        {order.shippingAddress ? <p className={PROSE}>{formatAddress(order.shippingAddress, lang)}</p> : null}
        {method ? (
          <p className={`${MUTED} mt-2.5 text-xs`}>
            {deliveryNote ? `${method.name[lang]} · ${deliveryNote}` : method.name[lang]}
          </p>
        ) : (
          // A digital-only order: `shippingAddress` and `shippingMethod` are both null, which the
          // type allows and no other fixture is. The catalogue's own words for a digital piece,
          // rather than a second sentence saying the same thing.
          <p className={PROSE}>{t('Delivered by e-mail')}</p>
        )}
      </section>

      <section aria-labelledby={ITEMS_ID}>
        <SectionRule id={ITEMS_ID} level={3} className="mb-3.5">
          {t('Items')}
        </SectionRule>
        <ul className="flex flex-col gap-2.5">
          {order.items.map((item) => (
            <li key={item.slug} className="flex items-baseline justify-between gap-4">
              <span className="font-display text-xl">{item.name[lang]}</span>
              {/* The unit price the order was CHARGED at, not today's catalogue price and not a
                  line total this component worked out — `unitAmountCents` is the snapshot the
                  checkout took, and the only arithmetic on this pane is the one the API sent. */}
              <span className="font-mono whitespace-nowrap text-[13px]">
                {`${item.qty} × ${formatPrice(item.unitAmountCents, lang)}`}
              </span>
            </li>
          ))}
        </ul>
        <dl className="font-mono border-ink/30 mt-2.5 flex justify-between gap-4 border-t pt-3 text-[15px]">
          <dt>{t('Total')}</dt>
          <dd>
            <Price cents={order.amounts.totalCents} lang={lang} />
          </dd>
        </dl>
      </section>

      {order.notes ? (
        <section aria-labelledby={NOTES_ID}>
          <SectionRule id={NOTES_ID} level={3} className="mb-3.5">
            {t('Customer notes')}
          </SectionRule>
          <p className={PROSE}>{order.notes}</p>
        </section>
      ) : null}

      {/* NOT IN THE DESIGN, and it has to be here anyway: the checkout collects a gift message to
          go on a card in the parcel, and a panel that never shows it is a panel that cannot fulfil
          a gift order. Its own block rather than a line under the notes — they are two different
          people writing about two different things. */}
      {order.giftMessage ? (
        <section aria-labelledby={GIFT_ID}>
          <SectionRule id={GIFT_ID} level={3} className="mb-3.5">
            {t('Gift message')}
          </SectionRule>
          <p className={PROSE}>{order.giftMessage}</p>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {canTransition(order.status, 'shipped') ? (
          <TrackingInlineForm
            editing={trackingEditing}
            value={trackingCode}
            pending={dispatching}
            error={dispatchError}
            onOpen={onStartDispatch}
            onChange={onChangeTrackingCode}
            onConfirm={onConfirmDispatch}
            onCancel={onCancelDispatch}
          />
        ) : null}
        {/* Tracking codes go out BY HAND (spec:4): there is no transactional e-mail provider on
            this project and this link is the entire mechanism. A pure `mailto:` — no state, no
            side effect, no client — with the code in the body when there is one to quote. In the
            design this pill has no handler and no address behind it. */}
        <PillButton
          variant="outline"
          href={routes.mailto(
            order.buyer.email,
            t('Order {{number}}', { number: formatOrderNumber(order.orderNumber) }),
            order.trackingCode ? t('Tracking code: {{code}}', { code: order.trackingCode }) : undefined,
          )}
        >
          {t('Reply by e-mail')}
        </PillButton>
      </div>
    </section>
  )
}
