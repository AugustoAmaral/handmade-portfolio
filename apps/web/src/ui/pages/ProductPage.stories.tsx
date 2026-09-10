import { formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { digitalLetter, letter, productWithoutPhotos, soldOutDrawing } from '../../fixtures/products'
import { ProductPage } from './ProductPage'
import { inShopShell } from './ShopShell.stories'

const meta = {
  component: ProductPage,
  title: 'Pages/ProductPage',
  decorators: [inShopShell],
  args: { product: letter, lang: 'pt', selectedPhoto: 0, onSelectPhoto: fn(), onAddToCart: fn() },
} satisfies Meta<typeof ProductPage>
export default meta
type Story = StoryObj<typeof meta>

// The richest product the fixtures have: TWO photos and THREE specs. The plan asked for a
// three-photo gallery and a four-spec table and neither is expressible as shipped — Task 7
// measured that ceiling and it still holds here.
export const Gallery: Story = {
  play: async ({ canvas }) => {
    // One heading, and it is the piece. The subtitle above it is an eyebrow rather than a heading
    // precisely so the outline does not start in the middle of the page.
    const headings = canvas.getAllByRole('heading')
    await expect(headings).toHaveLength(1)
    await expect(headings[0]!.tagName).toBe('H1')
    await expect(headings[0]!.textContent).toBe(letter.name.pt)

    // Read off the element rather than queried by text: `Intl` separates `R$` from the digits with
    // a NO-BREAK SPACE, and `getByText` normalises the DOM's copy of it to an ordinary space while
    // leaving the matcher's alone, so the two never meet. The price is the element after the
    // heading, which also pins where it sits.
    await expect(headings[0]!.nextElementSibling?.textContent).toBe(formatPrice(letter.priceCents, 'pt'))
    await expect(canvas.getByText(letter.description.pt)).toBeInTheDocument()

    // Three specs, counted off the `<dl>` the table builds rather than off the fixture's own
    // length in the abstract: a table that rendered one row per PHOTO would still be "some rows".
    const specs = canvas.getByText(letter.specs[0]!.key.pt).closest('dl')
    await expect(specs?.querySelectorAll('dt')).toHaveLength(letter.specs.length)

    // One thumb per photo, and the first is the selected one.
    const thumbs = canvas.getAllByRole('button', { name: /ver foto/i })
    await expect(thumbs).toHaveLength(letter.photos.length)
    await expect(thumbs[0]!).toHaveAttribute('aria-pressed', 'true')
    await expect(thumbs[1]!).toHaveAttribute('aria-pressed', 'false')

    // `letter` is made to order — `stock: null`, physical — so the label is neither a count nor a
    // sold-out notice, and the button is live.
    await expect(canvas.getByText('Sob encomenda')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Colocar na sacola' })).toBeEnabled()

    // The back bar, which is the only link on this page that is not the header's.
    await expect(canvas.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/')
  },
}

export const AddingFromTheProductPageReportsTheSlug: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Colocar na sacola' }))
    // The slug, not just "it fired". A page that reports the wrong piece is worse than one that
    // reports nothing, and a bare `toHaveBeenCalled()` passes for both.
    await expect(args.onAddToCart).toHaveBeenCalledWith(args.product.slug)
  },
}

// Selection is state, and state lives in the container — so the page's job is to report the index
// and nothing else. The thumb stays unpressed after the click here, which is correct: `args`
// do not move, and a component that pressed itself would be holding the selection it is supposed
// to be reporting.
export const SelectsAPhotoByIndex: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: /ver foto/i })[1]!)
    await expect(args.onSelectPhoto).toHaveBeenCalledWith(1)
  },
}

// spec:219's placeholder, on a piece that really is in the catalogue without photographs.
export const WithoutPhotos: Story = {
  args: { product: productWithoutPhotos },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ainda sem foto')).toBeInTheDocument()
    // No strip at all rather than one permanently-pressed thumb: once the thumbs choose the photo,
    // a lone thumb is a control that can only do nothing.
    await expect(canvas.queryAllByRole('button', { name: /ver foto/i })).toHaveLength(0)
    await expect(canvas.queryByRole('img')).toBeNull()
    // Still buyable — a missing photograph is not a missing product.
    await expect(canvas.getByRole('button', { name: 'Colocar na sacola' })).toBeEnabled()
  },
}

// The state the prototype does not have: its CTA is live over every piece. A live button here puts
// a line in the bag that `checkoutRules` and then the API refuse, several screens later.
export const SoldOut: Story = {
  args: { product: soldOutDrawing },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: 'Colocar na sacola' })
    await expect(button).toBeDisabled()
    // A raw DOM click, not `userEvent`: `PillButton` paints `pointer-events-none` over a disabled
    // control and user-event THROWS before it reaches the assertion. The browser refuses to
    // dispatch this one to a disabled button and would dispatch it to an enabled one, so the
    // assertion still reddens the moment the guard goes.
    button.click()
    await expect(args.onAddToCart).not.toHaveBeenCalled()

    // Disabled AND told why, the pairing `CartLine` settled on for the quantity cap. Either half
    // alone is a control that stops responding without saying so, or a sentence next to a button
    // that contradicts it.
    await expect(canvas.getByText('Esgotado')).toBeInTheDocument()
  },
}

// `digitalLetter` is the one fixture with NO specs, and it is digital, so it exercises both
// branches at once. The wording is spec:221's, which overrides the prototype's `download
// imediato`: there is no automatic download.
export const Digital: Story = {
  args: { product: digitalLetter },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Entrega por e-mail')).toBeInTheDocument()
    await expect(canvas.queryByText('Sob encomenda')).toBeNull()
    // An empty `<dl>` announces a list with nothing in it, which describes a table that failed to
    // load rather than a piece with nothing to tabulate.
    canvas.getByText('Sem ficha técnica para esta peça.')
    await expect(canvas.queryByRole('definition')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Colocar na sacola' })).toBeEnabled()
  },
}
