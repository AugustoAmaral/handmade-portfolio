import { MAX_TRACKING_CODE } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { FieldLabel, PillButton, TextInput } from '../primitives'

/**
 * Why a dispatch was refused, in the two shapes that reach the browser.
 *
 * `invalid-transition` is the API's `409 INVALID_TRANSITION`, decided by `canTransition`. It is
 * reachable even though `OrderDetail` consults the same table before offering this form: the order
 * it consulted came from a list that is a snapshot, and one dispatched from another tab is already
 * `shipped` by the time this PATCH lands.
 *
 * A CODE AND NOT A SENTENCE, for the reason `LoginCard` states: the container that fills this prop
 * lives outside `src/ui` and `test/copy.test.ts` scans only `src/ui`, so a sentence resolved in a
 * container is invisible to the scanner and a missing translation ships as fluent English.
 */
export type DispatchError = 'invalid-transition' | 'unavailable'

export interface TrackingInlineFormProps {
  /** The form is open. The trigger and the form are the same slot, so one is showing at a time. */
  editing: boolean
  value: string
  /** The PATCH is in flight. */
  pending?: boolean
  error?: DispatchError
  onOpen(): void
  onChange(value: string): void
  onConfirm(): void
  onCancel(): void
}

type Translate = ReturnType<typeof useTranslation>['t']

/**
 * Literal `t()` calls in a switch rather than a table keyed by `DispatchError`: the copy scan reads
 * keys out of call sites and pins the number of runtime-built ones in `src/ui` at exactly one, so a
 * lookup object would take both sentences out of the scan. `LoginCard` and `NoticePage` make the
 * same trade for the same reason.
 *
 * `unavailable` reuses the sentence the checkout already says when the API breaks. One failure, one
 * wording, wherever the reader meets it.
 */
function messageFor(error: DispatchError, t: Translate): string {
  switch (error) {
    case 'invalid-transition':
      return t('This order already moved on. Reload the panel.')
    case 'unavailable':
      return t('Something broke on my side. Try again in a moment.')
  }
}

const FIELD_ID = 'admin-tracking-code'

/**
 * `MAX_TRACKING_CODE` is mirrored onto the input as `maxLength` rather than validated after the
 * fact. Length is the
 * only way this field can be rejected, and the API's 400 would arrive as a zod `fieldErrors` entry
 * this component has no slot for — the container would have to flatten it into "algo quebrou do meu
 * lado", which is both wrong and unactionable. A Correios code is 13 characters, so the cap is
 * never met in practice; what it removes is a failure mode that could only have been reported
 * badly.
 */

/**
 * THE ONLY STATUS CHANGE THE ADMIN CAN MAKE, as a two-step (spec:206): the pill reveals the form,
 * and confirming inside it is what sends `PATCH /api/admin/orders/:id`. `{ status: 'shipped' }` is
 * the literal the body schema accepts and the only one — there is no mark-as-paid, no undo and no
 * revert anywhere in this API, which is why nothing here offers one.
 *
 * INVENTED, NOT TRANSCRIBED. The design has the pill and nothing else: no field, no label, no
 * carrier picker, no validation, and no handler behind the pill at all — it and `Responder por
 * e-mail` are the only two hoverable things in the admin with nothing attached. The tracking code
 * exists in the prototype solely as the baked string `Correios SEDEX · rastreio BR8841200SC`.
 *
 * A BLANK CODE IS THE ORDINARY CASE AND IS NOT BLOCKED. The API parses `trackingCode` as
 * `z.string().trim().min(1).max(60).optional()`, which means ABSENT rather than empty: sending `''`
 * 400s a shipment that is otherwise legal, and blank is what a parcel handed over in person has.
 * The trim-and-omit itself belongs to `useMarkShipped`, which already does it and documents why;
 * repeating it here would be the second copy of a rule this branch has paid for twice already. What
 * this layer owes is the affordance — a field that is allowed to be empty and a submit that is
 * allowed to fire.
 *
 * THE FORM IS THE ONLY THING GUARDING THE DOUBLE SEND. There is no second `pending` check inside
 * `onConfirm`, following the measurement `LoginCard` made: implicit submission looks for the form's
 * default button, and a disabled default button means the form is not submitted at all. A guard
 * that no story can reach is dead code, and its absence is what makes `Pending` an assertion rather
 * than a formality.
 *
 * WHAT IT CANNOT DO, and it is the API's shape rather than an omission here: a tracking code can
 * only be set BY the dispatch. `paid → shipped` is the one transition allowed and a second PATCH on
 * a shipped order is a 409, so a code typed wrongly, or left out and found later, cannot be
 * corrected from this panel at all.
 */
