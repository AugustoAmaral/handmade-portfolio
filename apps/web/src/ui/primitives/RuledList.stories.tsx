import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { RuledList, RuledRow } from './RuledList'

const meta = { component: RuledList, title: 'Primitives/RuledList' } satisfies Meta<typeof RuledList>
export default meta
type Story = StoryObj<typeof meta>

// Rows go through `args.children` rather than a `render` override: `children` is required, so a
// render-only story would still owe `args` it never reads. The fragment adds no DOM node, so the
// three rows stay direct flex children of the list.
export const ThreeRows: Story = {
  args: {
    children: (
      <>
        <RuledRow>Subtotal</RuledRow>
        <RuledRow>Frete</RuledRow>
        <RuledRow>Total</RuledRow>
      </>
    ),
  },
  play: async ({ canvas }) => {
    // The paper cell is what makes the ink underneath read as a 1px rule instead of a black block.
    // Nothing in the a11y gate looks at a background that is only ever seen through a gap, so the
    // row losing `bg-paper` would be invisible to every other check on the branch.
    const row = canvas.getByText('Subtotal')
    const list = row.parentElement!
    await expect(getComputedStyle(row).backgroundColor).not.toBe(getComputedStyle(list).backgroundColor)
  },
}

/**
 * THE OTHER ELEMENT WITH A REASON. `CheckoutShippingSection`'s rows have to be `<label>`s — that is
 * what makes the whole row a click target for the radio inside it — and before the sweep they
 * carried `bg-paper px-4 py-3.5` copied out, because `RuledRow` was a `<div>` and could not be one.
 * The assertion is the BACKGROUND rather than the tag: a row that loses `bg-paper` shows the list's
 * ink through and reads as a rendering fault, and that is what a second copy of three classes was
 * free to do.
 */
export const AsAClickableOption: Story = {
  args: {
    children: (
      <RuledRow as="label" className="flex justify-between gap-4">
        <input type="radio" name="probe" />
        <span>Correios PAC</span>
      </RuledRow>
    ),
  },
  play: async ({ canvas, canvasElement }) => {
    const row = canvasElement.querySelector('label')!
    await expect(row).toBeInTheDocument()
    // The radio is reachable BY THE ROW, which is the only reason the tag matters.
    await expect(canvas.getByLabelText('Correios PAC')).toHaveAttribute('type', 'radio')
    // Paper over ink, measured rather than named: the utility compiles to nothing if its token is
    // gone, and a class assertion cannot see that.
    const paper = getComputedStyle(row).backgroundColor
    await expect(paper).not.toBe(getComputedStyle(row.parentElement!).backgroundColor)
    await expect(parseFloat(getComputedStyle(row).paddingLeft)).toBeGreaterThan(0)
  },
}

/**
 * The shape PR 4 Task 6 needed: the same hairline recipe as a description list, for the admin
 * order detail's contact block. `getByRole('term')` is what fails if `as` stops reaching the
 * element — a `<dt>` outside a `<dl>` has no implicit role.
 */
export const AsADescriptionList: Story = {
  args: {
    as: 'dl',
    children: (
      <RuledRow className="flex justify-between gap-4">
        <dt>E-mail</dt>
        <dd>marina@example.com</dd>
      </RuledRow>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('term').textContent).toBe('E-mail')
    await expect(canvas.getByRole('definition').textContent).toBe('marina@example.com')
  },
}
