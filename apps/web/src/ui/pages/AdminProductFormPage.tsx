import type { FieldErrors } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import {
  PhotosEditor,
  type PhotosEditorProps,
  ProductBasicsFields,
  type ProductBasicsValues,
  ProductLocalizedFields,
  type ProductLocalizedValues,
  type SpecDraft,
  SpecsEditor,
} from '../admin'
import { Eyebrow, PillButton } from '../primitives'
import { routes } from '../routes'
import { useErrorMessage } from '../shop/CheckoutSection'

export interface AdminProductFormPageProps {
  /**
   * Absent while the product has never been saved. It decides three things at once: the header
   * tag, whether there is anything to delete, and whether photos can be uploaded at all — there is
   * no `/api/admin/products/:id/photos` without it and no id to build an R2 key from (spec:204).
   */
  productId?: string
  lang: 'pt' | 'en'
  /** One flat map for the whole form, keyed as zod paths: `slug`, `name.pt`, `specs.0.key.en`. */
  errors: FieldErrors
  basics: ProductBasicsValues
  localized: ProductLocalizedValues
  specs: SpecDraft[]
  /**
   * The photos section's whole contract, as a bag. It is a bag because it is a component's own
   * contract owned elsewhere, and because — unlike the three above — most of what is in it is not
   * the draft this form submits. See the note below.
   */
  photos: Omit<PhotosEditorProps, 'errors' | 'productId'>
  /** The PUT or POST is in flight. */
  saving?: boolean
  saved?: boolean
  /**
   * An API error CODE, not a sentence — `CheckoutPage`'s own shape, translated here through the
   * checkout's `useErrorMessage`. A container resolving the words would put them outside the only
   * directory `copy.test.ts` scans, so a missing translation would ship as fluent English.
   */
  saveError?: string
  confirmingDelete?: boolean
  /** The DELETE is in flight. */
  deleting?: boolean
  onBasicsChange(values: ProductBasicsValues): void
  onLocalizedChange(values: ProductLocalizedValues): void
  onSpecsChange(values: SpecDraft[]): void
  onSubmit(): void
  onAskDelete(): void
  onCancelDelete(): void
  onConfirmDelete(): void
}

const BAND =
  'border-ink px-gutter-admin flex flex-wrap items-end justify-between gap-5 border-b pt-[clamp(26px,4vw,44px)] pb-5'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** The design's underlined mono action, as a real button. Disabled controls are exempt from AA. */
const DESTRUCTIVE = `font-mono text-accent text-[11px] uppercase tracking-[0.06em] disabled:opacity-50 ${FOCUS}`

const TITLE_ID = 'admin-product-form-title'
const QUESTION_ID = 'admin-product-form-question'
const CONFIRM_ID = 'admin-product-form-confirm'
const CANCEL_ID = 'admin-product-form-cancel'

