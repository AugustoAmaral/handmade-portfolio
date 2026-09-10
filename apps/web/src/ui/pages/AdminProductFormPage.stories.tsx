import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { letter } from '../../fixtures/products'
import {
  EMPTY_BASICS,
  EMPTY_LOCALIZED,
  EMPTY_SPEC,
  basicsFromProduct,
  localizedFromProduct,
  photosFromProduct,
  specsFromProduct,
} from '../admin'
import { AdminProductFormPage } from './AdminProductFormPage'
import { inAdminShell } from './AdminShell.stories'

const PHOTOS = {
  values: photosFromProduct(letter),
  onChange: fn(),
  onAddPhoto: fn(),
  onRejectFile: fn(),
  onAskDelete: fn(),
  onCancelDelete: fn(),
  onConfirmDelete: fn(),
}

const HANDLERS = {
  onBasicsChange: fn(),
  onLocalizedChange: fn(),
  onSpecsChange: fn(),
  onSubmit: fn(),
  onAskDelete: fn(),
  onCancelDelete: fn(),
  onConfirmDelete: fn(),
}

const meta = {
  component: AdminProductFormPage,
  title: 'Pages/AdminProductFormPage',
  decorators: [inAdminShell('products')],
  args: {
    productId: letter.id,
    lang: 'pt',
    errors: {},
    basics: basicsFromProduct(letter),
    localized: localizedFromProduct(letter),
    specs: specsFromProduct(letter),
    photos: PHOTOS,
    ...HANDLERS,
  },
} satisfies Meta<typeof AdminProductFormPage>
export default meta
type Story = StoryObj<typeof meta>

/**
 * THE DENSEST COMPOSITION ON THE BRANCH: four editors, an action bar and a destructive control in
 * one form.
 *
 * THE OUTLINE IS THE THING ONLY THIS LEVEL CAN GET WRONG, and it is asserted as one equality of
 * levels AND text because either half alone passes something wrong — levels alone survive two
 * sections swapping names, text alone survives an `<h2>` becoming a `<div>`. Five headings, which
 * is what lets axe's `heading-order` fire here at all; it returns true at index 0 and needs three.
 *
 * EVERY SECTION IS A PEER. `SectionRule` grew a `level` for the order detail, whose blocks belong
 * to one customer's order and nest under their name — nothing on this form nests: `Português` is
 * not part of `Fotos`, and the page's `<h1>` is the only thing above them.
 */
