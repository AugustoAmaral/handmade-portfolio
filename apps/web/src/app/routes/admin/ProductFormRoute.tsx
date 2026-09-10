import {
  type FieldErrors,
  type ProductUpdateInput,
  type PublicProduct,
  fieldErrorsFromIssues,
  productUpdateSchema,
} from '@shop/shared'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  EMPTY_BASICS,
  EMPTY_LOCALIZED,
  EMPTY_SPEC,
  type PhotoDraft,
  type PhotoRejection,
  type ProductBasicsValues,
  type ProductLocalizedValues,
  type SpecDraft,
  basicsFromProduct,
  centsFromReais,
  localizedFromProduct,
  photosForSubmit,
  photosFromProduct,
  specsForSubmit,
  specsFromProduct,
  stockFrom,
} from '../../../ui/admin'
import { AdminProductFormPage, LoadingPage } from '../../../ui/pages'
import { routes } from '../../../ui/routes'
import { ApiError } from '../../api/client'
import {
  useAdminProducts,
  useDeletePhoto,
  useDeleteProduct,
  useSaveProduct,
  useUploadPhoto,
} from '../../api/queries'
import { useAdmin } from '../../AdminShellContainer'

/**
 * The API error codes this screen can say something true about. Everything else — a 404 on a
 * product somebody deleted in another tab, a 500, a connection that dropped before there was a
 * status to read — collapses to `INTERNAL`, which is the shop's one "something broke" sentence.
 *
 * The collapse is not tidiness: `useErrorMessage` RETURNS THE CODE ITSELF for anything it does not
 * know, so forwarding a raw code would print `PRODUCT_NOT_FOUND` at the reader in English capitals.
 */
const SPEAKABLE = new Set(['VALIDATION', 'SLUG_TAKEN'])

/**
 * The product form: the branch's most stateful container, and the only one holding a draft of
 * something the API owns.
 *
 * THERE IS NO `GET /api/admin/products/:id`. The admin routes are a list, a create, an update, a
 * delete and two photo endpoints — nothing reads one product — so the form is seeded from the LIST,
 * which is the same cache the table beside it reads and therefore costs no second request.
 *
 * THE DRAFT IS SEEDED ONCE PER PRODUCT AND NOT ONCE PER RENDER. Keying on the id rather than on the
 * object is what keeps a background refetch — every save invalidates the list — from overwriting
 * what is being typed with what the server last had. The same key resets the whole draft when the
 * route changes under a mounted component, which is `ProductRoute`'s selected-photo bug in a form:
 * react-router renders one element for `/admin/products/new` and `/admin/products/:id` alike, so
 * without this, leaving an edit for a new draft would open the new draft holding the old product.
 *
 * A SAVE DOES NOT RESEED, and that is deliberate. The response is the same values that were just
 * sent, and re-applying them would repaint every field — including any character typed in the few
 * hundred milliseconds the request was in flight, which the disabled Save button does not prevent.
 * The one thing adopted from the response is a CREATED product's identity, because from that moment
 * the draft is editing a real document.
 *
 * THE PHOTO SECTION IS THE EXCEPTION AND IT MUST BE. Adding and removing a photo are immediate
 * server calls that each answer with the WHOLE product, while the order and the alt text ride on
 * this form's own PUT — and `products.ts:50` refuses that PUT unless `photos` lists every existing
 * key exactly once. So a container that kept its stale list after an upload sends two keys for a
 * product that has three and gets a 400 keyed `{ photos: ['must_match_existing'] }` about a photo
 * the reader can see on the screen. Reseeding from every photo response is the whole fix.
 *
 * WHAT IS VALIDATED HERE IS WHAT THE API VALIDATES, by running its own schema: `productUpdateSchema`
 * over the assembled body, with `fieldErrorsFromIssues` turning the issues into the same flat
 * zod-path map the API's 400 carries. The form therefore fails identically whether or not the
 * request is made — and a price of `19,99` is 1999 rather than 1998, because `centsFromReais`
 * combines digit groups as integers instead of multiplying a float.
 */
