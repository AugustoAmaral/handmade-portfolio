import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { Stepper } from './Stepper'

const meta = {
  component: Stepper,
  title: 'Primitives/Stepper',
  args: { qty: 2, onDecrement: fn(), onIncrement: fn() },
} satisfies Meta<typeof Stepper>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Aumentar quantidade' }))
    await expect(args.onIncrement).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Diminuir quantidade' }))
    await expect(args.onDecrement).toHaveBeenCalledTimes(1)
  },
}

export const Disabled: Story = { args: { disabled: true } }
