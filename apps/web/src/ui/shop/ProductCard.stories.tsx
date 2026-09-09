import { formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { digitalLetter, drawing, letter, soldOutDrawing } from '../../fixtures/products'
import { ProductCard } from './ProductCard'

const meta = {
  component: ProductCard,
  title: 'Shop/ProductCard',
  args: { product: letter, lang: 'pt' },
  // The card is the catalogue grid's <li>, the way CartLine is the drawer's: an <li> outside a
  // list is both wrong and an axe failure (`listitem`). CatalogGrid supplies the <ul> in the app.
  render: (args) => (
    <ul className="w-[280px]">
      <ProductCard {...args} />
    </ul>
  ),
} satisfies Meta<typeof ProductCard>
export default meta
type Story = StoryObj<typeof meta>

// `letter` has `stock: null`, which spec:53 defines as made to order.
export const MadeToOrder: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('link')).toHaveAttribute('href', `/exhibit/${args.product.slug}`)

    // Read off the link's own text, not through `getByText`: the formatted price carries a
    // NO-BREAK SPACE that testing-library's normaliser would turn into a plain one on the element
    // side only, so the query would miss what `textContent` matches exactly.
    await expect(canvas.getByRole('link').textContent).toContain(formatPrice(args.product.priceCents, 'pt'))

    // Each of the four availability stories asserts its OWN label. That is what makes them a set:
    // collapse the four branches into one and three of these four stories go red, whichever branch
    // was left standing.
    await expect(canvas.getByText('Sob encomenda')).toBeInTheDocument()

    // The photo is decorative INSIDE the link — the link's own words already name the piece, so a
    // named image makes it announce the product twice. An image with an empty alt has no role,
    // which is why the first line finds nothing; the second is what keeps this from also passing
    // for a card that renders no image at all.
    await expect(canvas.queryByRole('img')).toBeNull()
    await expect(canvas.getByRole('link').querySelector('img')).not.toBeNull()
  },
}

export const InStock: Story = {
  args: { product: drawing },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(`${drawing.stock} em estoque`)).toBeInTheDocument()
  },
}

export const SoldOutIsStatedNotJustStyled: Story = {
  args: { product: soldOutDrawing },
  play: async ({ canvas }) => {
    // Availability communicated by colour or position alone fails WCAG 1.4.1 and is invisible
    // to a screen reader. The text is the contract.
    await expect(canvas.getByText('Esgotado')).toBeInTheDocument()
    // A sold-out piece keeps its page and its link: the card is how a reader gets to the story of
    // the thing, not just to a buy button.
    await expect(canvas.getByRole('link')).toHaveAttribute('href', `/exhibit/${soldOutDrawing.slug}`)
  },
}

// spec:221 overrides the prototype's `download imediato`: there is no automatic download, so a
// digital piece says how it actually arrives.
export const Digital: Story = {
  args: { product: digitalLetter },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Entrega por e-mail')).toBeInTheDocument()
  },
}
