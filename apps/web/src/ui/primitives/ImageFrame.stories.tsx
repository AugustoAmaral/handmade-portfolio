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
    await expect(canvas.getByRole('img', { name: args.alt })).toBeInTheDocument()
  },
}

export const NoPhoto: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ainda sem foto')).toBeInTheDocument()
  },
}
