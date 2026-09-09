import type { Meta, StoryObj } from '@storybook/react-vite'
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
}