/**
 * The product form: five identifier fields, two language columns, the photos, the ficha técnica and
 * the action bar — the densest composition on the branch and the only screen in the panel that
 * composes four editors at once.
 *
 * ONE `<form>` WITH ITS SUBMIT INSIDE IT, which is `LoginCard`'s case and not the checkout's. The
 * checkout's button lives several components away in another grid column, so it had to quote the
 * form's id back through `form=`; here the action bar is the form's last child, so Enter in any
 * field submits with nothing wired for it. Every other control under this form is `type="button"`,
 * which is load-bearing rather than tidy: a `<button>` with no `type` defaults to `submit`, and
 * `PhotosEditor` and `SpecsEditor` put nine of them inside this element.
 *
 * THE PHOTOS SECTION IS NOT EDITING THE DRAFT, and this is the level that has to say so. Adding and
 * removing a photo are IMMEDIATE server calls that each answer with the whole product; only the alt
 * text and the ORDER ride along with the product's own PUT. So the section stays inside the form —
 * two thirds of it really is draft — and the sentence under it says which half is which, because a
 * form boundary announces nothing and `Cancelar` cannot put back a photo that is already gone.
 *
 * EVERY SECTION IS A PEER, WHICH IS THIS PAGE'S ANSWER AND NOT A PRECEDENT COPIED. `SectionRule`
 * grew a `level` for the order detail, whose blocks belong to one customer's order and nest under
 * their name. Nothing here nests: `Português` is not part of `Fotos`, and the `<h1>` below is the
 * only thing above any of them. Five headings is also what makes `heading-order` capable of firing
 * on this screen — it returns true at index 0 and needs three.
 *
 * `Cancelar` IS A LINK AND NOT A CALLBACK. It goes to the products table, which is a destination
 * rather than something that happens before navigating; the prototype's `cancelDraft` closes a
 * panel that in a routed app is a URL. It discards an edited draft with no confirmation, as the
 * design does: warning about unsaved work needs to intercept the page unloading, which is a browser
 * mechanism this layer may not reach for, and half a warning is worse than none.
 *
 * THE DESTRUCTIVE CONFIRMATION IS TASK 3's, unchanged: an inline two-step in the bar itself, the
 * confirm focused as it mounts, and the question wired as `aria-describedby` so it is announced
 * once with the control it belongs to. Not a modal — a dialog needs a focus trap, focus restoration
 * and an Escape handler, none of which this layer may hold. What it adds is a name: two controls on
 * this screen say `Cancelar` and they do opposite things, so the destructive one borrows the page's
 * title the way `ProductRow`'s borrows its row header, and the visible word stays the first half of
 * the spoken name.
 */
