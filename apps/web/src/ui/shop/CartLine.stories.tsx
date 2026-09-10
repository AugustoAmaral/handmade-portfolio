import { CART_MAX_QTY, type PublicProduct, formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { drawing, letter } from '../../fixtures/products'
import { CartLine, type CartLineData } from './CartLine'

/**
 * Derives a drawer line from a catalogue fixture instead of hand-writing one. `CartLineData` is a
 * view model, not a schema, so it has no fixture of its own — but everything in it except `qty`
 * comes from a product, and taking it from there is what keeps these stories describing the real
 * catalogue. Exported because `CartDrawer.stories.tsx` needs exactly the same derivation, and a
 * second copy of it is a second place for the line total to be computed differently.
 */
export function lineOf(product: PublicProduct, qty: number): CartLineData {
  return {
    slug: product.slug,
    name: product.name.pt,
    subtitle: product.subtitle.pt,
    unitCents: product.priceCents,
    qty,
    lineCents: product.priceCents * qty,
    type: product.type,
  }
}

const CAP_NOTE = `Máximo de ${CART_MAX_QTY} por peça.`

const meta = {
  component: CartLine,
  title: 'Shop/CartLine',
  // Every named export of a *.stories file is a story unless it is excluded here, so without this
  // `lineOf` is indexed as one, rendered with no args, and fails on `product.name` of undefined.
  excludeStories: ['lineOf'],
  args: { line: lineOf(letter, 2), lang: 'pt', onInc: fn(), onDec: fn() },
  // The <ul> is part of the contract, not scaffolding: CartLine is an <li>, and an <li> outside a
  // list is both wrong and an axe failure (`listitem`). The drawer supplies it in the app.
  render: (args) => (
    <ul className="w-[420px]">
      <CartLine {...args} />
    </ul>
  ),
} satisfies Meta<typeof CartLine>
export default meta
type Story = StoryObj<typeof meta>

// `letter` is R$ 45,00 and the story buys two, which is the entire reason for qty 2: at qty 1 the
// unit price and the line total are the same number and this assertion could not tell them apart.
// The expected strings come from `formatPrice` rather than from a literal because Intl separates
// "R$" from the digits with a NO-BREAK SPACE, and a literal typed with a normal space fails a
// `.toBe` while passing `getByText`, whose normaliser collapses both to the same thing.
export const Default: Story = {
  play: async ({ args, canvas }) => {
    const total = canvas.getByRole('listitem').lastElementChild
    if (!total) throw new Error('the cart line rendered no trailing cell to read the total from')

    await expect(total.textContent).toBe(formatPrice(args.line.lineCents, 'pt'))
    await expect(canvas.queryByText(CAP_NOTE)).toBeNull()
  },
}

// The cap decision, asserted as the three separate facts it is. `useCart` clamps silently, so
// below the cap `+` works, at the cap it must be visibly inert AND say why, and `−` must survive
// both — reaching for the Stepper's plain `disabled` is the obvious wrong fix and it fails here.
export const AtTheCap: Story = {
  args: { line: lineOf(drawing, CART_MAX_QTY) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Diminuir quantidade' })).toBeEnabled()
    await expect(canvas.queryByText(CAP_NOTE)).not.toBeNull()
  },
}

// The stepper is one control per line, and in a drawer there are several. Its accessible name has
// to carry the product or a screen reader hears "Quantidade" three times with nothing to tell it
// apart from the other two.
export const StepperIsNamedAfterTheProduct: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('group')).toHaveAccessibleName(`Quantidade de ${args.line.name}`)
  },
}
