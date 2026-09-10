import { type FieldErrors, fieldErrorsFromIssues, productUpdateSchema } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { letter, productWithThreePhotos, productWithoutPhotos } from '../../fixtures/products'
import { measure, opacityOf } from '../../../.storybook/contrast'
import { basicsFromProduct, centsFromReais, stockFrom } from './ProductBasicsFields'
import { localizedFromProduct } from './ProductLocalizedFields'
import {
  MAX_PHOTO_BYTES,
  type PhotoDraft,
  PhotosEditor,
  photoProblem,
  photosForSubmit,
  photosFromProduct,
} from './PhotosEditor'
import { specsForSubmit, specsFromProduct } from './SpecsEditor'

// The contrast arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch
// that has to assert a ratio for itself.

const three = photosFromProduct(productWithThreePhotos)

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new ArrayBuffer(bytes)], name, { type })
}

// Not a story, and not exported: a non-story export in a CSF file is indexed AS a story and
// rendered with no args. `getByLabelText` reads a label's raw `textContent`, which includes the
// `aria-hidden` plus sign the design draws — the accessible name, computed the way a screen reader
// computes it, does not. Asking the DOM directly keeps the two apart, and lets the name itself be
// asserted rather than assumed.
function pickerOf(canvasElement: HTMLElement): HTMLInputElement {
  return canvasElement.querySelector('input[type=file]')!
}

/** The PUT payload, so the only spec these stories check against is the schema itself. */
function updateFrom(photos: PhotoDraft[]) {
  const basics = basicsFromProduct(productWithThreePhotos)
  return {
    slug: basics.slug,
    priceCents: centsFromReais(basics.price),
    stock: stockFrom(basics),
    type: basics.type,
    active: basics.active,
    ...localizedFromProduct(productWithThreePhotos),
    specs: specsForSubmit(specsFromProduct(productWithThreePhotos)),
    photos: photosForSubmit(photos),
  }
}

/**
 * A real rejected parse. Photo `alt` is `optionalLocalizedTextSchema`, which allows empty strings
 * and caps each half at 200 characters — the only way a photo can be rejected at all, and the
 * only reason this component takes `errors`.
 */
const tooLong = three.map((photo, index) => (index === 1 ? { ...photo, alt: { pt: 'x'.repeat(201), en: '' } } : photo))
const rejectedUpdate = productUpdateSchema.safeParse(updateFrom(tooLong))
const parseErrors: FieldErrors = rejectedUpdate.success ? {} : fieldErrorsFromIssues(rejectedUpdate.error.issues)

