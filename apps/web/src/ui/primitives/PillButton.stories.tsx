import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { PillButton } from './PillButton'

const meta = { component: PillButton, title: 'Primitives/PillButton', args: { onClick: fn() } } satisfies Meta<typeof PillButton>
export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {
  args: { children: 'Colocar na sacola' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Colocar na sacola' }))
    await expect(args.onClick).toHaveBeenCalledTimes(1)
  },
}

export const Outline: Story = { args: { children: 'Cancelar', variant: 'outline' } }

export const AsLink: Story = {
  args: { children: 'Ver o catálogo', href: '/' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
  },
}

export const Disabled: Story = {
  args: { children: 'Esgotado', disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Esgotado' })).toBeDisabled()
  },
}
