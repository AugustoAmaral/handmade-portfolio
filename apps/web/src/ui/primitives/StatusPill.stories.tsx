import { ORDER_STATUSES } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { StatusPill } from './StatusPill'

// `status` is a required prop, so `StoryObj<typeof meta>` demands `args` on EVERY story —
// including a gallery story that renders its own tree and never reads them. Declaring the
// default here is what makes story-level `args` optional, so `EveryStatus` can be render-only.
const meta = {
  component: StatusPill,
  title: 'Primitives/StatusPill',
  args: { status: 'pending' },
} satisfies Meta<typeof StatusPill>
export default meta
type Story = StoryObj<typeof meta>

export const Paid: Story = {
  args: { status: 'paid' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Em produção')).toBeInTheDocument()
  },
}

export const EveryStatus: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUSES.map((status) => (
        <StatusPill key={status} status={status} />
      ))}
    </div>
  ),
}