const meta = {
  component: PhotosEditor,
  title: 'Admin/PhotosEditor',
  args: {
    values: three,
    productId: productWithThreePhotos.id,
    errors: {},
    onChange: fn(),
    onAddPhoto: fn(),
    onRejectFile: fn(),
    onAskDelete: fn(),
    onCancelDelete: fn(),
    onConfirmDelete: fn(),
  },
  render: function Render(args: ComponentProps<typeof PhotosEditor>) {
    const [values, setValues] = useState(args.values)
    return (
      <PhotosEditor
        {...args}
        values={values}
        onChange={(next) => {
          setValues(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof PhotosEditor>
export default meta
type Story = StoryObj<typeof meta>

/**
 * The design's shape: a ruled header with the add action, then one card per photo. The first card
 * is `Foto principal` and the rest are numbered, which is POSITIONAL and not a flag on the photo —
 * the main photo is whichever one is first, so reordering is how it changes.
 */
export const Editing: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Fotos' })).toBeInTheDocument()
    await expect(canvas.getByText('Foto principal')).toBeInTheDocument()
    await expect(canvas.getByText('Foto 2')).toBeInTheDocument()
    await expect(canvas.getByText('Foto 3')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Alt (PT), Foto principal')).toHaveValue('Folha da esquerda')
    await expect(canvas.getByLabelText('Alt (EN), Foto 2')).toHaveValue('Middle sheet')
    await expect(canvas.getByLabelText('Alt (PT), Foto 3')).toHaveValue('')

    // The draft is a COPY. The fixtures are deep-frozen, so an aliased pair turns the first
    // keystroke into a TypeError — and nothing else in these stories would notice, because every
    // edit below builds a new object anyway.
    const draft = photosFromProduct(productWithThreePhotos)
    await expect(draft[0]!.alt).not.toBe(productWithThreePhotos.photos[0]!.alt)
    await expect(Object.isFrozen(draft[0]!.alt)).toBe(false)
  },
}

/**
 * SIX ALT BOXES AND NINE BUTTONS, ALL NAMED AFTER THEIR CARD. `Alt (PT)` six times over says
 * nothing about which photo it belongs to, and a `✕` says nothing at all — a button whose only
 * content is a glyph has no accessible name.
 *
 * Task 3 solved this by composing a control's visible word with its row header. A photo card HAS
 * a header — the label the design already draws — so the same composition works here, unlike the
 * spec rows next door, which have no header to borrow. `getByLabelText` and `getByRole` both throw
 * on a duplicate, so these lookups ARE the assertion that no two controls share a name.
 *
 * THE VISIBLE LABEL IS THE FIRST HALF OF THE SPOKEN ONE, which is what keeps SC 2.5.3 true: a
 * speech-input user says "Alt (PT)" and hits a control whose name starts with it.
 */
export const NamesEveryControlAfterItsCard: Story = {
  play: async ({ canvas }) => {
    for (const card of ['Foto principal', 'Foto 2', 'Foto 3']) {
      await expect(canvas.getByLabelText(`Alt (PT), ${card}`)).toBeInTheDocument()
      await expect(canvas.getByLabelText(`Alt (EN), ${card}`)).toBeInTheDocument()
      await expect(canvas.getByRole('button', { name: `Apagar, ${card}` })).toBeInTheDocument()
    }
    await expect(canvas.getAllByRole('textbox')).toHaveLength(6)
    // The design's labels are visible too, and they are what the composed names are built from.
    await expect(canvas.getAllByText('Alt (PT)')).toHaveLength(3)
  },
}

/**
 * THE SUBTITLE TRAP AGAIN, ONE FIELD OVER. `alt` is `optionalLocalizedTextSchema`: both `pt` and
 * `en` are REQUIRED keys even though empty strings are allowed, so a draft that models a
 * half-typed alt as `{ pt: 'x' }` is a ZodError about a field that is optional. Typing in one box
 * must hand back both halves, which is why `PhotoDraft.alt` is a pair and not a partial.
 */
export const EditsOneAltWithoutDroppingTheOther: Story = {
  play: async ({ args, canvas }) => {
    const box = canvas.getByLabelText('Alt (EN), Foto 3')
    await userEvent.type(box, 'Right sheet')

    const expected = photosFromProduct(productWithThreePhotos)
    expected[2] = { ...expected[2]!, alt: { pt: '', en: 'Right sheet' } }
    await expect(args.onChange).toHaveBeenLastCalledWith(expected)
    await expect(canvas.getByLabelText('Alt (PT), Foto 3')).toHaveValue('')
    await expect(canvas.getByLabelText('Alt (PT), Foto principal')).toHaveValue('Folha da esquerda')
  },
}

/**
 * REORDERING IS HOW THE MAIN PHOTO CHANGES, and the design draws no way to do it — no drag
 * handles, no "principal" toggle, nothing. Without it `Foto principal` is whichever photo was
 * uploaded first, forever, and the only way to change the piece's shopfront image is to delete
 * every photo and upload them again in the right order.
 *
 * TWO BUTTONS AND NOT DRAG-AND-DROP. A drag needs pointer state and a handle on a node, neither of
 * which this layer may hold — and buttons are the accessible affordance anyway, not the fallback.
 * They disable at the ends, where there is nowhere to go; three cards is the smallest number that
 * has a middle, which is why the fixture has three.
 */
export const MovesAPhotoAndRenamesTheCards: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Mover para cima, Foto principal' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Mover para baixo, Foto principal' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Mover para cima, Foto 2' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Mover para baixo, Foto 3' })).toBeDisabled()

    // BOTH MOVES ARE MADE FROM A POSITION WHERE ONE STEP AND THE WHOLE WAY DIFFER, which the
    // first draft of this story did not do: it only ever moved card 2 up, where `index - 1` and
    // `0` are the same number, so a control that jumped a photo straight to the top passed.
    await userEvent.click(canvas.getByRole('button', { name: 'Mover para baixo, Foto principal' }))
    await expect(args.onChange).toHaveBeenLastCalledWith([three[1]!, three[0]!, three[2]!])

    await userEvent.click(canvas.getByRole('button', { name: 'Mover para cima, Foto 3' }))
    await expect(args.onChange).toHaveBeenLastCalledWith([three[1]!, three[2]!, three[0]!])

    // The labels are positional, so the piece that moved is now the shopfront photo.
    await expect(canvas.getByLabelText('Alt (PT), Foto principal')).toHaveValue('Folha do meio')
    await expect(canvas.getByLabelText('Alt (PT), Foto 2')).toHaveValue('')
    await expect(canvas.getByLabelText('Alt (PT), Foto 3')).toHaveValue('Folha da esquerda')
  },
}

