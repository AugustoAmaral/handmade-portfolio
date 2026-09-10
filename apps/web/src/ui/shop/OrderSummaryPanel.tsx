import { formatPrice } from '@shop/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PillButton, Price } from '../primitives'
import type { CartLineData } from './CartLine'
import { CheckoutSection, useErrorMessage } from './CheckoutSection'

export interface OrderSummaryPanelProps {
  lines: CartLineData[]
  itemsCents: number
  /** `null` until a shipping method is chosen — not `0`, which is a real price. */
  shippingCents: number | null
  totalCents: number
  /** Already resolved for the language by the container: `SHIPPING_METHODS[m].name[lang]`. */
  shippingMethodName: string | null
  lang: 'pt' | 'en'
  submitting: boolean
  /**
   * An API error code (`OUT_OF_STOCK`, `STRIPE_UNAVAILABLE`, …) rather than a finished sentence.
   * Both work: it goes through the same table as the field errors, whose fallback renders anything
   * it does not recognise. A code is the better half of that deal, because a sentence built in the
   * container is copy resolved outside `src/ui`, where `copy.test.ts` cannot see it and a missing
   * translation ships as fluent English.
   */
  submitError: string | null
  /**
   * The id of the `<form>` the container wrapped this page in. Given one, the button becomes that
   * form's submit control and `onSubmit` is left alone — the form's own handler is then the single
   * path, and wiring both would run it twice per click. Left out, the button keeps its original
   * `type="button"` and calls `onSubmit` directly.
   */
  submitFormId?: string
  onSubmit(): void
}

