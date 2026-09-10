import { type FieldErrors, type ShippingMethod, type ShippingMethodInfo, formatPrice } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { RuledList, RuledRow } from '../primitives'
import { CheckoutSection, useFieldError } from './CheckoutSection'

export interface CheckoutShippingSectionProps {
  /** `shippingOptionsFor(country)` — empty for a country I do not ship to. */
  options: readonly ShippingMethodInfo[]
  selected: ShippingMethod | null
  /** `name` and `eta` are `{ pt, en }` pairs and the price is integer cents; both need the language. */
  lang: 'pt' | 'en'
  errors: FieldErrors
  onSelect(method: ShippingMethod): void
}

const ERROR_ID = 'shipping-method-error'

/**
 * Section 03. The prototype's options are `<div onClick>` with no role, no keyboard handling and
 * no focus indicator, and the only thing separating chosen from not chosen is an 11px dot. All of
 * that is rebuilt.
 *
 * THE DOT IS A REAL RADIO, tinted with `accent-color`, not a `<span>` painted to look like one. A
 * hand-drawn dot has to re-earn four things the browser gives away — the roving arrow-key
 * selection inside a group, the announcement as "radio, checked, 1 of 2", the focus ring, and
 * survival under forced-colors, where a `background-color` circle simply stops being drawn. The
 * visible difference from the prototype is that an unchecked radio keeps the browser's own ring
 * instead of the design's `ink/50` one, which is the cost of getting those four for free.
 *
 * The focus ring is on the ROW, not on the 11px control: a 2px outline around an 11px circle is a
 * legally-sufficient indicator that nobody sees. It is the same 2px accent outline the three text
 * primitives use, pulled inside the row so the hairline grid does not clip it.
 *
 * THE LEGEND SAYS WHERE, because the options are the only clue the reader has about why there are
 * two of them and not five. The section has no `country` prop and does not need one: `scope` comes
 * on each option, which is the same fact one step closer to what is being rendered.
 *
 * The error is `aria-describedby` on the fieldset rather than `aria-errormessage`. `aria-invalid`
 * and its error message are not allowed on `group`, and reaching for `role="radiogroup"` to make
 * them legal would override the native role that gives the legend its job as the group's name.
 * The `alert` role is what gets the sentence announced.
 */
export function CheckoutShippingSection({ options, selected, lang, errors, onSelect }: CheckoutShippingSectionProps) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  const error = errorFor('shippingMethod')
  const domestic = options.length > 0 && options.every((option) => option.scope === 'BR')
  return (
    <CheckoutSection id="checkout-shipping" tag={t('03 · Shipping')}>
      {options.length === 0 ? (
        <p className="font-mono text-[13px] leading-[1.5] opacity-80">{t('No shipping options for this address.')}</p>
      ) : (
        <fieldset aria-describedby={error ? ERROR_ID : undefined}>
          <legend className="font-mono mb-3 text-[11px] uppercase tracking-[0.14em] opacity-65">
            {domestic ? t('Ship to: Brazil') : t('Ship to: outside Brazil')}
          </legend>
          <RuledList>
            {/* `RuledRow` and not the three classes it paints, which is what these rows used to
                copy out: the background, the padding and the horizontal rhythm in a second place,
                where a row that lost `bg-paper` would show the list's ink through and read as a
                rendering fault. It could not consume the primitive before, because the row has to
                be a `<label>` for the radio inside it to be clickable and `RuledRow` was a `<div>`
                — so the primitive grew the same `as` union `RuledList` already had. */}
            {options.map((option) => (
              <RuledRow
                key={option.id}
                as="label"
                className="hover:bg-paper-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent flex cursor-pointer items-center gap-3"
              >
                <input
                  type="radio"
                  name="shipping-method"
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => onSelect(option.id)}
                  className="accent-ink size-[11px] shrink-0"
                />
                <span className="font-body text-[17px] leading-[1.2]">{option.name[lang]}</span>
                <span className="font-mono text-[11px] tracking-[0.04em] opacity-65">{option.eta[lang]}</span>
                <span className="font-mono ml-auto text-[13px]">{formatPrice(option.cents, lang)}</span>
              </RuledRow>
            ))}
          </RuledList>
        </fieldset>
      )}
      {error ? (
        <p id={ERROR_ID} role="alert" className="font-mono text-accent mt-2 text-[11px]">
          {error}
        </p>
      ) : null}
    </CheckoutSection>
  )
}
