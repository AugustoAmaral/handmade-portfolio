import { MAX_PHOTO_BYTES, type FieldErrors, type PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { FieldLabel, ImageFrame, SectionRule, TextInput } from '../primitives'
import { useFieldError } from '../shop/CheckoutSection'
import type { LocalizedDraft } from './ProductLocalizedFields'

/**
 * One photo as the form holds it.
 *
 * `key` IS THE R2 KEY AND IT IS REAL IDENTITY, which the spec rows next door do not have: the API
 * hands it back with every photo, the DELETE takes it in the query string and the PUT matches on
 * it. Nothing here has to be minted.
 *
 * `alt` IS A PAIR AND NEVER A PARTIAL. It is `optionalLocalizedTextSchema`, so `pt` and `en` are
 * both REQUIRED keys even though empty strings are allowed — `{ pt: 'x' }` alone is a ZodError
 * about a field that is optional, the same trap `subtitle` set for Task 4.
 */
export interface PhotoDraft {
  key: string
  url: string
  alt: LocalizedDraft
}

/** Why a file was refused before anything was sent. */
export type PhotoProblem = 'too_large' | 'wrong_type'

export interface PhotoRejection {
  name: string
  problem: PhotoProblem
}

export interface PhotosEditorProps {
  values: PhotoDraft[]
  /**
   * Absent while the product has never been saved. There is no `/api/admin/products/:id/photos` to
   * post to and no id to build an R2 key from, so the picker says so instead of failing (spec:204).
   */
  productId?: string
  /**
   * The key of the photo whose ✕ is waiting for its second press. A key and not an index, and one
   * at a time: two half-finished deletions open is two chances to confirm the wrong one.
   */
  confirmingDeleteKey?: string
  /** A POST is in flight. The design draws no pending state for the slowest thing in the panel. */
  uploading?: boolean
  /** The last file this component refused, echoed back by the container so it can be read. */
  rejected?: PhotoRejection
  /** Keyed as zod paths over the PUT's array: `photos.0.alt.pt`. */
  errors: FieldErrors
  /** Alt edits and reordering — the two things the product's own PUT carries. */
  onChange(values: PhotoDraft[]): void
  /** A file that passed the checks below. The POST is the container's. */
  onAddPhoto(file: File): void
  onRejectFile(rejection: PhotoRejection): void
  onAskDelete(photo: PhotoDraft): void
  onCancelDelete(): void
  onConfirmDelete(photo: PhotoDraft): void
}

/**
 * What `toWebp` can decode with the sharp build the API ships. HEIC is deliberately NOT here: it is
 * what an iPhone hands over, and sharp cannot read it without libheif, so it is better refused with
 * a sentence than posted for a 500.
 */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * THE ONLY WAY THIS PANEL CAN SAY ANYTHING TRUE ABOUT A FAILED UPLOAD. multer has no `fileFilter`,
 * so an oversized file throws a `MulterError`, which is neither an `AppError` nor a `ZodError`, and
 * the API's error handler falls through to a bare `500 INTERNAL`; a file sharp cannot decode passes
 * multer and dies inside `toWebp`, also a 500. Both of the two likeliest failures arrive
 * unlabelled, so waiting for the response could only ever produce "algo quebrou do meu lado" about
 * a photo that was simply too big.
 *
 * `accept` ON THE INPUT IS A HINT TO THE FILE PICKER AND NOT A GUARD — drag and drop, "All files"
 * in the dialog and several mobile pickers ignore it — which is why the same rule is also code.
 */
export function photoProblem(file: File): PhotoProblem | undefined {
  if (!PHOTO_TYPES.includes(file.type)) return 'wrong_type'
  // `>=` AND NOT `>`, which is a one-byte difference and was a real one. multer refuses a file of
  // exactly `MAX_PHOTO_BYTES` — measured against the real route — so `>` left a single size the
  // browser waved through and the server answered with an unexplainable 500.
  if (file.size >= MAX_PHOTO_BYTES) return 'too_large'
  return undefined
}

/** Copies rather than aliases the product's pairs: the fixtures are deep-frozen and a draft is edited. */
export function photosFromProduct(product: PublicProduct): PhotoDraft[] {
  return product.photos.map((photo) => ({ key: photo.key, url: photo.url, alt: { ...photo.alt } }))
}

/**
 * What the product's PUT carries. `products.ts:50` refuses the update unless this array lists every
 * existing key EXACTLY ONCE — same length, no duplicates, no unknown keys — because adding goes
 * through the multipart POST and removing through the DELETE, so anything else would orphan an R2
 * object. Mapping the draft straight across is what keeps that true; the container must reseed the
 * draft from the product each endpoint answers with, or the next save is a 400 about photos.
 *
 * `alt` is always sent. Omitting it preserves what is stored, which is a different request from
 * this one — the draft's alt is what the person just typed.
 */
export function photosForSubmit(values: readonly PhotoDraft[]): { key: string; alt: LocalizedDraft }[] {
  return values.map((photo) => ({ key: photo.key, alt: { ...photo.alt } }))
}

const HEADING_ID = 'admin-photos-heading'
const FILE_ID = 'admin-photo-file'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** The design's underlined mono action. It is a `<label>`, so the ring hangs on the input inside. */
const ADD = 'font-mono border-ink cursor-pointer border-b text-[11px] uppercase tracking-[0.08em]'

/**
 * 24px around a 13–14px glyph, which the design does not draw: its controls are 20px spans, and
 * WCAG 2.2 SC 2.5.8 asks 24×24 of a target that qualifies for no spacing exception. Nothing in the
 * gate measures target size, so the stories do.
 */
const ICON = `flex size-6 shrink-0 items-center justify-center disabled:opacity-40 ${FOCUS}`

const ACTION = `font-mono text-[11px] uppercase tracking-[0.06em] ${FOCUS}`

const NOTE = 'font-mono text-[11px] tracking-[0.04em]'

/**
 * The photos section: one card per uploaded photo, with the upload, the order and the alt text.
 *
 * IT IS NOT EDITING A DRAFT, and that is the fact Task 8 most needs from this file. Adding and
 * removing a photo are IMMEDIATE server calls — the POST stores an object in R2 and the DELETE
 * removes one as it answers, both returning the whole product — while the ORDER and the ALT text
 * ride along with the product's own PUT. So the list is a live view of what the server holds, and
 * the container has to reseed it from every photo response or the next save is a 400 keyed
 * `{ photos: ['must_match_existing'] }`.
 *
 * `Foto principal` IS POSITIONAL. There is no flag on a photo saying it is the main one; index 0
 * is. So reordering is the only way to change a piece's shopfront image, and the design draws no
 * way to reorder — no handles, no toggle, nothing. Two buttons rather than a drag: a drag needs
 * pointer state and a handle on a node, neither of which this layer may hold, and buttons are the
 * accessible affordance rather than the fallback.
 *
 * KEYED BY `photo.key`, which is real identity and needs no invention — the opposite of the spec
 * rows, where the row count has to stand in for it.
 *
 * DELETING IS THE ONE DESTRUCTIVE ACT HERE and it follows Task 3's shape exactly: inline two-step,
 * `autoFocus` on the confirmation, the question wired as `aria-describedby` so it is announced
 * once, with the control it belongs to. Not a modal — a dialog needs a focus trap, focus
 * restoration and an Escape handler, all of them browser APIs this layer may not touch.
 *
 * THE 65% SITS ON THE LABEL AND NOT ON THE CARD HEADER. The design puts `opacity:.6` on the whole
 * header row and then writes `opacity:1` on the ✕ to bring it back, which is not a thing CSS can
 * do: `opacity` composites the subtree as a group, so that ✕ is accent at an effective 0.6 —
 * 2.66:1 on paper, failing AA on the control that deletes a photo. Dimming the word alone keeps
 * every control full strength, which is the call `ProductBasicsFields` already made for its
 * checkbox.
 */
export function PhotosEditor({
  values,
  productId,
  confirmingDeleteKey,
  uploading = false,
  rejected,
  errors,
  onChange,
  onAddPhoto,
  onRejectFile,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: PhotosEditorProps) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  const locked = !productId || uploading

  const swap = (from: number, to: number) => {
    const next = [...values]
    next[from] = values[to]!
    next[to] = values[from]!
    onChange(next)
  }

  const message = rejected
    ? rejected.problem === 'too_large'
      ? t('“{{name}}” is over {{max}} MB. Send a smaller photo.', { name: rejected.name, max: MAX_PHOTO_BYTES / 1024 / 1024 })
      : t('I cannot read “{{name}}”. Send a JPEG, PNG or WebP.', { name: rejected.name })
    : uploading
      ? t('Sending the photo…')
      : ''

  return (
    <section aria-labelledby={HEADING_ID}>
      <SectionRule
        id={HEADING_ID}
        className="mb-[18px]"
        action={
          <span className={`relative has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent`}>
            <label htmlFor={FILE_ID} className={ADD}>
              <span aria-hidden="true">+</span> {t('Add photo')}
            </label>
            {/*
              A real file input, visually hidden but still focusable and still the thing the label
              points at — `sr-only` clips it rather than removing it, so Tab reaches it and the
              browser opens its own picker. A `<label>` styled as a button is not focusable on its
              own, and giving one a tabindex would announce a label as a control.

              The value is cleared after every pick: without that, choosing the SAME file twice
              fires no change event at all, which is exactly what somebody does after an upload
              fails.
            */}
            <input
              id={FILE_ID}
              type="file"
              accept={PHOTO_TYPES.join(',')}
              disabled={locked}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                const problem = photoProblem(file)
                if (problem) onRejectFile({ name: file.name, problem })
                else onAddPhoto(file)
              }}
            />
          </span>
        }
      >
        {t('Photos')}
      </SectionRule>

      {/*
        ALWAYS RENDERED, EMPTY OR NOT. A live region has to exist before its content changes or
        nothing is announced, and one that mounts already holding its message is the version that
        stays silent. Empty it has no height and no margin.
      */}
      <p role="status" className={`${NOTE} mb-3 empty:mb-0 ${rejected ? 'text-accent' : 'opacity-65'}`}>
        {message}
      </p>

      {/* The reason a disabled control is disabled, as a visible sentence rather than a description
          on the control: a disabled control cannot be focused, so it cannot carry an
          `aria-describedby` to anybody. `CartLine` made the same call at the per-item cap. The
          English is the spec's (line 204); the Portuguese is invented and is owed back. */}
      {productId ? null : <p className={`${NOTE} opacity-65`}>{t('Save the product first to add photos.')}</p>}

      {values.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[clamp(14px,2vw,22px)]">
          {values.map((photo, index) => {
            const name = index === 0 ? t('Main photo') : t('Photo {{index}}', { index: index + 1 })
            const base = `admin-photo-${index}`
            const questionId = `${base}-question`
            const confirming = confirmingDeleteKey === photo.key

            return (
              <div key={photo.key} className="border-ink flex flex-col gap-3 border p-3.5">
                <div className="font-mono flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em]">
                  <span className="min-w-0 truncate opacity-65">{name}</span>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`${t('Move up')}, ${name}`}
                      disabled={index === 0}
                      className={ICON}
                      onClick={() => swap(index, index - 1)}
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${t('Move down')}, ${name}`}
                      disabled={index === values.length - 1}
                      className={ICON}
                      onClick={() => swap(index, index + 1)}
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                    {confirming ? null : (
                      <button
                        type="button"
                        aria-label={`${t('Delete')}, ${name}`}
                        className={`text-accent text-sm ${ICON}`}
                        onClick={() => onAskDelete(photo)}
                      >
                        {/* The glyph is hidden and the word is the name. `color-contrast` skips
                            single-character text as a suspected icon ligature, so nothing in the
                            gate is looking at this button — the story measures it by hand. */}
                        <span aria-hidden="true">✕</span>
                      </button>
                    )}
                  </div>
                </div>

                {confirming ? (
                  <>
                    <p id={questionId} className="text-accent font-mono text-[11px] uppercase tracking-[0.06em]">
                      {t('Delete for good?')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        autoFocus
                        aria-label={`${t('Yes, delete')}, ${name}`}
                        aria-describedby={questionId}
                        className={`border-accent text-accent border-b ${ACTION}`}
                        onClick={() => onConfirmDelete(photo)}
                      >
                        {t('Yes, delete')}
                      </button>
                      <button
                        type="button"
                        aria-label={`${t('Cancel')}, ${name}`}
                        className={ACTION}
                        onClick={onCancelDelete}
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </>
                ) : null}

                {/* Decorative HERE and nowhere else: the card is already named, and the alt text is
                    the thing being edited two boxes below rather than a description of a picture
                    standing on its own. */}
                <ImageFrame src={photo.url} alt="" />

                <div className="flex flex-col gap-[7px]">
                  <FieldLabel htmlFor={`${base}-alt-pt`}>{t('Alt (PT)')}</FieldLabel>
                  <TextInput
                    id={`${base}-alt-pt`}
                    value={photo.alt.pt}
                    label={`${t('Alt (PT)')}, ${name}`}
                    placeholder={t('Image description (PT)')}
                    error={errorFor(`photos.${index}.alt.pt`)}
                    onChange={(text) => onChange(values.map((p, n) => (n === index ? { ...p, alt: { ...p.alt, pt: text } } : p)))}
                  />
                </div>

                <div className="flex flex-col gap-[7px]">
                  <FieldLabel htmlFor={`${base}-alt-en`}>{t('Alt (EN)')}</FieldLabel>
                  <TextInput
                    id={`${base}-alt-en`}
                    value={photo.alt.en}
                    label={`${t('Alt (EN)')}, ${name}`}
                    placeholder={t('Image description (EN)')}
                    error={errorFor(`photos.${index}.alt.en`)}
                    onChange={(text) => onChange(values.map((p, n) => (n === index ? { ...p, alt: { ...p.alt, en: text } } : p)))}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : productId ? (
        <p className={`${NOTE} opacity-65`}>{t('No photos yet.')}</p>
      ) : null}
    </section>
  )
}
