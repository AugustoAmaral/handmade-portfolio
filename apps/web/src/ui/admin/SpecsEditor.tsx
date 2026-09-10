import { MAX_SPECS, type FieldErrors, type PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { SectionRule, TextInput } from '../primitives'
import { useFieldError } from '../shop/CheckoutSection'
import type { LocalizedDraft } from './ProductLocalizedFields'

/**
 * One row of the ficha técnica. FOUR REQUIRED NON-EMPTY STRINGS, which is the fact everything
 * below is arranged around: `specSchema` is `{ key: localizedTextSchema, value: localizedTextSchema }`
 * and `localizedTextSchema` is `.min(1)` on both halves.
 */
export interface SpecDraft {
  key: LocalizedDraft
  value: LocalizedDraft
}

export interface SpecsEditorProps {
  values: SpecDraft[]
  /** Keyed as zod paths over the SUBMITTED array: `specs.0.key.pt`. See `submitIndexes`. */
  errors: FieldErrors
  onChange(values: SpecDraft[]): void
}

export const EMPTY_SPEC: SpecDraft = { key: { pt: '', en: '' }, value: { pt: '', en: '' } }

/** Copies rather than aliases: the fixtures are deep-frozen and a draft is edited. */
export function specsFromProduct(product: PublicProduct): SpecDraft[] {
  return product.specs.map((spec) => ({ key: { ...spec.key }, value: { ...spec.value } }))
}

/**
 * A row nobody has typed in. Trimmed, because a stray space is not content and a row holding one
 * would otherwise be kept and then rejected for the three boxes that are still empty.
 */
export function isBlankSpec(spec: SpecDraft): boolean {
  return [spec.key.pt, spec.key.en, spec.value.pt, spec.value.en].every((text) => text.trim() === '')
}

/**
 * What the container sends. WHOLLY BLANK ROWS ARE DROPPED and half-filled ones are not.
 *
 * Adding a row is a gesture for starting to type, not an assertion that a spec exists — and the
 * design seeds a brand-new product with exactly one blank row, so the other answer makes every new
 * product unsaveable the moment it opens, with four errors about a row nobody touched. A row with
 * something in it is the opposite case: somebody typed there, and dropping typed content silently
 * is worse than an error naming the boxes still empty.
 */
export function specsForSubmit(values: readonly SpecDraft[]): SpecDraft[] {
  return values.filter((spec) => !isBlankSpec(spec))
}

/**
 * Display row → the index that row will have in the SUBMITTED array, or `null` for one that will
 * not be sent. Dropping blank rows renumbers every zod path behind them: a blank row at display 2
 * makes display 3 into `specs.2.…`, and a component that read its own index would paint that row's
 * errors on the row above it or on nothing at all.
 */
export function submitIndexes(values: readonly SpecDraft[]): (number | null)[] {
  let next = 0
  return values.map((spec) => (isBlankSpec(spec) ? null : next++))
}

const HEADING_ID = 'admin-specs-heading'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** The design's underlined mono action, as a real button. `disabled:opacity-50` is `PillButton`'s. */
const ADD = `font-mono border-ink border-b text-[11px] uppercase tracking-[0.08em] disabled:opacity-50 ${FOCUS}`

/**
 * A 24px box around a 14px glyph. The design draws a 20px span, and WCAG 2.2 SC 2.5.8 asks 24×24
 * of a target that qualifies for no spacing exception — this one deletes four fields. Nothing in
 * the gate measures target size, so the story does.
 */
const REMOVE = `text-accent ml-auto flex size-6 shrink-0 items-center justify-center text-sm ${FOCUS}`

/** Half a row: two boxes side by side under one language. */
const HALF = 'grid min-w-[240px] flex-1 grid-cols-2 gap-2.5'

/**
 * The ficha técnica editor: a list of bilingual key/value pairs, stateless like everything in this
 * layer, with the draft held by Task 8's container.
 *
 * KEYED BY THE ROW COUNT AND THE INDEX, WHICH IS NOT THE BUG THE PLAN PREDICTED. The plan says
 * rows need synthetic identity because deleting row 2 clears row 3's text; that is the
 * UNCONTROLLED-input version, and these boxes are controlled from props, so a reused node still
 * paints the right value — measured, in `DeletingAMiddleRowMovesNoText`. What actually survives a
 * deletion under a bare index key is the CONTROL: the ✕ that was clicked stays focused and
 * silently starts pointing at the next row, so the following Space — the key that scrolls a page —
 * deletes another one. Identity would fix that and cannot live here, because minting ids is state;
 * it would have to arrive in the prop type and be maintained by the container forever. The row
 * count in the key costs nothing and is enough: no control survives a deletion. Typing does not
 * change the count, so a caret is never disturbed mid-word.
 *
 * WHAT IS LEFT OVER, and it is not this layer's to fix: after a deletion focus lands on nothing.
 * Moving it needs a handle on a node, which `src/ui` may not hold.
 *
 * EVERY BOX IS NAMED AFTER ITS ROW, and the row's name is its POSITION. Task 3 could name a
 * control by composing its visible word with the row header it sits in; a spec row has no header
 * at all — it is identified only by a key box whose value may be empty, and on a new row all four
 * are. Position is what the person sees and what the photo cards beside this section already use.
 * The name is built by prefixing the field's own word, so the visible placeholder is contained in
 * the spoken name and SC 2.5.3 holds; `Stepper` carries the same prop for the same reason.
 *
 * NO CONFIRMATION ON ✕, unlike the products table and the photo cards. Those two reach the API the
 * moment they are pressed — a row here edits a draft that has not left the browser, and it is four
 * short strings that can be typed again. The two-step is reserved for what cannot be undone.
 */
export function SpecsEditor({ values, errors, onChange }: SpecsEditorProps) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  const submitAt = submitIndexes(values)
  const atCap = values.length >= MAX_SPECS

  const edit = (index: number, field: keyof SpecDraft, column: 'pt' | 'en', text: string) =>
    onChange(
      values.map((spec, n) => (n === index ? { ...spec, [field]: { ...spec[field], [column]: text } } : spec)),
    )

  return (
    <section aria-labelledby={HEADING_ID}>
      <SectionRule
        id={HEADING_ID}
        className="mb-4"
        action={
          <button type="button" disabled={atCap} className={ADD} onClick={() => onChange([...values, EMPTY_SPEC])}>
            <span aria-hidden="true">+</span> {t('Add row')}
          </button>
        }
      >
        {t('Data · key and value')}
      </SectionRule>

      {/* The reason a disabled control is disabled, as a visible sentence rather than as a
          description on the control: a disabled button cannot be focused, so it cannot carry an
          `aria-describedby` to anybody. `CartLine` made the same call at the per-item cap. */}
      {atCap ? (
        <p className="font-mono mb-3 text-[11px] tracking-[0.04em] opacity-65">
          {t('Maximum {{max}} rows.', { max: MAX_SPECS })}
        </p>
      ) : null}

      {values.length > 0 ? (
        <>
          {/* Visual only, and deliberately so: they describe two columns, and what a reader needs
              is which BOX they are in. That is in each box's own name. */}
          <div className="font-mono mb-3 flex flex-wrap gap-[clamp(16px,3vw,36px)] text-[10px] uppercase tracking-[0.16em] opacity-65">
            <span className="min-w-[240px] flex-1">{t('Portuguese')}</span>
            <span className="min-w-[240px] flex-1">{t('English')}</span>
            <span className="w-6" />
          </div>

          <div className="flex flex-col gap-3">
            {values.map((spec, index) => {
              const rowName = t('Row {{index}}', { index: index + 1 })
              const submitIndex = submitAt[index]
              const path = (field: string) => (submitIndex === null ? '' : `specs.${submitIndex}.${field}`)
              const base = `admin-spec-${index}`
              const hintId = `${base}-blank`
              const blank = isBlankSpec(spec)

              const box = (field: keyof SpecDraft, column: 'pt' | 'en', word: string) => (
                <div className="flex flex-col">
                  <TextInput
                    id={`${base}-${field}-${column}`}
                    value={spec[field][column]}
                    label={`${word}, ${rowName}`}
                    placeholder={word}
                    error={errorFor(path(`${field}.${column}`))}
                    onChange={(text) => edit(index, field, column, text)}
                  />
                </div>
              )

              return (
                <div
                  key={`${values.length}-${index}`}
                  role="group"
                  aria-label={rowName}
                  // The condition is redundant and is kept anyway: the paragraph it points at is
                  // itself only rendered for a blank row, so an unconditional reference resolves
                  // to nothing on a filled one and no test on this branch can tell the two apart
                  // (axe does not fail a dangling `aria-describedby` either). A reference to an id
                  // that is not in the document is still the wrong thing to ship.
                  aria-describedby={blank ? hintId : undefined}
                  className="flex flex-wrap items-center gap-[clamp(16px,3vw,36px)]"
                >
                  <div className={HALF}>
                    {box('key', 'pt', t('Key (PT)'))}
                    {box('value', 'pt', t('Value (PT)'))}
                  </div>
                  <div className={`${HALF} border-ink/25 border-l pl-[clamp(12px,2vw,24px)]`}>
                    {box('key', 'en', t('Key (EN)'))}
                    {box('value', 'en', t('Value (EN)'))}
                  </div>

                  <button
                    type="button"
                    aria-label={`${t('Delete')}, ${rowName}`}
                    className={REMOVE}
                    onClick={() => onChange(values.filter((_, n) => n !== index))}
                  >
                    {/* The glyph is hidden and the word is the name. `color-contrast` skips
                        single-character text as a suspected icon ligature, so nothing in the gate
                        is looking at this button — the story measures it by hand. */}
                    <span aria-hidden="true">✕</span>
                  </button>

                  {blank ? (
                    <p id={hintId} className="font-mono w-full text-[11px] tracking-[0.04em] opacity-65">
                      {t('Blank rows are not saved.')}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </section>
  )
}
