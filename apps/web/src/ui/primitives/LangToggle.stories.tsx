import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { LangToggle } from './LangToggle'

const meta = {
  component: LangToggle,
  title: 'Primitives/LangToggle',
  args: { lang: 'pt', onToggle: fn() },
} satisfies Meta<typeof LangToggle>
export default meta
type Story = StoryObj<typeof meta>

export const FromPortuguese: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Switch to EN' }))
    await expect(args.onToggle).toHaveBeenCalledTimes(1)
  },
}

export const FromEnglish: Story = {
  args: { lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Switch to PT' })).toHaveTextContent('pt')
  },
}
