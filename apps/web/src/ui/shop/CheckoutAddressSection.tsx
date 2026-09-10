import type { FieldErrors } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { CheckoutField, CheckoutSection, useFieldError } from './CheckoutSection'

export interface AddressValues {
  country: string
  postalCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

export interface CheckoutAddressSectionProps {
  values: AddressValues
  /** Keyed `shippingAddress.postalCode`, `shippingAddress.state`, … plus a bare `shippingAddress`. */
  errors: FieldErrors
  onChange(field: keyof AddressValues, value: string): void
}

const PREFIX = 'shippingAddress'

/**
 * Section 02, and the only section whose shape changes with the data in it.
 *
 * WHICH FIELDS EXIST IS DECIDED BY `checkoutRules`, not by taste. It enforces `invalid_cep`, a
 * required `number`, a required `district` and a two-letter `state` ONLY when the country is BR,
 * so a form that shows Brazilian fields to France collects data the API will reject and hides
 * nothing it needs. The two shapes are exactly the two schema-valid address fixtures: `brCheckout`
 * fills all eight, `intlCheckout` fills five and omits number, complement and district — so the
 * international form is `intlCheckout`'s shape and the Brazilian one is `brCheckout`'s, rather
 * than a judgement call about whether an apartment number is a Brazilian idea.
 *
 * THE COUNTRY COMES FIRST, and the prototype puts it last. Its order carries no information here:
 * it had no country-driven fields at all, because it had no validation at all. In a form where the
 * country decides what the rest of the form is, filling eight Brazilian fields and then watching
 * three of them vanish is a state the design never had to think about. Everything after it keeps
 * the prototype's order.
 *
 * THE COMPARISON IS NORMALISED. `checkoutRules` runs on the PARSED request, where zod has already
 * trimmed and upper-cased the country, so it branches on `BR` while a raw form value can be `br `.
 * A UI that branches on the raw string shows the international form to someone who typed `br` and
 * then gets `invalid_cep` back from an API that disagreed about which country this is.
 *
 * SIX OF THE EIGHT FIELDS DECLARE AN AUTOFILL PURPOSE (SC 1.3.5) AND TWO DELIBERATELY DO NOT.
 * The HTML autofill list models a street address as `address-line1..3` plus administrative levels,
 * and this form decomposes a Brazilian address finer than that, so two boxes have nothing in the
 * list that names them:
 *
 *   - `Número`. There is no house-number token. In the model the number belongs to line 1, which
 *     `Rua / logradouro` already carries; the only unused nearby token is `address-line2`, and
 *     taking it would aim the complement's content at the number box.
 *   - `Bairro`. The candidates are `address-level3` (the THIRD administrative level) and
 *     `address-line3`. A bairro is not an administrative division — Brazil's are the state and the
 *     municipality, already levels 1 and 2 — and there is no third address line here either, since
 *     the complement is line 2. Either would be a token picked by elimination.
 *
 * A wrong token is worse than none, because it is the one failure that is not inert: an
 * unrecognised token is ignored, while a recognised one aimed at the wrong box has a password
 * manager writing a city name into a street field. Leaving these two bare is the answer, not the
 * omission — and `CheckoutAddressSection.stories` asserts the absence so it stays a decision.
 *
 * `country` and not `country-name`, because the box holds a CODE: the rules compare it upper-cased
 * against `BR` and `shippingOptionsFor` looks it up in `INTL_ALLOWED_COUNTRIES`, so a browser
 * filling in `Brasil` would be filling in something the API rejects.
 *
 * A bare `shippingAddress` error has no field to hang on — it is what the rules emit when the
 * address is missing entirely — so it gets a section-level alert. The form always sends an address
 * object, so this arrives only from a request the page did not build; rendering it anyway is the
 * difference between a confusing checkout and a silent one.
 */
export function CheckoutAddressSection({ values, errors, onChange }: CheckoutAddressSectionProps) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  const brazil = values.country.trim().toUpperCase() === 'BR'
  const sectionError = errorFor(PREFIX)
  return (
    <CheckoutSection id="checkout-address" tag={t('02 · Shipping address')}>
      {sectionError ? (
        <p role="alert" className="font-mono text-accent border-accent mb-4 border-l-2 pl-3 text-[13px]">
          {sectionError}
        </p>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <CheckoutField
          id="address-country"
          label={t('Country')}
          autoComplete="country"
          value={values.country}
          error={errorFor(`${PREFIX}.country`)}
          onChange={(v) => onChange('country', v)}
        />
        <CheckoutField
          id="address-postal-code"
          label={brazil ? t('CEP') : t('Postal code')}
          autoComplete="postal-code"
          value={values.postalCode}
          error={errorFor(`${PREFIX}.postalCode`)}
          onChange={(v) => onChange('postalCode', v)}
        />
        {brazil ? (
          <CheckoutField
            id="address-number"
            label={t('Number')}
            value={values.number}
            error={errorFor(`${PREFIX}.number`)}
            onChange={(v) => onChange('number', v)}
          />
        ) : null}
        {brazil ? (
          <CheckoutField
            id="address-complement"
            label={t('Complement')}
            autoComplete="address-line2"
            value={values.complement}
            error={errorFor(`${PREFIX}.complement`)}
            onChange={(v) => onChange('complement', v)}
          />
        ) : null}
        <CheckoutField
          wide
          id="address-street"
          label={t('Street')}
          autoComplete="address-line1"
          value={values.street}
          error={errorFor(`${PREFIX}.street`)}
          onChange={(v) => onChange('street', v)}
        />
        {brazil ? (
          <CheckoutField
            id="address-district"
            label={t('District')}
            value={values.district}
            error={errorFor(`${PREFIX}.district`)}
            onChange={(v) => onChange('district', v)}
          />
        ) : null}
        <CheckoutField
          id="address-city"
          label={t('City')}
          autoComplete="address-level2"
          value={values.city}
          error={errorFor(`${PREFIX}.city`)}
          onChange={(v) => onChange('city', v)}
        />
        <CheckoutField
          id="address-state"
          label={brazil ? t('State') : t('State / province')}
          autoComplete="address-level1"
          value={values.state}
          error={errorFor(`${PREFIX}.state`)}
          onChange={(v) => onChange('state', v)}
        />
      </div>
    </CheckoutSection>
  )
}
