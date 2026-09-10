import { computeTotals, formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { cartLines } from '../../fixtures/checkout'
import { drawing, letter } from '../../fixtures/products'
import { CartDrawer } from './CartDrawer'
import { lineOf } from './CartLine.stories'

// `cartLines` is the totals fixture for these two products at these two quantities, so the
// quantities are read back out of it rather than typed twice: the displayed lines and the money
// below them cannot disagree, and the money is the real `computeTotals`, not arithmetic done here.
const LINES = [lineOf(letter, cartLines[0]!.qty), lineOf(drawing, cartLines[1]!.qty)]
const TOTALS = computeTotals(cartLines, 'pac')

const NOT_CALCULATED = 'Calculado no pagamento'

/**
 * The `<dd>` next to a totals `<dt>`. Structural, and loud when the structure moves. Typed by the
 * one query it uses rather than by the canvas: the base tsconfig sets `declaration: true`, so tsc
 * has to be able to NAME the parameter type, and testing-library's is not exported under a name.
 */
function valueOf(canvas: { getByText(text: string): HTMLElement }, label: string): HTMLElement {
  const term = canvas.getByText(label)
  const value = term.nextElementSibling
  if (!value) throw new Error(`the totals row "${label}" has no value cell after its label`)
  return value as HTMLElement
}

const meta = {
  component: CartDrawer,
  title: 'Shop/CartDrawer',
  args: {
    open: true,
    lines: LINES,
    lang: 'pt',
    itemsCents: TOTALS.itemsCents,
    shippingCents: TOTALS.shippingCents,
    totalCents: TOTALS.totalCents,
    onInc: fn(),
    onDec: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CartDrawer>
export default meta
type Story = StoryObj<typeof meta>

export const IncrementsAndDecrementsBySlug: Story = {
  play: async ({ args, canvas }) => {
    const second = within(canvas.getAllByRole('group', { name: /quantidade/i })[1]!)

    // The slug, not just "it fired": a drawer that reports the wrong line is worse than one
    // that reports nothing, and a bare toHaveBeenCalled() passes for both.
    await userEvent.click(second.getByRole('button', { name: 'Aumentar quantidade' }))
    await expect(args.onInc).toHaveBeenCalledWith(args.lines[1]!.slug)

    await userEvent.click(second.getByRole('button', { name: 'Diminuir quantidade' }))
    await expect(args.onDec).toHaveBeenCalledWith(args.lines[1]!.slug)
  },
}

// Every number in the footer, each against a different one of the three, because they are three
// props that arrive already computed and the only mistake available is wiring one into another's
// row — which reads as perfectly plausible money.
export const Totals: Story = {
  play: async ({ canvas }) => {
    await expect(valueOf(canvas, 'Subtotal').textContent).toBe(formatPrice(TOTALS.itemsCents, 'pt'))
    await expect(valueOf(canvas, 'Frete').textContent).toBe(formatPrice(TOTALS.shippingCents, 'pt'))
    await expect(valueOf(canvas, 'Total').textContent).toBe(formatPrice(TOTALS.totalCents, 'pt'))
  },
}

// The other half of the em-dash guard is the story above: an em dash rendered unconditionally
// still satisfies THIS assertion, and only `Totals` catches it. Neither is complete alone.
export const ShippingUnknownShowsAnEmDash: Story = {
  args: { shippingCents: null, totalCents: TOTALS.itemsCents },
  play: async ({ canvas }) => {
    await expect(valueOf(canvas, 'Frete').textContent).toBe(`—${NOT_CALCULATED}`)
  },
}

// The prototype keeps the totals and a live "Ir para o pagamento" over an empty bag, and that CTA
// opens a checkout with nothing in it. Both are gone here, and both are asserted separately
// because hiding one and not the other is exactly the half-fix this replaces.
export const Empty: Story = {
  args: { lines: [], itemsCents: 0, shippingCents: null, totalCents: 0 },
  play: async ({ canvas }) => {
    // getByText throws when the message is missing, which IS the assertion — an `expect` after it
    // could only ever pass.
    canvas.getByText('A sacola está vazia.')
    await expect(canvas.queryByText('Ir para o pagamento')).toBeNull()
    await expect(canvas.queryByText('Total')).toBeNull()
  },
}

export const IsANamedDialog: Story = {
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole('dialog')
    // axe's `aria-dialog-name` fails the build for a dialog with NO name; it is indifferent to
    // which name. Pinning it to the visible heading is what stops the name drifting away from the
    // words on screen, where a voice-control user would be reading them.
    await expect(dialog).toHaveAccessibleName('Sua sacola')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
  },
}

export const ClosesFromTheHeaderButton: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Fechar a sacola' }))
    await expect(args.onClose).toHaveBeenCalledOnce()
  },
}

// A closed drawer renders nothing at all, rather than something visually hidden. Anything still in
// the tree is still in the accessibility tree and still in the tab order: a checkout link a
// keyboard user can reach through a drawer they never opened.
export const Closed: Story = {
  args: { open: false },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('dialog')).toBeNull()
  },
}