/**
 * DELETING A PHOTO IS THE ONE DESTRUCTIVE ACT IN THIS COMPONENT, and it is destructive in a way
 * the spec rows next door are not: `DELETE /api/admin/products/:id/photos?key=…` removes the R2
 * object as it answers, so the file is gone before the product is saved. Nothing here edits a
 * draft that could be abandoned.
 *
 * So it follows Task 3's shape exactly — inline two-step, `autoFocus` on the confirmation, the
 * question wired as `aria-describedby` rather than as a live region so it is announced once, with
 * the control it belongs to. Not a modal: a dialog needs a focus trap, focus restoration and an
 * Escape handler, and all three are browser APIs this layer may not touch.
 */
export const AsksBeforeDeletingAPhoto: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Apagar, Foto 2' }))
    await expect(args.onAskDelete).toHaveBeenLastCalledWith(three[1]!)
    // Asking is all it does: nothing is removed until the second press.
    await expect(args.onConfirmDelete).not.toHaveBeenCalled()
  },
}

/** The second step, drawn by the container passing the key back. */
export const ConfirmingADelete: Story = {
  args: { confirmingDeleteKey: three[1]!.key },
  play: async ({ args, canvas }) => {
    const confirm = canvas.getByRole('button', { name: 'Sim, apagar, Foto 2' })
    await expect(confirm).toHaveFocus()
    await expect(confirm).toHaveAccessibleDescription('Apagar de vez?')
    // The ✕ is gone while the question stands, so there is no third thing to press.
    await expect(canvas.queryByRole('button', { name: 'Apagar, Foto 2' })).toBeNull()
    // And only this card asks: the other two are untouched.
    await expect(canvas.getByRole('button', { name: 'Apagar, Foto principal' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Cancelar, Foto 2' }))
    await expect(args.onCancelDelete).toHaveBeenCalled()
    await expect(args.onConfirmDelete).not.toHaveBeenCalled()

    await userEvent.click(confirm)
    await expect(args.onConfirmDelete).toHaveBeenLastCalledWith(three[1]!)
  },
}

/** A file that will survive the round trip goes straight out, with no local verdict of its own. */
export const UploadsAFile: Story = {
  play: async ({ args, canvasElement }) => {
    const picker = pickerOf(canvasElement)
    await expect(picker).toHaveAccessibleName('Adicionar foto')
    const file = fileOf('carta.jpg', 'image/jpeg', 1024)
    await userEvent.upload(picker, file)
    await expect(args.onAddPhoto).toHaveBeenLastCalledWith(file)
    await expect(args.onRejectFile).not.toHaveBeenCalled()

    // THE SAME FILE TWICE, which is what somebody does after an upload fails. A file input holds
    // its value, and re-picking an identical path fires no change event at all — so the input is
    // cleared after every pick, and this is the only line that notices when it is not.
    await userEvent.upload(picker, file)
    await expect(args.onAddPhoto).toHaveBeenCalledTimes(2)
  },
}

/**
 * THE ONLY WAY TO SAY ANYTHING TRUE ABOUT A FAILED UPLOAD. `multer` carries
 * `limits: { fileSize: 8 * 1024 * 1024 }` and NO `fileFilter`, so an oversized file throws a
 * `MulterError` — neither an `AppError` nor a `ZodError` — and the API's error handler falls
 * through to a bare `500 INTERNAL`. A file it cannot decode passes multer and dies inside
 * `toWebp`, also a 500. **Both of the two likeliest upload failures arrive unlabelled**, so a
 * component that waited for the response could only ever say "algo quebrou do meu lado" about a
 * photo that was simply too big. Fixing that is API-side and out of this PR.
 *
 * `MAX_PHOTO_BYTES` IS A SECOND COPY OF MULTER'S 8 MB and, unlike `MAX_SPECS` and
 * `MIN_PRICE_CENTS`, it is NOT a checked one: the limit lives in an Express route this project's
 * web tests cannot import. It is a sweep item — the number belongs beside the schemas in
 * `@shop/shared`, where both sides could read it.
 *
 * THE WRONG-TYPE HALF IS MEASURED ON THE FUNCTION, NOT THROUGH THE INPUT, and that is the point
 * rather than a shortcut: `accept` filters the file out of the DOM path — user-event models the
 * picker faithfully — and `accept` is exactly the guard that does not hold in real life. Drag and
 * drop, "All files" in the dialog and several mobile pickers all ignore it, which is why the check
 * exists in code at all.
 */
export const RefusesAFileTheApiWouldOnly500On: Story = {
  play: async ({ args, canvasElement }) => {
    const big = fileOf('foto.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1)
    await userEvent.upload(pickerOf(canvasElement), big)
    await expect(args.onRejectFile).toHaveBeenLastCalledWith({ name: 'foto.jpg', problem: 'too_large' })
    await expect(args.onAddPhoto).not.toHaveBeenCalled()

    await expect(photoProblem(fileOf('a.jpg', 'image/jpeg', 10))).toBeUndefined()
    await expect(photoProblem(fileOf('a.png', 'image/png', MAX_PHOTO_BYTES))).toBeUndefined()
    await expect(photoProblem(fileOf('a.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1))).toBe('too_large')
    await expect(photoProblem(fileOf('a.pdf', 'application/pdf', 10))).toBe('wrong_type')
    // The one an iPhone actually hands over, and the one sharp cannot read without libheif.
    await expect(photoProblem(fileOf('IMG_0421.HEIC', 'image/heic', 10))).toBe('wrong_type')
  },
}

/** What the refusal reads like, and it names the file rather than the field it came from. */
export const SaysWhyAFileWasRefused: Story = {
  args: { rejected: { name: 'foto.jpg', problem: 'too_large' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('“foto.jpg” passa de 8 MB. Mande uma foto menor.')
    // Still three cards: a refusal never touches what is already uploaded.
    await expect(canvas.getAllByRole('button', { name: /^Apagar, / })).toHaveLength(3)
  },
}

/**
 * A PRODUCT THAT HAS NEVER BEEN SAVED HAS NO ID, so there is no `/api/admin/products/:id/photos`
 * to post to — the R2 key is built from the product's `_id`. The spec settles the behaviour and
 * the wording in English ("Save first to add photos", spec:204); the Portuguese sentence is
 * invented here and is on the list of copy Augusto still owes, beside PR 3's outstanding strings.
 *
 * The reason is a visible sentence rather than a description on the control, for the reason
 * `CartLine` gives at the per-item cap: a disabled control cannot be focused, so it cannot carry
 * an `aria-describedby` to anybody.
 */
export const ANewProductCannotUploadYet: Story = {
  args: { values: [], productId: undefined },
  play: async ({ canvas, canvasElement }) => {
    await expect(pickerOf(canvasElement)).toBeDisabled()
    await expect(canvas.getByText('Salve o produto antes de adicionar fotos.')).toBeInTheDocument()
    // And not both sentences at once: the empty-state line would say nothing this one does not.
    await expect(canvas.queryByText('Nenhuma foto ainda.')).toBeNull()
  },
}

/** Saved, and no photos yet: the design draws an empty grid, which reads as one that failed. */
export const NoPhotosYet: Story = {
  args: { values: [], productId: productWithoutPhotos.id },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Nenhuma foto ainda.')).toBeInTheDocument()
    await expect(pickerOf(canvasElement)).toBeEnabled()
  },
}

/**
 * The upload is the slowest thing in the panel and the design draws no pending state at all. The
 * control is held shut while it runs — a second pick would post a second photo against a list the
 * container has not refreshed yet — and the region that carries the refusal carries this too, so
 * it is announced rather than merely painted.
 */
export const WhileAPhotoIsUploading: Story = {
  args: { uploading: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(pickerOf(canvasElement)).toBeDisabled()
    await expect(canvas.getByRole('status')).toHaveTextContent('Enviando a foto…')
  },
}

/**
 * THE PUT'S PERMUTATION RULE, WHICH IS THE ONLY WAY PHOTOS REACH IT. `products.ts:50` refuses the
 * update unless the array lists every existing key exactly once — same length, no duplicates, no
 * unknown keys — with a 400 keyed `{ photos: ['must_match_existing'] }`. Adding goes through the
 * multipart POST and removing through the DELETE, so the PUT can only ever reorder and re-alt.
 *
 * The three lines under `matches` are that rule transcribed from the route, which is a duplication
 * and is named as one: nothing on the web side can execute the real check. What this pins is that
 * `photosForSubmit` never invents, drops or repeats a key — and the order assertion is what stops
 * the whole story passing vacuously on an array that was never reordered.
 */
export const SendsEveryExistingKeyExactlyOnce: Story = {
  play: async () => {
    const existing = productWithThreePhotos.photos.map((photo) => photo.key)
    const reordered = [three[2]!, three[0]!, three[1]!]
    const sent = photosForSubmit(reordered)

    await expect(sent.map((photo) => photo.key)).not.toEqual(existing)
    const keys = sent.map((photo) => photo.key)
    const matches = keys.length === existing.length && new Set(keys).size === keys.length && keys.every((k) => existing.includes(k))
    await expect(matches).toBe(true)

    // `alt` is always sent as a pair. Omitting it preserves what is stored, which is a different
    // request from this one: the draft's alt is what the person just edited.
    await expect(sent[0]).toEqual({ key: three[2]!.key, alt: { pt: '', en: '' } })
    await expect(productUpdateSchema.safeParse(updateFrom(reordered)).success).toBe(true)
  },
}

/** Alt is capped at 200 characters a side, and the error lands on the card that owns it. */
export const ShowsAltErrors: Story = {
  args: { values: tooLong, errors: parseErrors },
  play: async ({ canvas }) => {
    await expect(Object.keys(parseErrors)).toEqual(['photos.1.alt.pt'])
    const box = canvas.getByLabelText('Alt (PT), Foto 2')
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await expect(box).toHaveAccessibleDescription('String must contain at most 200 character(s)')
    await expect(canvas.getByLabelText('Alt (EN), Foto 2')).not.toHaveAttribute('aria-invalid')
    await expect(canvas.getByLabelText('Alt (PT), Foto principal')).not.toHaveAttribute('aria-invalid')
  },
}

/** In English the keys render themselves; the card labels stay positional. */
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Photos' })).toBeInTheDocument()
    await expect(canvas.getByText('Main photo')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Alt (PT), Photo 2')).toHaveValue('Folha do meio')
    await expect(canvas.getByRole('button', { name: 'Move up, Photo 3' })).toBeInTheDocument()
  },
}

/**
 * THE EXTRACT GOT THIS ONE WRONG AND THE ERROR IS A REAL FAILURE. Its derivation table reads the
 * prototype's ✕ as `text-accent text-[13px] opacity-100`, with the note that "the `opacity:1`
 * deliberately cancels the parent `.6`", and its contrast audit therefore scores that ✕ at 5.58:1
 * and passes it. **A child's `opacity` cannot cancel a parent's.** `opacity` composites the whole
 * subtree as a group, so the prototype's ✕ is accent at an effective 0.6 over paper — 2.66:1,
 * failing AA outright, on the control that deletes a photo.
 *
 * So the 65% sits on the WORD and not on the card header, which is the call
 * `ProductBasicsFields` already made about its checkbox: a label recipe has no business dimming a
 * control. And it is measured here or nowhere twice over — `color-contrast` skips
 * single-character text as a suspected icon ligature, so a one-glyph button passes the gate at any
 * contrast at all.
 *
 * The relational line is what holds the arithmetic: every ratio here is a `>=`, so a measurement
 * bug that errs HIGH passes all of them.
 */
export const MeasuresItsCardHeaderAndItsDeleteButton: Story = {
  play: async ({ canvas }) => {
    const label = canvas.getByText('Foto 2')
    await expect(opacityOf(label)).toBeCloseTo(0.65, 5)
    await expect(measure(label, 'color')).toBeGreaterThanOrEqual(4.5)

    const remove = canvas.getByRole('button', { name: 'Apagar, Foto 2' })
    await expect(opacityOf(remove)).toBe(1)
    await expect(measure(remove, 'color')).toBeGreaterThanOrEqual(4.5)
    await expect(measure(label, 'color')).toBeLessThan(measure(remove, 'color'))

    // SC 2.5.8 asks 24×24 of a target with no spacing exception. The design draws a 20px span.
    for (const name of ['Apagar, Foto 2', 'Mover para cima, Foto 2', 'Mover para baixo, Foto 2']) {
      const { width, height } = canvas.getByRole('button', { name }).getBoundingClientRect()
      await expect(width).toBeGreaterThanOrEqual(24)
      await expect(height).toBeGreaterThanOrEqual(24)
    }
  },
}

/** The card carries the photo, and the fixture with two of them is the one the form usually sees. */
export const TwoPhotos: Story = {
  args: { values: photosFromProduct(letter), productId: letter.id },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('button', { name: 'Mover para baixo, Foto 2' })).toBeDisabled()
    // The thumbnail is decorative HERE: the card is already named and the alt text is the thing
    // being edited two boxes below, not a description of a picture standing on its own. An
    // `<img alt="">` has role `presentation`, so it is queried by tag rather than by role.
    const images = canvasElement.querySelectorAll('img')
    await expect(images).toHaveLength(2)
    for (const img of images) await expect(img).toHaveAttribute('alt', '')
  },
}
