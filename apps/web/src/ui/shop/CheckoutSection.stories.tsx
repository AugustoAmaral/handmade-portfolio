import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { CheckoutSection } from './CheckoutSection'

const TAG = '01 · Quem está comprando'

const meta = {
  component: CheckoutSection,
  title: 'Shop/CheckoutSection',
  args: { id: 'checkout-demo', tag: TAG, children: <p>Campos da seção.</p> },
} satisfies Meta<typeof CheckoutSection>
export default meta
type Story = StoryObj<typeof meta>

// Two facts, and they are separate on purpose: the tag can be a heading without naming the
// section (drop `aria-labelledby` and the region disappears while the heading stays), and it can
// name the section without being a heading (swap the <h2> for a <div> and the region survives).
// The checkout needs both — five headings are the outline of a long form, and five named regions
// are how a screen reader jumps between them.
export const Default: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 2 })
    await expect(heading.textContent).toBe(TAG)
    await expect(canvas.getByRole('region', { name: TAG })).toContainElement(heading)
  },
}

// The prototype's `.55` measures 3.82:1 on paper at a 4.5:1 floor. The a11y gate is what holds the
// fix — axe honours element opacity and this tag is long enough to escape the single-character
// blind spot — so this story exists to BE the thing the gate looks at, and the fix was proved by
// setting the opacity back to 55 and watching `color-contrast` redden.
export const LongTagStaysReadable: Story = {
  args: { tag: '02 · Endereço de entrega' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe('02 · Endereço de entrega')
  },
}