export function AdminProductFormPage({
  productId,
  lang,
  errors,
  basics,
  localized,
  specs,
  photos,
  saving = false,
  saved = false,
  saveError,
  confirmingDelete = false,
  deleting = false,
  onBasicsChange,
  onLocalizedChange,
  onSpecsChange,
  onSubmit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: AdminProductFormPageProps) {
  const { t } = useTranslation()
  const message = useErrorMessage()

  // The name in the panel's language, then in whichever language it has one, then the design's own
  // `Sem nome`. Reachable while editing, because the field can be cleared: the schema requires both
  // halves at `.min(1)`, so a SAVED product always has a name and only a draft in hand can lose it.
  const drafted = localized.name[lang] || localized.name.pt || localized.name.en
  const title = productId ? drafted || t('No name') : t('Add a product')
  const tag = productId ? t('Editing · {{slug}}', { slug: basics.slug }) : t('New product')

  return (
    <>
      <div className={BAND}>
        <div>
          <Eyebrow className="mb-2.5">{tag}</Eyebrow>
          <h1 id={TITLE_ID} className="font-display text-[clamp(30px,4vw,48px)] leading-none font-normal">
            {title}
          </h1>
        </div>
        {/* The design's note, verbatim and in its own place: right-aligned at a 34ch measure. It is
            the only sentence in the prototype that states a rule the prototype does not enforce —
            `productInputSchema` does, at `.min(1)` on both halves of every localised field. */}
        <p className="font-mono max-w-[34ch] text-right text-[11px] uppercase tracking-[0.12em] opacity-65">
          {t('Both languages are required. The shop shows PT; the EN version is used for the site’s translation.')}
        </p>
      </div>

      <form
        className="px-gutter-admin flex max-w-[1180px] flex-col gap-[clamp(26px,4vw,40px)] py-[clamp(24px,4vw,44px)]"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <ProductBasicsFields values={basics} lang={lang} errors={errors} onChange={onBasicsChange} />
        <ProductLocalizedFields values={localized} errors={errors} onChange={onLocalizedChange} />

        <div className="flex flex-col gap-3">
          <PhotosEditor {...photos} productId={productId} errors={errors} />
          {/*
            THE ONE THING ONLY THIS LEVEL KNOWS. The section above reaches the server as it is used
            and the button below saves everything else, and nothing on the screen distinguishes
            them — a reader who deletes a photo and then leaves through `Cancelar` has lost it.

            It sits outside the section rather than inside it, which is the cost of the section
            owning its own heading and region: this sentence is a sibling of `Fotos` and not part
            of it, so a reader moving by region meets it just after.
          */}
          <p className="font-mono text-[11px] tracking-[0.04em] opacity-65">
            {t('Adding or removing a photo saves right away; the alt text and the order are saved with the product.')}
          </p>
        </div>

        <SpecsEditor values={specs} errors={errors} onChange={onSpecsChange} />

        <div className="border-ink flex flex-col gap-3 border-t pt-6">
          <div className="font-mono flex flex-wrap items-center gap-3.5 text-xs uppercase tracking-[0.1em]">
            {/*
              THE BUTTON KEEPS ITS NAME WHILE SAVING, following `TrackingInlineForm` and
              `OrderSummaryPanel` rather than `LoginCard`, which swaps its submit to `Entrando…`:
              a disabled button is dropped from the accessibility tree by some screen readers, so a
              swapped label may never be read, and a control that renames itself is one a
              voice-control user can no longer ask for. The live region below says it instead.
            */}
            {/* Off while a DELETE is in flight too. The two requests race for the same document,
                and a save that lands after the delete is a product that comes back. */}
            <PillButton type="submit" disabled={saving || deleting}>
              {t('Save product')}
            </PillButton>
            <PillButton variant="outline" href={routes.adminProducts()}>
              {t('Cancel')}
            </PillButton>

            {productId ? (
              confirmingDelete ? (
                <div className="ml-auto flex flex-wrap items-center gap-2.5">
                  <p id={QUESTION_ID} className="text-accent">
                    {t('Delete for good?')}
                  </p>
                  <button
                    type="button"
                    autoFocus
                    disabled={deleting}
                    aria-labelledby={`${CONFIRM_ID} ${TITLE_ID}`}
                    aria-describedby={QUESTION_ID}
                    className={`border-accent border-b ${DESTRUCTIVE}`}
                    onClick={onConfirmDelete}
                  >
                    <span id={CONFIRM_ID}>{t('Yes, delete')}</span>
                  </button>
                  {/* Disabled with the confirm, and for the reason `TrackingInlineForm` gives:
                      the request has already left and closing the pair would not recall it. */}
                  <button
                    type="button"
                    disabled={deleting}
                    aria-labelledby={`${CANCEL_ID} ${TITLE_ID}`}
                    className={`font-mono text-[11px] uppercase tracking-[0.06em] disabled:opacity-50 ${FOCUS}`}
                    onClick={onCancelDelete}
                  >
                    <span id={CANCEL_ID}>{t('Cancel')}</span>
                  </button>
                </div>
              ) : (
                // The only control on this screen with this name, so it needs no composition — the
                // pair above does, because they collide with the form's own `Cancelar`.
                <button
                  type="button"
                  className={`border-accent ml-auto border-b ${DESTRUCTIVE}`}
                  onClick={onAskDelete}
                >
                  {t('Delete this product')}
                </button>
              )
            ) : null}
          </div>

          {/*
            ALWAYS RENDERED, EMPTY OR NOT. A live region has to be on the page before its content
            changes or nothing is announced, and one that mounts already holding its message is the
            version that stays silent — so a save that started while this was absent could never be
            reported. The extract lists aria-live among the things the design has nowhere at all.
          */}
          <p role="status" className="font-mono text-[11px] tracking-[0.04em] opacity-80">
            {saving ? t('Saving…') : saved ? t('Product saved.') : ''}
          </p>

          {/* An `alert` and not the region above, following `LoginCard`: a refusal has to interrupt
              a screen the reader is already looking at, and inserting an element with this role is
              what browsers announce. */}
          {saveError ? (
            <p role="alert" className="font-mono border-accent text-accent border-l-2 pl-3 text-[12px] leading-[1.5]">
              {message(saveError)}
            </p>
          ) : null}
        </div>
      </form>
    </>
  )
}
