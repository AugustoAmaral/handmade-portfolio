import type { FieldErrors } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { FieldLabel, TextArea } from '../primitives'
import { CheckoutField, CheckoutSection, useFieldError } from './CheckoutSection'

export interface NotesValues {
  notes: string
  giftMessage: string
  referral: string
}

export interface CheckoutNotesSectionProps {
  values: NotesValues
  /** Keyed `notes`, `giftMessage`, `referral` — these are top-level fields of the request. */
  errors: FieldErrors
  onChange(field: keyof NotesValues, value: string): void
}

/**
 * Section 04. Everything here is optional in the schema, so the only errors it can ever show are
 * zod's length ceilings (1000 / 200 / 100 characters), which arrive as English prose and land in
 * the translation table's raw-message fallback.
 *
 * The prototype's two short strings are used as LABELS, not as placeholders. They read as labels
 * already, and reusing them is how the field keeps the design's words while gaining the permanent
 * name the design never gave it. The long notes sentence is the exception: it is a hint, not a
 * name, so it stays a placeholder above a short label.
 */
export function CheckoutNotesSection({ values, errors, onChange }: CheckoutNotesSectionProps) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  return (
    <CheckoutSection id="checkout-notes" tag={t('04 · About the order')}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <div className="col-span-full flex flex-col gap-2">
          <FieldLabel htmlFor="notes-notes">{t('Notes for me')}</FieldLabel>
          <TextArea
            id="notes-notes"
            value={values.notes}
            error={errorFor('notes')}
            placeholder={t('Notes for me: the subject of the letter, who it is for, deadlines, anything.')}
            onChange={(v) => onChange('notes', v)}
          />
        </div>
        <CheckoutField
          id="notes-gift-message"
          label={t('Is it a gift? Message on the card')}
          value={values.giftMessage}
          error={errorFor('giftMessage')}
          onChange={(v) => onChange('giftMessage', v)}
        />
        <CheckoutField
          id="notes-referral"
          label={t('How did you find me? (optional)')}
          value={values.referral}
          error={errorFor('referral')}
          onChange={(v) => onChange('referral', v)}
        />
      </div>
    </CheckoutSection>
  )
}