export function ProductFormRoute() {
  const { id } = useParams()
  const routedId = id ?? null
  const { lang } = useAdmin()
  const navigate = useNavigate()
  const { data: products, isPending } = useAdminProducts()
  const save = useSaveProduct()
  const remove = useDeleteProduct()
  const upload = useUploadPhoto()
  const removePhoto = useDeletePhoto()

  const [basics, setBasics] = useState<ProductBasicsValues>(EMPTY_BASICS)
  const [localized, setLocalized] = useState<ProductLocalizedValues>(EMPTY_LOCALIZED)
  // The design seeds a brand-new product with one blank row, and `specsForSubmit` drops it again.
  const [specs, setSpecs] = useState<SpecDraft[]>([EMPTY_SPEC])
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saveError, setSaveError] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingPhotoKey, setConfirmingPhotoKey] = useState<string | undefined>(undefined)
  const [rejected, setRejected] = useState<PhotoRejection | undefined>(undefined)
  // `undefined` is "nothing seeded yet", which only an edit URL can be in; `null` is the blank
  // draft, which is a seeded state and not an absent one.
  const [seededFor, setSeededFor] = useState<string | null | undefined>(routedId === null ? null : undefined)

  const product = routedId === null ? undefined : products?.find((candidate) => candidate.id === routedId)

  function clearFeedback() {
    setErrors({})
    setSaveError(undefined)
    setSaved(false)
    setConfirmingDelete(false)
    setConfirmingPhotoKey(undefined)
    setRejected(undefined)
  }

  function seedFrom(source: PublicProduct) {
    setSeededFor(source.id)
    setBasics(basicsFromProduct(source))
    setLocalized(localizedFromProduct(source))
    const rows = specsFromProduct(source)
    setSpecs(rows.length > 0 ? rows : [EMPTY_SPEC])
    setPhotos(photosFromProduct(source))
  }

  function seedBlank() {
    setSeededFor(null)
    setBasics(EMPTY_BASICS)
    setLocalized(EMPTY_LOCALIZED)
    setSpecs([EMPTY_SPEC])
    setPhotos([])
  }

  // Adjusted DURING the render, React's own answer for state derived from a prop, rather than in an
  // effect that would commit one frame of the previous product against this URL first.
  const needsSeed = routedId !== seededFor && (routedId === null || product !== undefined)
  if (needsSeed) {
    clearFeedback()
    if (routedId === null) seedBlank()
    else if (product) seedFrom(product)
  }

  if (routedId !== seededFor && !needsSeed) {
    if (isPending) return <LoadingPage />
    // ONE RULE, TWO RIGHT ANSWERS. The id may be missing because the list could not be fetched or
    // because the product is not in it, and this layer cannot tell those apart — the products table
    // can: it renders the failure with a retry when the same query is in error, and the catalogue
    // when it is not. Inventing a not-found screen for the panel would mean copy in `src/ui` that
    // only this container can reach.
    return <Navigate to={routes.adminProducts()} replace />
  }

  // "Saved" describes the draft on screen, so the first edit after a save ends it. The ERROR and the
  // field errors deliberately survive: they name the boxes still to be fixed, and clearing them as
  // the reader starts fixing one would remove the list of the others.
  const edited = <T,>(apply: (value: T) => void) => (value: T) => {
    setSaved(false)
    apply(value)
  }

  function submit() {
    setSaveError(undefined)
    setSaved(false)
    const input: ProductUpdateInput = {
      // Trimmed because the only thing a stray space around a slug can do is fail the schema's
      // `/^[a-z0-9-]+$/` with a message about a character nobody can see.
      slug: basics.slug.trim(),
      name: localized.name,
      subtitle: localized.subtitle,
      description: localized.description,
      priceCents: centsFromReais(basics.price),
      type: basics.type,
      // Always sent: `stock` is `nullable()` and NOT `optional()`, so omitting it is
      // "stock: Required" rather than "leave it alone".
      stock: stockFrom(basics),
      specs: specsForSubmit(specs),
      // ON THE FORM SINCE TASK 8b, and still always sent for the reason it was sent before there
      // was a control: `productUpdateSchema` defaults it to `false` and the PUT replaces the whole
      // document, so a body that omitted the key would unfeature the shop's home piece on every
      // save. It rides in `basics` because it is seeded, edited and submitted with the other five
      // identifier fields; the table's own toggle assembles its body from `productInputFrom`,
      // which is a different path and untouched.
      featured: basics.featured,
      active: basics.active,
      // Only on update. On create there is no id to key an R2 object by, and the API parses the
      // body with `productInputSchema`, which strips the field.
      ...(routedId === null ? {} : { photos: photosForSubmit(photos) }),
    }

    const parsed = productUpdateSchema.safeParse(input)
    if (!parsed.success) {
      setErrors(fieldErrorsFromIssues(parsed.error.issues))
      // The button is at the bottom of a long form whose fields have scrolled away; without a line
      // beside it a rejected submit is a button that appears to do nothing.
      setSaveError('VALIDATION')
      return
    }

    setErrors({})
    save.mutate(
      { id: routedId ?? undefined, input: parsed.data },
      {
        onSuccess: (created) => {
          setSaved(true)
          if (routedId !== null) return
          // A created product has an address of its own, and until the URL is it there is no id to
          // upload a photo against. Adopting the identity BEFORE navigating is what stops the new
          // URL from reading as an unseeded one and bouncing to the table while the list catches up.
          setSeededFor(created.id)
          setPhotos(photosFromProduct(created))
          navigate(routes.adminProduct(created.id), { replace: true })
        },
        onError: (failure) => {
          const code = failure instanceof ApiError ? failure.code : 'INTERNAL'
          if (failure instanceof ApiError && failure.fieldErrors) setErrors(failure.fieldErrors)
          // The 409 carries no `fieldErrors`, and the identifier is the field it is about. Saying
          // it twice — beside the box and beside the button — is what `VALIDATION` already does.
          if (code === 'SLUG_TAKEN') setErrors({ slug: ['SLUG_TAKEN'] })
          setSaveError(SPEAKABLE.has(code) ? code : 'INTERNAL')
        },
      },
    )
  }

  return (
    <AdminProductFormPage
      productId={routedId ?? undefined}
      lang={lang}
      errors={errors}
      basics={basics}
      localized={localized}
      specs={specs}
      saving={save.isPending}
      saved={saved}
      saveError={saveError}
      confirmingDelete={confirmingDelete}
      deleting={remove.isPending}
      onBasicsChange={edited(setBasics)}
      onLocalizedChange={edited(setLocalized)}
      onSpecsChange={edited(setSpecs)}
      onSubmit={submit}
      onAskDelete={() => setConfirmingDelete(true)}
      onCancelDelete={() => setConfirmingDelete(false)}
      onConfirmDelete={() => {
        if (routedId === null) return
        // Off the screen in the same commit as the request leaves: a second confirmation would
        // 404 a product that is already gone.
        setConfirmingDelete(false)
        remove.mutate(routedId, {
          onSuccess: () => navigate(routes.adminProducts(), { replace: true }),
          onError: () => setSaveError('INTERNAL'),
        })
      }}
      photos={{
        values: photos,
        confirmingDeleteKey: confirmingPhotoKey,
        uploading: upload.isPending,
        rejected,
        onChange: edited(setPhotos),
        onAddPhoto: (file) => {
          if (routedId === null) return
          setRejected(undefined)
          setSaved(false)
          upload.mutate(
            { id: routedId, file },
            {
              onSuccess: (updated) => setPhotos(photosFromProduct(updated)),
              // THE ONLY SLOT THIS SCREEN HAS FOR A FAILED UPLOAD, and it is in the action bar
              // rather than beside the photos. `PhotosEditor`'s own message line carries client-side
              // REFUSALS — a file too large or of a type sharp cannot read — and a server failure is
              // neither; borrowing `too_large` for a 500 would be a sentence that names the wrong
              // cause. A photo-error prop on that component is the real home and nobody has one.
              onError: () => setSaveError('INTERNAL'),
            },
          )
        },
        onRejectFile: setRejected,
        onAskDelete: (photo) => setConfirmingPhotoKey(photo.key),
        onCancelDelete: () => setConfirmingPhotoKey(undefined),
        onConfirmDelete: (photo) => {
          if (routedId === null) return
          setConfirmingPhotoKey(undefined)
          setSaved(false)
          removePhoto.mutate(
            { id: routedId, key: photo.key },
            {
              onSuccess: (updated) => setPhotos(photosFromProduct(updated)),
              onError: () => setSaveError('INTERNAL'),
            },
          )
        },
      }}
    />
  )
}
