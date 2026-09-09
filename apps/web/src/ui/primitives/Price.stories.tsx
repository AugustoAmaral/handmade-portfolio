import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Price } from './Price'

const meta = { component: Price, title: 'Primitives/Price' } satisfies Meta<typeof Price>
export default meta
type Story = StoryObj<typeof meta>

export const Brazilian: Story = {
  args: { cents: 4500, lang: 'pt' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/45,00/)).toBeInTheDocument()
  },
}

export const English: Story = {
  args: { cents: 12000, lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/120\.00/)).toBeInTheDocument()
  },
}
