import type { FieldErrors } from '@shop/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FieldLabel, TextInput } from '../primitives'

/**
 * The three things all five checkout sections share, in one place: the ruled section header, the
 * label+input pair, and the table that turns an error code into a sentence.
 *
 * NOT A PRIMITIVE, and that is a decision rather than laziness. The ruled tag is the same shape as
 * the one `AboutBlocks` paints, and the obvious move is to lift it into `Eyebrow`. It cannot be
 * lifted: here the tag is the ONLY title its section has, so it is an `<h2>`, and Task 8 measured
 * that promoting the About tag to a heading reddens `heading-order` on that page — six headings
 * where three belong. A primitive that must emit a heading in one caller and must not in another
 * is a primitive whose correctness depends on its parent, which is the argument `AboutFacts`
 * already used to refuse building on `Stat`. So the shape lives beside its five callers instead,
 * and `Eyebrow` keeps one job.
 *
 * The prototype's tag is `opacity:.55`, which is 3.82:1 on paper against a 4.5:1 floor. 65% is
 * 5.26:1 and is what every other muted mono label on this branch settled on. Its 10px is
 * normalised to Eyebrow's 11px for the same reason `AboutBlocks` did it: three near-identical mono
 * labels a pixel apart is how they start drifting.
 *
 * The section is `aria-labelledby` its own heading, which makes it a named region. A checkout form
 * is long and five named regions is a real way to move through it; five unnamed `<section>`s are
 * not landmarks at all and buy nothing.
 */
export function CheckoutSection({ id, tag, children }: { id: string; tag: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-tag`}>
      <h2
        id={`${id}-tag`}
        className="font-mono border-ink mb-4 border-b pb-[10px] text-[11px] uppercase tracking-[0.18em] opacity-65"
      >
        {tag}
      </h2>
      {children}
    </section>
  )
}

/**
 * One labelled field. The prototype has no `<label>` anywhere and puts the field name in the
 * placeholder; the placeholder is gone the moment there is a character in the box, which is the
 * exact pattern the rebuild is here to replace. The label is visible and permanent, and
 * `placeholder` is left for the cases where there is a genuine hint to add on top of it.
 *
 * `wide` spans every column of whichever grid holds it. It is a layout fact about the field (a
 * street or a full name wants the row) and not about the grid, so it travels with the field.
 */
export function CheckoutField({
  id,
  label,
  value,
  onChange,
  error,
  type,
  placeholder,
  wide = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: 'text' | 'email' | 'tel'
  placeholder?: string
  wide?: boolean
}) {
  return (
    <div className={`flex flex-col gap-2 ${wide ? 'col-span-full' : ''}`}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <TextInput id={id} value={value} onChange={onChange} error={error} type={type} placeholder={placeholder} />
    </div>
  )
}

/**
 * THE TRANSLATION TABLE. One table, and the only one: `checkoutRules` emits stable codes
 * (`required`, `invalid_cep`, `not_allowed`, `invalid_state`, `not_available`), the API's own
 * failures arrive as codes too (`UNKNOWN_ITEM`, `OUT_OF_STOCK`, `STRIPE_UNAVAILABLE`, `VALIDATION`,
 * `INTERNAL`, from `apps/api/src/errors.ts` and `routes/checkout.ts`), and zod arrives as raw
 * English prose because `errorHandler` copies `issue.message` straight through.
 *
 * The default branch RENDERS the raw string rather than dropping it. That is deliberate and it is
 * the half that keeps this honest: a Portuguese buyer whose e-mail is malformed currently reads
 * "Invalid email", which is bad, and reading nothing at all next to a field outlined in accent is
 * worse. The real fix belongs upstream — the API giving zod issues codes the way it already gives
 * the cross-field rules codes — and until it does, the wrong-language sentence is the visible
 * symptom that keeps the bug on someone's list.
 *
 * The switch is spelled out rather than driven by a lookup object on purpose: `copy.test.ts` reads
 * keys out of literal call sites and pins the number of runtime-built ones at exactly one, so a
 * table indexed by code would take every sentence below out of the scan.
 */
export function useErrorMessage(): (code: string) => string {
  const { t } = useTranslation()
  return (code) => {
    switch (code) {
      case 'required':
        return t('This field is required.')
      case 'invalid_cep':
        return t('Enter a valid CEP, like 30150-904.')
      case 'not_allowed':
        return t('I do not ship to this country yet.')
      case 'invalid_state':
        return t('Use the two-letter state code, like MG.')
      case 'not_available':
        return t('This shipping option is not available for this address.')
      case 'UNKNOWN_ITEM':
        return t('One of the pieces left the catalogue. Go back to the bag and take it out.')
      case 'OUT_OF_STOCK':
        return t('I do not have enough of one of the pieces. Lower the quantity in the bag.')
      case 'STRIPE_UNAVAILABLE':
        return t('The payment provider did not answer. Try again in a moment.')
      case 'VALIDATION':
        return t('Check the fields marked above.')
      case 'INTERNAL':
        return t('Something broke on my side. Try again in a moment.')
      default:
        return code
    }
  }
}

/**
 * Field lookup over the same table. `FieldErrors` is `Record<string, string[]>` and every producer
 * on this branch pushes exactly one entry per key, but the array is the contract, so all of them
 * are rendered — dropping the tail would hide a second reason a field was rejected.
 */
export function useFieldError(errors: FieldErrors): (field: string) => string | undefined {
  const message = useErrorMessage()
  return (field) => {
    const codes = errors[field]
    return codes && codes.length > 0 ? codes.map(message).join(' ') : undefined
  }
}
