import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { ImageFrame } from './ImageFrame'

// An inline data URI, not a file or a remote URL: the browser project must not depend on the
// network or on an asset pipeline to decide whether this story passes.
const SWATCH = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="#c9bfa6"/></svg>',
)}`

const meta = {
  component: ImageFrame,
  title: 'Primitives/ImageFrame',
  args: { alt: 'Foto do vaso Cerrado' },
  decorators: [
    (Story) => (
      <div className="w-60">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImageFrame>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { src: SWATCH },
  play: async ({ canvas, args }) => {
    const img = canvas.getByRole('img', { name: args.alt })
    await expect(img).toBeInTheDocument()
    // The other half of `Contain` below. `fit` is one ternary, and a ternary is only guarded when
    // both of its branches are somebody's assertion: force it either way and exactly one of these
    // two stories goes red.
    await expect(getComputedStyle(img).objectFit).toBe('cover')
  },
}

// The gallery's main slot, added in Task 7. `object-contain` is the prototype's own choice for the
// large product view — cropping a drawing to fill a 4/5 box removes part of what is being sold —
// and it is a computed style with no visible text, so nothing else in the suite would notice it
// quietly reverting to `cover`.
export const Contain: Story = {
  args: { src: SWATCH, fit: 'contain' },
  play: async ({ canvas, args }) => {
    await expect(getComputedStyle(canvas.getByRole('img', { name: args.alt })).objectFit).toBe('contain')
  },
}

export const NoPhoto: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ainda sem foto')).toBeInTheDocument()
  },
}

// The hero's shape, added in Task 6, and it fails the same silent way `PillButton`'s `block` size
// does: a frame that stretches to nothing is a frame with no height, no error and no complaint
// anywhere. Measured against the positioned box it is given, because nothing else in the suite
// looks at how tall this one ends up.
export const Fill: Story = {
  args: { src: SWATCH, ratio: 'fill' },
  decorators: [
    (Story) => (
      <div className="relative h-[200px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('img', { name: args.alt }).getBoundingClientRect().height).toBe(200)
  },
}
