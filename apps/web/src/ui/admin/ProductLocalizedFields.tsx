import type { FieldErrors, PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { FieldLabel, SectionRule, TextArea, TextInput } from '../primitives'
import { useFieldError } from '../shop/CheckoutSection'

/**
 * BOTH KEYS, ALWAYS, and that is the point of the type rather than a convenience. `subtitle` in
 * `productInputSchema` carries `.default({ pt: '', en: '' })`, and a default only fires when the
 * whole field is ABSENT: `{ pt: 'x' }` is `subtitle.en: Required`, because the two keys are
 * required even though empty strings are allowed. A draft that models a half-filled subtitle as a
 * half-filled object is a 400 the person filling the form cannot read.
 */
export interface LocalizedDraft {
  pt: string
  en: string
}

export interface ProductLocalizedValues {
  name: LocalizedDraft
  subtitle: LocalizedDraft
  description: LocalizedDraft
}

export interface ProductLocalizedFieldsProps {
  values: ProductLocalizedValues
  /** Keyed as zod paths: `name.pt`, `subtitle.en`, `description.pt`, … */
  errors: FieldErrors
  onChange(values: ProductLocalizedValues): void
}

/** Copies rather than aliases the product's pairs: the fixtures are deep-frozen and a draft is edited. */
export function localizedFromProduct(product: PublicProduct): ProductLocalizedValues {
  return {
    name: { ...product.name },
    subtitle: { ...product.subtitle },
    description: { ...product.description },
  }
}

export const EMPTY_LOCALIZED: ProductLocalizedValues = {
  name: { pt: '', en: '' },
  subtitle: { pt: '', en: '' },
  description: { pt: '', en: '' },
}

/**
 * One column. Its three labels are keyed with the language they belong to — `Name (PT)` and
 * `Name (EN)` — which is the whole shape of the fix; see the note on the component below.
 *
 * The heading is `SectionRule`: full-strength ink and NOT the checkout section's `opacity-65`.
 * That 65% was a correction of a `.55` the shop's prototype used for a muted tag; this heading is
 * drawn at full strength in the design and needs no correcting. It was an inlined class string
 * here until Task 5 needed the same header twice more and hoisted it into the primitive.
 */
function LocalizedColumn({
  column,
  values,
  errors,
  onEdit,
}: {
  column: 'pt' | 'en'
  values: ProductLocalizedValues
  errors: FieldErrors
  onEdit(field: keyof ProductLocalizedValues, value: string): void
}) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  const portuguese = column === 'pt'
  const headingId = `product-${column}-heading`
  const nameId = `product-name-${column}`
  const subtitleId = `product-subtitle-${column}`
  const descriptionId = `product-description-${column}`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <SectionRule id={headingId}>{portuguese ? t('Portuguese') : t('English')}</SectionRule>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={nameId}>{portuguese ? t('Name (PT)') : t('Name (EN)')}</FieldLabel>
        <TextInput
          id={nameId}
          value={values.name[column]}
          error={errorFor(`name.${column}`)}
          onChange={(v) => onEdit('name', v)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={subtitleId}>{portuguese ? t('Subtitle (PT)') : t('Subtitle (EN)')}</FieldLabel>
        <TextInput
          id={subtitleId}
          value={values.subtitle[column]}
          error={errorFor(`subtitle.${column}`)}
          onChange={(v) => onEdit('subtitle', v)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={descriptionId}>
          {portuguese ? t('Description (PT)') : t('Description (EN)')}
        </FieldLabel>
        <TextArea
          id={descriptionId}
          rows={6}
          value={values.description[column]}
          error={errorFor(`description.${column}`)}
          onChange={(v) => onEdit('description', v)}
        />
      </div>
    </section>
  )
}

/**
 * The two language columns of the product form: name, subtitle and description, twice.
 *
 * THE KEY COLLISION, AND WHY IT IS A SHAPE RATHER THAN A WORKAROUND. The design labels each column
 * in the language of the column — `Nome` on the left, `Name` on the right — and on this project a
 * key IS the English sentence, one instance. `Nome` and `Name` are not translations of each other;
 * they are two different fields, and keying both as `Name` would put one entry in `pt.json` and
 * label both columns identically the moment the panel renders in English. The design already
 * carries the answer in its own photo cards, which say `Alt (PT)` and `Alt (EN)`: the language
 * goes in the KEY. `Name (PT)` translates to `Nome` and `Name (EN)` translates to `Name`, so the
 * Portuguese panel is pixel-identical to the design and the English one reads unambiguously.
 *
 * THE COLUMN HEADINGS KEEP THE DESIGN'S ENDONYMS on purpose, so `English` is `English` in both
 * languages. The column is an island of one language — its labels and everything that will ever
 * be typed into it — and naming it in that language is the fact the reader needs. It is
 * the one string in the panel whose Portuguese entry is deliberately identical to its key.
 *
 * EACH COLUMN IS A NAMED REGION, which is what carries the disambiguation for a reader who never
 * sees the two-column layout: the Portuguese panel has a field called `Nome` and a field called
 * `Name` sitting beside each other, and the heading each one lives under is the thing that says
 * which is which. It is the argument the checkout's five sections already made, in a form that is
 * even longer.
 *
 * NO `lang` PROP, checked rather than assumed. Nothing here formats a price or reads a bilingual
 * value out of the catalogue — the fields ARE the bilingual value, and which half goes in which
 * column is the column's own business, not the panel's language.
 *
 * NO SUBTITLE PLACEHOLDERS. The design puts `Papel algodão · 2 folhas` under the PT subtitle and
 * `Cotton paper · 2 sheets` under the EN one. Those examples belong to the COLUMN's language, and
 * a key resolved by the provider follows the READER's, so a single key paints the Portuguese
 * example in both boxes. Two suffixed keys per example would be four entries in `pt.json` to
 * carry two hints, one of which never translates. The labels and the headings already say what
 * goes in each box.
 */
export function ProductLocalizedFields({ values, errors, onChange }: ProductLocalizedFieldsProps) {
  const edit = (column: 'pt' | 'en', field: keyof ProductLocalizedValues, value: string) =>
    onChange({ ...values, [field]: { ...values[field], [column]: value } })

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[clamp(20px,3vw,36px)]">
      <LocalizedColumn
        column="pt"
        values={values}
        errors={errors}
        onEdit={(field, value) => edit('pt', field, value)}
      />
      <LocalizedColumn
        column="en"
        values={values}
        errors={errors}
        onEdit={(field, value) => edit('en', field, value)}
      />
    </div>
  )
}
