import { type PublicOrder, SHIPPING_METHODS, formatOrderNumber, formatPrice } from '@shop/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Eyebrow, PillButton } from '../primitives'
import { routes } from '../routes'

export interface DonePageProps {
  /**
   * `null` while the lookup has not produced an order — in flight, or given up on. The order is
   * created BEFORE the Stripe redirect (spec decision 5), so a buyer standing here always has one;
   * what is unknown in this state is whether this browser can currently read it back.
   */
  order: PublicOrder | null
  lang: 'pt' | 'en'
  /**
   * The container has stopped polling — spec:202 puts that at about 30 seconds. It is what turns
   * "this page will update itself" into "check your receipt", and it is a fact about the container
   * rather than about the order, which is why it cannot be read off `order.status`.
   */
  gaveUp: boolean
}

/** One hairline row of the little order table. The `<dl>` around it is what makes the pair a pair. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-paper flex justify-between gap-4 px-4 py-3.5">
      {/* opacity-65, not the prototype's .6: ink at 60% over paper is 4.48:1 and the floor for
          13px text is 4.5:1. */}
      <dt className="opacity-65">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * The five order statuses collapse onto FOUR screens, and the collapse is not the one the names
 * suggest — which is why it is computed here once, by name, rather than by a chain of inequalities
 * at three separate call sites.
 *
 * `paid` and `shipped` are one screen: `shipped` is this page kept open across a dispatch, and the
 * tracking code a dispatched buyer wants is in the e-mail the confirmed paragraph promises.
 *
 * `oversold` IS FULFILLABLE, which is the fact its name hides. `ADMIN_ORDER_TRANSITIONS` allows
 * `oversold -> shipped`: the card cleared, the order is real, and the stock ran out underneath it
 * afterwards — reachable in production because the decrement can lose a race after `Order.create`
 * has already succeeded. So it is a DELAY. The confirmed screen is wrong because it promises the
 * ordinary schedule, and a refund notice would be wrong in the other direction, offering to undo a
 * purchase that is still going to be delivered.
 *
 * `expired` WAS NEVER PAID. The Stripe session lapsed before the card went through, so nothing was
 * charged and nothing is owed in either direction. It is the one state where the FIRST line of the
 * headline is false as well, because there is no purchase to have been placed — and it is the only
 * state that moves that line.
 *
 * `null`, and `pending` with it, is the wait: the order exists but this browser has not been told
 * the money has.
 */
type DoneScreen = 'confirmed' | 'oversold' | 'expired' | 'waiting'

function screenFor(order: PublicOrder | null): DoneScreen {
  if (order === null) return 'waiting'
  // Spelled out rather than defaulted: with a `default` branch, a sixth status added to
  // `@shop/shared` would silently land on the confirmed screen. Exhaustive, the union narrows to
  // `never` here and the missing return is a compile error, so the decision has to be made.
  switch (order.status) {
    case 'pending':
      return 'waiting'
    case 'oversold':
      return 'oversold'
    case 'expired':
      return 'expired'
    case 'paid':
    case 'shipped':
      return 'confirmed'
  }
}