/** The `<dd>` beside a totals `<dt>`. `muted` is the prototype's `.6`, raised to the 4.5:1 floor. */
function TotalsRow({
  label,
  muted = false,
  className = '',
  children,
}: {
  label: string
  muted?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`flex justify-between gap-4 ${className}`}>
      <dt className={muted ? 'opacity-65' : ''}>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * The sticky right-hand column of the checkout: what is being bought, what it costs, and the one
 * button that starts the payment.
 *
 * `unitCents` FINALLY HAS A READER. Task 5 put it on `CartLineData` for this line and nothing had
 * used it since; the drawer shows only the line total, and it is here that `2 × R$ 45,00` explains
 * where `R$ 90,00` came from.
 *
 * THE THIRD OF THE META LINE IS THE PIECE'S TYPE, and it arrived in Task 10 rather than here:
 * Task 9 flagged `{{qty}} × {{unit}} · {{type}}` as unrenderable because `CartLineData` had no
 * type, and step 0a added one. It earns the field three times over — this line, the shipping
 * sections `CheckoutPage` hides for a digital-only bag, and the shipping charge `computeTotals`
 * zeroes for the same bag are all the same fact, and reading them off one field is what stops the
 * page charging postage for something that arrives by e-mail.
 *
 * The two labels are separate literal keys chosen by a condition rather than `t(line.type)`. A key
 * built at runtime is invisible to `copy.test.ts`, which pins the number of dynamic call sites in
 * `src/ui` at exactly one — the same reason `ProductCard`'s availability ladder and this file's
 * error table are both spelled out.
 *
 * AN EMPTY BAG SHOWS THE MESSAGE AND NOTHING ELSE, the same call the drawer made: no totals,
 * because "Total R$ 0,00" is arithmetic about nothing, and no button, because the thing it starts
 * is an order with no items in it.
 *
 * THE BUTTON KEEPS ITS NAME WHILE SUBMITTING. Swapping the label to "Redirecionando" is the
 * obvious move and it is wrong twice over: a disabled button is dropped from the accessibility
 * tree by some screen readers, so the new label may never be read at all, and a control that
 * renames itself under a voice-control user is a control they can no longer ask for. The busy
 * state is a live region beside it, which IS announced, and the button is disabled so the second
 * click cannot happen — two pending orders and two Stripe sessions is what a double submit costs.
 *
 * ENTER SUBMITS THE CHECKOUT, AND THIS BUTTON IS WHY IT CAN. The fields are in the other grid
 * column, so HTML's implicit submission — which needs a submit control the form owns — had nothing
 * to activate and sixteen inputs did nothing on Enter. `submitFormId` makes this button that
 * control. The prop is optional and absent by default, so every story written before it renders
 * exactly the plain button it did.
 *
 * `PillButton` is used at its `block` size with no padding override. Its own note explains why:
 * the prototype's `17px` and the primitive's `15px` have equal specificity in the compiled
 * stylesheet and the winner is whichever Tailwind emitted last.
 */
export function OrderSummaryPanel({
  lines,
  itemsCents,
  shippingCents,
  totalCents,
  shippingMethodName,
  lang,
  submitting,
  submitError,
  submitFormId,
  onSubmit,
}: OrderSummaryPanelProps) {
  const { t } = useTranslation()
  const message = useErrorMessage()
  return (
    <CheckoutSection id="order-summary" tag={t('Your order')}>
      {lines.length === 0 ? (
        <p className="font-display text-[26px] leading-[1.2] opacity-60">{t('Your bag is empty.')}</p>
      ) : (
        <div className="flex flex-col gap-[18px]">
          <ul className="flex flex-col gap-[14px]">
            {lines.map((line) => (
              <li key={line.slug} className="flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <span className="font-display block text-[19px] leading-[1.15]">{line.name}</span>
                  <span className="font-mono mt-[5px] block text-[11px] tracking-[0.04em] opacity-65">
                    {line.qty} × {formatPrice(line.unitCents, lang)} ·{' '}
                    {line.type === 'digital' ? t('digital') : t('physical')}
                  </span>
                </div>
                <Price cents={line.lineCents} lang={lang} className="text-[13px]" />
              </li>
            ))}
          </ul>
          <dl className="font-mono border-ink/25 flex flex-col gap-[14px] border-t pt-[18px] text-[13px]">
            <TotalsRow label={t('Subtotal')} muted>
              <Price cents={itemsCents} lang={lang} />
            </TotalsRow>
            <TotalsRow
              label={shippingMethodName === null ? t('Shipping') : t('Shipping ({{method}})', { method: shippingMethodName })}
              muted
            >
              {shippingCents === null ? (
                <>
                  {/* An em dash is silence to a screen reader: the row would announce "Frete" and
                      stop. The dash is for the eye and the sentence is for everyone — and unlike
                      the drawer's, it can name the control that fills the gap, because that
                      control is on this page. */}
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">{t('Choose a shipping option')}</span>
                </>
              ) : (
                <Price cents={shippingCents} lang={lang} />
              )}
            </TotalsRow>
            <TotalsRow label={t('Total')} className="border-ink text-[17px] border-t pt-[14px]">
              <Price cents={totalCents} lang={lang} />
            </TotalsRow>
          </dl>
          <PillButton
            size="block"
            disabled={submitting}
            type={submitFormId ? 'submit' : 'button'}
            form={submitFormId}
            onClick={submitFormId ? undefined : onSubmit}
          >
            {t('Pay {{total}}', { total: formatPrice(totalCents, lang) })}
          </PillButton>
          {submitting ? (
            <p role="status" className="font-mono text-center text-[11px] tracking-[0.04em] opacity-80">
              {t('Sending you to Stripe')}
            </p>
          ) : null}
          {submitError ? (
            <p role="alert" className="font-mono text-accent border-accent border-l-2 pl-3 text-[13px] leading-[1.45]">
              {message(submitError)}
            </p>
          ) : null}
          <p className="font-mono text-[11px] leading-[1.55] opacity-80">
            {t(
              'By continuing you accept that I start making the piece. The production time counts from the payment confirmation.',
            )}
          </p>
        </div>
      )}
    </CheckoutSection>
  )
}
