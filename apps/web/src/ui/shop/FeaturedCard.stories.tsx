import { formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { letter } from '../../fixtures/products'
import { FeaturedCard } from './FeaturedCard'

// The note under the name. Structural, and loud when the structure moves. Typed by the one query
// it uses rather than by the canvas, because testing-library's canvas type is not exported under a
// name tsc can write down — the same reason `CartDrawer.stories.tsx` types its own helper.
function noteOf(canvas: { getByText(text: string): HTMLElement }): HTMLElement {
  const note = canvas.getByText(letter.name.pt).nextElementSibling
  if (!note) throw new Error('the featured card rendered no note under the product name')
  return note as HTMLElement
}

const meta = {
  component: FeaturedCard,
  title: 'Shop/FeaturedCard',
  args: { product: letter, lang: 'pt' },
  // The card positions itself in the corner of the hero's photo cell, so a story has to supply a
  // positioned box with some height for it to sit in the corner of.
  render: (args) => (
    <div className="bg-paper-2 relative h-[320px] w-[420px]">
      <FeaturedCard {...args} />
    </div>
  ),
} satisfies Meta<typeof FeaturedCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    // Built from `formatPrice` rather than typed as a literal: Intl separates "R$" from the digits
    // with a NO-BREAK SPACE, and a literal typed with a normal space fails a `.toBe` while passing
    // `getByText`, whose normaliser collapses both to the same thing. The separator is the design's
    // U+00B7, and `letter`'s subtitle carries one of its own — which is exactly why the note is
    // read as a whole string instead of asserted piece by piece.
    await expect(noteOf(canvas).textContent).toBe(`${formatPrice(letter.priceCents, 'pt')} · ${letter.subtitle.pt}`)
  },
}

// `subtitle` is the one localized field the schema lets an admin leave empty (`max(200)`, no
// `min`), and no fixture has one, so this spreads a fixture the way the plan's own sold-out example
// does. Without the guard in the component the note ends in a separator pointing at nothing.
export const ProductWithoutASubtitle: Story = {
  args: { product: { ...letter, subtitle: { pt: '', en: '' } } },
  play: async ({ canvas }) => {
    await expect(noteOf(canvas).textContent).toBe(formatPrice(letter.priceCents, 'pt'))
  },
}