/**
 * The page Stripe sends the buyer back to.
 *
 * THE HEADLINE IS THE `<h1>`, where the prototype has a `<div>` that merely looks like one. This
 * page has no other heading, so without it the document has none at all — and a heading that is
 * only a font size is invisible to every way of moving through a page that is not the eye.
 *
 * FIVE SCREENS, AND THEY ARE THE REASON THIS PAGE IS NOT A RECEIPT. Stripe redirects the moment
 * the card clears, and the webhook that flips the order to `paid` arrives separately and later.
 * So `pending` — the order exists, the money has not been confirmed to me yet — is the state most
 * buyers see first, and it is the one the prototype does not have. `gaveUp` is the second: after
 * about thirty seconds of polling, promising that the page will update itself is a promise it has
 * stopped keeping, and the honest thing is to point at the receipt Stripe already sent. The other
 * two are the delay and the lapse, described on `screenFor` above.
 *
 * `gaveUp` IS CONSULTED LAST AND ONLY WHILE WAITING, which is a branch order rather than an
 * accident: it is a fact about how long this browser has been asking, and every screen below it is
 * one where the asking already got an answer. It goes true after thirty seconds whatever the
 * status, so a page that read it first would tell a lapsed order it was still confirming.
 *
 * ONLY THE SECOND LINE OF THE HEADLINE AND THE PARAGRAPH MOVE, `expired` excepted. The order
 * number, the table and the way out are the same facts everywhere, and shuffling them would make
 * an ordinary wait look like something went wrong. What `expired` buys with its extra difference
 * is the one thing worth the inconsistency: not claiming a purchase happened.
 *
 * THE TABLE SHRINKS WITH WHAT IS KNOWN. A digital order has no shipping method and no ETA
 * (`PublicOrder` types both nullable and `computeTotals` charges nothing for it), so it gets the
 * total row alone rather than two rows reading `—`. The drawer and the catalogue made the same
 * call: an empty region says one true thing instead of three empty ones. `Total pago` becomes
 * `Total` wherever the money was not taken, because it is the one label on the page that would be
 * claiming the very thing the page is waiting for — and `expired` is the state where that claim
 * was outright false, since it never charged a card at all.
 *
 * The back link is a real `<a href>` where the prototype has a `<span onClick>`, and it is wrapped
 * in a plain block so it keeps its content width inside a stretch-aligned column.
 */
export function DonePage({ order, lang, gaveUp }: DonePageProps) {
  const { t } = useTranslation()
  const screen = screenFor(order)
  // The money was taken on exactly two of the four screens. `oversold` keeps the paid label
  // because the card really did clear — what went wrong there is the piece, not the payment.
  const charged = screen === 'confirmed' || screen === 'oversold'
  const method = order?.shippingMethod ?? null
  return (
    <div className="px-gutter mx-auto flex max-w-[760px] flex-col gap-[22px] py-[clamp(48px,9vw,120px)]">
      {order ? <Eyebrow>{t('Order {{number}}', { number: formatOrderNumber(order.orderNumber) })}</Eyebrow> : null}
      <h1 className="font-display text-[clamp(40px,6vw,74px)] leading-[1.02] text-balance">
        {screen === 'expired' ? t('This order expired.') : t('Order placed.')}
        <br />
        <em>
          {screen === 'confirmed'
            ? t('Now it is my turn.')
            : screen === 'oversold'
              ? t('It is going to take a little longer.')
              : screen === 'expired'
                ? t('Nothing was charged.')
                : gaveUp
                  ? t('Still confirming.')
                  : t('Confirming the payment.')}
        </em>
      </h1>
      <p className="text-[19px] leading-[1.55] text-pretty opacity-80">
        {screen === 'confirmed'
          ? t(
              'I have sent the confirmation by e-mail, and I will send the tracking code when I post it. If you got here from the technical side of things: this whole flow is the portfolio.',
            )
          : screen === 'oversold'
            ? t(
                'The payment went through; what ran out was the piece, which left the stock while the card was going. Everything here is made by hand, so I will make yours from scratch — it takes longer than the usual 5 business days, and I will write to you by e-mail within 2 business days with the date I post it. There is nothing for you to do.',
              )
            : screen === 'expired'
              ? t(
                  'The Stripe payment page has a time limit, and this one ran out before the card went through — nothing is pending on your side or on mine. If the piece is still in the catalogue, it is a matter of putting it in the bag again.',
                )
              : gaveUp
                ? t(
                    'The payment confirmation has not reached me yet. If Stripe sent you the receipt, everything is fine: I get the confirmation and I write to you by e-mail.',
                  )
                : t('Stripe is telling me about the payment. It takes a few seconds — this page refreshes itself.')}
      </p>
      {order ? (
        <dl className="bg-ink border-ink font-mono flex flex-col gap-px border text-[13px]">
          <Row label={charged ? t('Total paid') : t('Total')}>{formatPrice(order.totalCents, lang)}</Row>
          {method ? <Row label={t('Delivery')}>{SHIPPING_METHODS[method].name[lang]}</Row> : null}
          {order.eta ? <Row label={t('Estimated time')}>{order.eta[lang]}</Row> : null}
        </dl>
      ) : null}
      <div>
        <PillButton href={routes.home()} variant="outline">
          {t('Back to the catalogue')}
        </PillButton>
      </div>
    </div>
  )
}
