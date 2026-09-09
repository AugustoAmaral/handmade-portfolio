import type { FieldErrors } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { CheckoutField, CheckoutSection, useFieldError } from './CheckoutSection'

export interface BuyerValues {
  name: string
  email: string
  phone: string
}

export interface CheckoutBuyerSectionProps {
  values: BuyerValues
  /** Keyed `buyer.name`, `buyer.email`, `buyer.phone` — the shape the API returns. */
  errors: FieldErrors
  onChange(field: keyof BuyerValues, value: string): void
}

/**
 * Section 01. NO `lang` PROP, checked rather than assumed: every string here is a `t()` key
 * resolved by the provider, nothing comes from the catalogue, and no price is formatted — so
 * there is no second language to pick between and no hole of the kind Task 5 found in two
 * interfaces at once.
 *
 * `field` is typed `keyof BuyerValues` rather than the plan's bare `string`. The plan's own error
 * keys are dotted (`buyer.name`) and its values are flat (`name`), so a `string` here is two
 * vocabularies wearing one type and the container is one typo away from writing a `buyer.name`
 * property onto its form state and never noticing.
 *
 * THE CPF FIELD IS GONE — spec decision 3 — which takes the prototype's four fields down to
 * three in a `repeat(auto-fit,minmax(180px,1fr))` grid. Four wrapped 2x2 at every width; three
 * wrap 2+1, and the ragged half-width leftover lands on the phone at exactly the widths the
 * checkout's own two-column page produces (the left column is around 560px on a 1280px page, and
 * three 180px columns need 576px). The full name spans the row instead — which is the rule
 * section 02 already applies to the street, and which a name deserves on its own merits — leaving
 * e-mail and phone as a clean pair. Above 576px there is still one empty third column on the
 * second row; the prototype's own eight-field grid is ragged at the same widths, and the fix for
 * that is a media query the design explicitly does not have.
 */
export function CheckoutBuyerSection({ values, errors, onChange }: CheckoutBuyerSectionProps) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  return (
    <CheckoutSection id="checkout-buyer" tag={t('01 · Who is buying')}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <CheckoutField
          wide
          id="buyer-name"
          label={t('Full name')}
          value={values.name}
          error={errorFor('buyer.name')}
          onChange={(v) => onChange('name', v)}
        />
        <CheckoutField
          id="buyer-email"
          type="email"
          label={t('E-mail')}
          value={values.email}
          error={errorFor('buyer.email')}
          onChange={(v) => onChange('email', v)}
        />
        <CheckoutField
          id="buyer-phone"
          type="tel"
          label={t('Phone / WhatsApp')}
          value={values.phone}
          error={errorFor('buyer.phone')}
          onChange={(v) => onChange('phone', v)}
        />
      </div>
    </CheckoutSection>
  )
}