export const EditingAProduct: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`)).toEqual([
      'H1 Carta escrita à mão',
      'H2 Português',
      'H2 English',
      'H2 Fotos',
      'H2 Dados · chave e valor',
    ])

    // The design's `Editando · {{ slug }}`, and it follows the field rather than the saved product:
    // the tag is built from the draft, so renaming the identifier is visible before it is saved.
    await expect(canvas.getByText(/^Editando/).textContent).toBe('Editando · carta-escrita')

    await expect(canvas.getByText(/Os dois idiomas/).textContent).toBe(
      'Os dois idiomas são obrigatórios. A loja mostra PT; a versão EN é usada na tradução do site.',
    )

    // The four editors are all really here, each identified by something only it renders.
    await expect(canvas.getByLabelText('Identificador')).toHaveValue('carta-escrita')
    await expect(canvas.getByLabelText('Nome')).toHaveValue(letter.name.pt)
    await expect(canvas.getByLabelText('Name')).toHaveValue(letter.name.en)
    await expect(canvas.getByLabelText('Chave, Linha 1')).toHaveValue(letter.specs[0]!.key.pt)
    await expect(canvas.getByLabelText('Alt (PT), Foto principal')).toHaveValue(letter.photos[0]!.alt.pt)

    // A saved product can be deleted; the two-step has not started.
    await expect(canvas.getByRole('button', { name: 'Apagar este produto' })).toBeInTheDocument()
    await expect(canvas.queryByText('Apagar de vez?')).toBeNull()
  },
}

/**
 * A DRAFT THAT HAS NEVER BEEN SAVED. There is no id to build an R2 key from and no endpoint to
 * post to, so the photos section says so (spec:204) instead of failing; and there is nothing to
 * delete, so the destructive control is absent rather than disabled — a disabled control invites
 * the question of what it would do.
 *
 * The title falls back to the design's own `Sem nome`, which is one of exactly two empty-value
 * sentences the prototype has.
 */
export const NewProduct: Story = {
  args: {
    productId: undefined,
    basics: EMPTY_BASICS,
    localized: EMPTY_LOCALIZED,
    specs: [EMPTY_SPEC],
    photos: { ...PHOTOS, values: [] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Cadastrar produto')
    await expect(canvas.getByText('Novo produto')).toBeInTheDocument()
    await expect(canvas.getByText('Salve o produto antes de adicionar fotos.')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Apagar este produto' })).toBeNull()
    // The heading outline does not change with the state of the draft.
    await expect(canvas.getAllByRole('heading')).toHaveLength(5)
  },
}

/**
 * THE ONE PLACE `Sem nome` IS REACHABLE. `productInputSchema` requires both halves of every
 * localised field at `.min(1)`, so a SAVED product always has a name — only a draft in hand can
 * lose it, by having the field cleared. It is one of exactly two empty-value sentences the
 * prototype has, and without this story it would be a key with a call site and no reader.
 */
export const EditingWithTheNameCleared: Story = {
  args: { localized: { ...localizedFromProduct(letter), name: { pt: '', en: '' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Sem nome')
  },
}

/**
 * ONE `<form>`, ONE SUBMIT, AND THE PHOTOS ARE NOT IN THE DRAFT.
 *
 * The submit lives inside the form, the way `LoginCard`'s does and unlike the checkout's, whose
 * button is several components away and had to quote the form's id back through `form=`. So Enter
 * in any field submits with nothing wired for it, which the second half of this story exercises.
 *
 * THE COUNT OF SUBMIT BUTTONS IS THE LOAD-BEARING LINE. `PhotosEditor` and `SpecsEditor` put nine
 * controls inside this form, and a `<button>` with no `type` defaults to `submit` — one of those
 * losing its `type="button"` would turn "remove this row" into "save the product". Nothing else in
 * the repo is looking at that.
 */
export const OneFormWithOneSubmit: Story = {
  play: async ({ args, canvasElement, canvas }) => {
    const forms = canvasElement.querySelectorAll('form')
    await expect(forms).toHaveLength(1)
    const form = forms[0]!

    const save = canvas.getByRole('button', { name: 'Salvar produto' })
    await expect(save).toHaveAttribute('type', 'submit')
    await expect(save.closest('form')).toBe(form)

    const submits = [...form.querySelectorAll('button')].filter((button) => button.type === 'submit')
    await expect(submits).toEqual([save])

    await userEvent.type(canvas.getByLabelText('Identificador'), '{Enter}')
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

/**
 * THE PHOTOS SECTION IS A LIVE VIEW OF THE SERVER, NOT PART OF THE DRAFT, and only the page can
 * say so: adding and removing a photo are immediate calls that each answer with the whole product,
 * while the alt text and the order ride along with the product's own PUT. A reader who thinks
 * `Cancelar` undoes a photo they deleted is a reader who has lost a photo.
 *
 * The section stays INSIDE the form, because two thirds of it — every alt box, and the order — are
 * draft fields the submit carries. What is outside the draft is the pair of buttons, and those are
 * `type="button"`, which the story above pins.
 */
export const ThePhotosSectionIsNotTheDraft: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText(/Adicionar ou remover foto/).textContent).toBe(
      'Adicionar ou remover foto salva na hora; o texto alternativo e a ordem são salvos com o produto.',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Apagar, Foto principal' }))
    await expect(args.photos.onAskDelete).toHaveBeenCalledOnce()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * SAVING, WHICH THE DESIGN DRAWS FOR NOTHING — no spinner, no disabled control, no result.
 *
 * THE BUTTON KEEPS ITS NAME, following `TrackingInlineForm` and `OrderSummaryPanel` rather than
 * `LoginCard`, which renames its submit to `Entrando…`: a disabled button is dropped from the
 * accessibility tree by some screen readers, so a swapped label may never be read at all, and a
 * control that renames itself is one a voice-control user can no longer ask for. The live region
 * says it instead. (The two shapes now disagree across the branch — a sweep item, not a defect.)
 */
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Salvar produto' })).toBeDisabled()
    // TWO polite regions on this screen and that is correct: `PhotosEditor` keeps its own for the
    // upload, which is the slowest thing in the panel and a separate event from saving. The length
    // is asserted so the index below is a statement rather than a guess.
    const regions = canvas.getAllByRole('status')
    await expect(regions).toHaveLength(2)
    await expect(regions[1]!.textContent).toBe('Salvando…')
  },
}

// The result of the save, in the region that was already on the page while it was in flight.
export const Saved: Story = {
  args: { saved: true },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')[1]!.textContent).toBe('Produto salvo.')
    await expect(canvas.getByRole('button', { name: 'Salvar produto' })).toBeEnabled()
  },
}

/**
 * A REFUSED SAVE ARRIVES AS AN API ERROR CODE, NOT A SENTENCE, which is `CheckoutPage`'s own shape
 * (`submitError: string | null`, translated by `OrderSummaryPanel`) and for the same reason: a
 * container resolving the words would put them outside the only directory `copy.test.ts` scans, so
 * a missing translation would ship as fluent English with nothing red anywhere. The table it goes
 * through is `useErrorMessage`, the checkout's, so `VALIDATION` and `INTERNAL` already have their
 * sentences and this page spends no new copy on either.
 */
export const SaveRefusedByTheFields: Story = {
  args: {
    saveError: 'VALIDATION',
    errors: { slug: ['required'], 'name.en': ['required'], 'specs.0.key.pt': ['required'], 'photos.0.alt.pt': ['required'] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Confira os campos marcados acima.')
    // The alert is a claim ABOUT THE FIELDS, so the map has to reach all four editors — one flat
    // object keyed as zod paths, handed to each of them, and nothing else on the page proves it
    // arrives anywhere but the language columns.
    for (const field of ['Identificador', 'Name', 'Chave, Linha 1', 'Alt (PT), Foto principal']) {
      await expect(canvas.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true')
    }
    await expect(canvas.getAllByRole('status')[1]!.textContent).toBe('')
  },
}

/**
 * THE PHOTOS BAG ARRIVES WHOLE, optional members included — the half a spread quietly loses, and
 * the half no other story on this page sets. `PhotosEditor.stories` proves the section; this proves
 * the delivery. Both states are live at once because they are independent: a photo can be uploading
 * while another is waiting for its second press.
 */
export const ThePhotosBagArrivesWhole: Story = {
  args: { photos: { ...PHOTOS, uploading: true, confirmingDeleteKey: letter.photos[0]!.key } },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')[0]!.textContent).toBe('Enviando a foto…')
    await expect(canvas.getByRole('button', { name: 'Sim, apagar, Foto principal' })).toBeInTheDocument()
  },
}

export const APhotoWasRefused: Story = {
  args: { photos: { ...PHOTOS, rejected: { name: 'retrato.tiff', problem: 'wrong_type' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')[0]!.textContent).toBe(
      'Não consigo ler “retrato.tiff”. Mande um JPEG, PNG ou WebP.',
    )
  },
}

export const SaveRefusedByTheServer: Story = {
  args: { saveError: 'INTERNAL' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Algo quebrou do meu lado. Tente de novo em instantes.')
  },
}

/**
 * THE DESTRUCTIVE CONFIRMATION, IN THE SHAPE TASK 3 PINNED FOR THE BRANCH: an inline two-step, the
 * confirm focused as it mounts, and the question wired as `aria-describedby` so it is announced
 * once with the control it belongs to rather than twice by two mechanisms. Not a modal — a dialog
 * needs a focus trap, focus restoration and an Escape handler, all of them outside what this layer
 * may hold.
 *
 * TWO CONTROLS SAY `Cancelar` ON THIS SCREEN and they do opposite things: one leaves the form, one
 * keeps the product. They are already a link and a button, which a screen reader announces; the
 * composed name is what a voice-control user needs, and it is the row's own trick — the visible
 * word plus the title, so SC 2.5.3 holds by construction and no new copy is spent.
 */
export const ConfirmingTheDelete: Story = {
  args: { confirmingDelete: true },
  play: async ({ args, canvas }) => {
    const confirm = canvas.getByRole('button', { name: `Sim, apagar ${letter.name.pt}` })
    await expect(confirm).toHaveFocus()
    await expect(confirm.getAttribute('aria-describedby')).toBe(
      canvas.getByText('Apagar de vez?').getAttribute('id'),
    )

    // The form's own way out is a link and stays exactly what it was.
    await expect(canvas.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/admin/products')
    await expect(canvas.queryByRole('button', { name: 'Apagar este produto' })).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: `Cancelar ${letter.name.pt}` }))
    await expect(args.onCancelDelete).toHaveBeenCalledOnce()
    await expect(args.onConfirmDelete).not.toHaveBeenCalled()
  },
}

export const Deleting: Story = {
  args: { confirmingDelete: true, deleting: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: `Sim, apagar ${letter.name.pt}` })).toBeDisabled()
    // Cancelling is off too: the request has left and closing the pair would not recall it.
    await expect(canvas.getByRole('button', { name: `Cancelar ${letter.name.pt}` })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Salvar produto' })).toBeDisabled()
  },
}

export const InEnglish: Story = {
  globals: { locale: 'en' },
  args: { lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`)).toEqual([
      `H1 ${letter.name.en}`,
      'H2 Portuguese',
      'H2 English',
      'H2 Photos',
      'H2 Data · key and value',
    ])
    await expect(canvas.getByRole('button', { name: 'Save product' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Delete this product' })).toBeInTheDocument()
    await expect(canvas.getByText(/^Editing/).textContent).toBe('Editing · carta-escrita')
  },
}