export function TrackingInlineForm({
  editing,
  value,
  pending = false,
  error,
  onOpen,
  onChange,
  onConfirm,
  onCancel,
}: TrackingInlineFormProps) {
  const { t } = useTranslation()

  return (
    // `w-full` while open so the field takes the row rather than squeezing in beside the mailto
    // pill; closed, the trigger is one pill among two and sits where the design draws it.
    <div className={`flex flex-col gap-3 ${editing ? 'w-full' : ''}`}>
      {editing ? (
        <form
          aria-label={t('Mark as shipped')}
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            onConfirm()
          }}
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <FieldLabel htmlFor={FIELD_ID}>{t('Tracking code (optional)')}</FieldLabel>
            {/* Focus moves in as the form mounts, because the trigger that was just pressed is
                gone and focus would otherwise land on the body. The FIELD and not the confirm
                button: the next thing to do is type, and Enter submits from here anyway.

                The field stays enabled while the PATCH is in flight. Disabling a focused input
                moves focus away from it, and this request answers in a few hundred milliseconds. */}
            <TextInput id={FIELD_ID} value={value} autoFocus maxLength={MAX_TRACKING_CODE} onChange={onChange} />
          </div>
          <div className="flex flex-wrap gap-3">
            {/* The name does not change while pending, following `OrderSummaryPanel`: a disabled
                button is dropped from the accessibility tree by some screen readers, so a swapped
                label may never be read, and a control that renames itself is one a voice-control
                user can no longer ask for. The live region below says it instead.

                Cancel is disabled too. The PATCH has already left and closing the form would not
                recall it; an order that changes a second after the form was dismissed is worse
                than a control that is briefly unavailable. */}
            <PillButton type="submit" disabled={pending}>
              {t('Confirm')}
            </PillButton>
            <PillButton variant="outline" disabled={pending} onClick={onCancel}>
              {t('Cancel')}
            </PillButton>
          </div>
        </form>
      ) : (
        <PillButton onClick={onOpen}>{t('Mark as shipped')}</PillButton>
      )}

      {/*
        ALWAYS RENDERED, EMPTY OR NOT, and it was NOT — which made this region the one part of the
        pending story that could not work. A live region has to be on the page before its content
        changes or a reader is told nothing, and one that mounts already holding its message is the
        silent version; `AdminProductFormPage` and `PhotosEditor` both write that rule down and both
        obey it. Mounted only while `pending`, this said the right words to nobody, and no assertion
        available here could tell the difference: `getByRole('status')` finds the element either
        way. `empty:hidden` would reintroduce the same bug through `display`, so the region stays in
        the flow at zero height and cancels the row's own gap instead.
      */}
      <p role="status" className="font-mono text-[11px] tracking-[0.04em] opacity-80 empty:-mt-3">
        {pending ? t('Marking as shipped…') : ''}
      </p>

      {/* Outside the branch on purpose: a container that closes the form on failure would otherwise
          swallow the only explanation of what happened. */}
      {error ? (
        <p role="alert" className="font-mono border-accent text-accent border-l-2 pl-3 text-[12px] leading-[1.5]">
          {messageFor(error, t)}
        </p>
      ) : null}
    </div>
  )
}
