import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { FieldLabel } from './FieldLabel'
import { TextInput } from './TextInput'

// The label is rendered with the control it names. On its own it would prove nothing: `htmlFor`
// is the whole contract of this primitive, and only a real control with the matching `id` shows
// the association actually resolves.
const meta = {
  component: FieldLabel,
  title: 'Primitives/FieldLabel',
  args: { htmlFor: 'recipient', children: 'Nome de quem recebe' },
  render: (args) => (
    <div className="flex max-w-xs flex-col gap-2">
      <FieldLabel {...args} />
      <TextInput id={args.htmlFor} value="" onChange={() => {}} />
    </div>
  ),
} satisfies Meta<typeof FieldLabel>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Nome de quem recebe')).toBeInTheDocument()
  },
}

export const WithHint: Story = {
  args: { hint: '(opcional)' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('(opcional)')).toBeInTheDocument()
  },
}
