import { useTranslation } from 'react-i18next'
import { CheckoutSection } from './CheckoutSection'

/**
 * Section 05, and it is not a choice. The prototype draws it as a row with a permanently-filled
 * dot, identical to a selected shipping option, and building it out of the same radio would be a
 * control that can only ever hold one value — a form field that cannot be filled in wrongly and
 * cannot be filled in at all. It is a statement about what happens next, so it is a paragraph with
 * a decorative mark.
 *
 * NO PROPS AT ALL, including no `lang`: nothing here is catalogue data and no price is formatted,
 * so the copy instance resolves every string and there is no language to choose between.
 *
 * THE FIRST SENTENCE IS REWRITTEN, spec decision 2: the prototype offers `Cartao, Pix ou boleto`
 * and the shop takes cards only, so a Pix promise on the last screen before payment is a promise
 * broken one click later. It is a separate key from the sentence after it precisely so the split
 * is visible — the second sentence is the prototype's, verbatim, and the story asserts it
 * character for character.
 */
export function CheckoutPaymentSection() {
  const { t } = useTranslation()
  return (
    <CheckoutSection id="checkout-payment" tag={t('05 · Payment')}>
      <div className="border-ink bg-paper flex items-start gap-3 border px-4 py-3.5">
        <span aria-hidden="true" className="bg-ink mt-[7px] size-[11px] shrink-0 rounded-full" />
        <div>
          <p className="font-body text-[17px] leading-[1.2]">{t('Stripe Checkout')}</p>
          <p className="font-mono mt-2 text-[12px] leading-[1.55] opacity-80">
            {t('Credit card on the secure Stripe page.')}{' '}
            {t('No card data passes through here — you come back with the order confirmed.')}
          </p>
        </div>
      </div>
    </CheckoutSection>
  )
}
