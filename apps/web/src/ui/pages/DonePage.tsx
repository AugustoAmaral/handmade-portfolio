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
 * The page Stripe sends the buyer back to.
 *
 * THE HEADLINE IS THE `<h1>`, where the prototype has a `<div>` that merely looks like one. This
 * page has no other heading, so without it the document has none at all — and a heading that is
 * only a font size is invisible to every way of moving through a page that is not the eye.
 *
 * THREE STATES, AND THEY ARE THE REASON THIS PAGE IS NOT A RECEIPT. Stripe redirects the moment
 * the card clears, and the webhook that flips the order to `paid` arrives separately and later.
 * So `pending` — the order exists, the money has not been confirmed to me yet — is the state most
 * buyers see first, and it is the one the prototype does not have. `gaveUp` is the third: after
 * about thirty seconds of polling, promising that the page will update itself is a promise it has
 * stopped keeping, and the honest thing is to point at the receipt Stripe already sent. Only the
 * second line of the headline and the paragraph change between the three; the order number, the
 * table and the way out are the same facts in all of them, and moving them around would make the
 * page look like it went wrong.
 *
 * ANYTHING THAT IS NOT `pending` READS AS CONFIRMED, which covers `shipped` (a page kept open
 * across a dispatch) and also `oversold` and `expired` — see the marker on the branch itself, which
 * is where the decision is actually made. FLAGGED, not solved: inventing the copy here would put
 * words in Augusto's mouth on the two worst screens in the flow.
 *
 * THE TABLE SHRINKS WITH WHAT IS KNOWN. A digital order has no shipping method and no ETA
 * (`PublicOrder` types both nullable and `computeTotals` charges nothing for it), so it gets the
 * total row alone rather than two rows reading `—`. The drawer and the catalogue made the same
 * call: an empty region says one true thing instead of three empty ones. `Total pago` becomes
 * `Total` while the payment is unconfirmed, because it is the one label on the page that would be
 * claiming the very thing the page is waiting for.
 *
 * The back link is a real `<a href>` where the prototype has a `<span onClick>`, and it is wrapped
 * in a plain block so it keeps its content width inside a stretch-aligned column.
 */
export function DonePage({ order, lang, gaveUp }: DonePageProps) {
  const { t } = useTranslation()
  // ⚠️ OUTSTANDING COPY — `oversold` AND `expired` RENDER THE CONFIRMED SCREEN, AND SHOULD NOT.
  //
  // `ORDER_STATUSES` is `pending | paid | shipped | oversold | expired`, and this line sorts them
  // into two buckets, so three of them land on "Pedido feito. Agora é minha vez.":
  //   - `paid` and `shipped` — correct, and what the sentence was written for.
  //   - `oversold` — the card cleared and then the stock ran out underneath it. "Pedido feito" is
  //     still true; "agora é minha vez" is not, because what the buyer needs to hear is what
  //     happens to their money.
  //   - `expired` — the checkout session lapsed, so the order was never paid at all. Here even
  //     "Pedido feito" is false. Reachable by a buyer who leaves this page open past the session,
  //     or who returns to the `/thanks` URL later and lets the lookup run.
  //
  // Left deliberately unwritten rather than guessed: Augusto is writing these two sentences
  // himself, and copy invented here would ship as his voice on the two worst screens in the flow.
  // Whoever picks this up needs two new `pt.json` keys and a third branch below — the shape is the
  // `gaveUp` ternary already on the headline and the paragraph, which is the same kind of split.
  const confirmed = order !== null && order.status !== 'pending'
  const method = order?.shippingMethod ?? null
  return (
    <div className="px-gutter mx-auto flex max-w-[760px] flex-col gap-[22px] py-[clamp(48px,9vw,120px)]">
      {order ? <Eyebrow>{t('Order {{number}}', { number: formatOrderNumber(order.orderNumber) })}</Eyebrow> : null}
      <h1 className="font-display text-[clamp(40px,6vw,74px)] leading-[1.02] text-balance">
        {t('Order placed.')}
        <br />
        <em>{confirmed ? t('Now it is my turn.') : gaveUp ? t('Still confirming.') : t('Confirming the payment.')}</em>
      </h1>
      <p className="text-[19px] leading-[1.55] text-pretty opacity-80">
        {confirmed
          ? t(
              'I have sent the confirmation by e-mail, and I will send the tracking code when I post it. If you got here from the technical side of things: this whole flow is the portfolio.',
            )
          : gaveUp
            ? t(
                'The payment confirmation has not reached me yet. If Stripe sent you the receipt, everything is fine: I get the confirmation and I write to you by e-mail.',
              )
            : t('Stripe is telling me about the payment. It takes a few seconds — this page refreshes itself.')}
      </p>
      {order ? (
        <dl className="bg-ink border-ink font-mono flex flex-col gap-px border text-[13px]">
          <Row label={confirmed ? t('Total paid') : t('Total')}>{formatPrice(order.totalCents, lang)}</Row>
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
