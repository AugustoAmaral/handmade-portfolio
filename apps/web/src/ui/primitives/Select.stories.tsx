import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { FieldLabel } from './FieldLabel'
import { Select } from './Select'

const LABEL = 'Forma de envio'

const OPTIONS = [
  { value: 'sedex', label: 'Sedex' },
  { value: 'pac', label: 'PAC' },
  { value: 'retirada', label: 'Retirada' },
]

const meta = {
  component: Select,
  title: 'Primitives/Select',
  args: { id: 'shipping', value: 'sedex', options: OPTIONS, onChange: fn() },
  // Local state keeps the controlled select honest — React snaps the DOM value back otherwise —
  // while `args.onChange` stays a spy, so the story can assert which value was picked.
  render: function Render(args: ComponentProps<typeof Select>) {
    const [value, setValue] = useState(args.value)
    return (
      <div className="flex max-w-xs flex-col gap-2">
        <FieldLabel htmlFor={args.id}>{LABEL}</FieldLabel>
        <Select
          {...args}
          value={value}
          onChange={(v) => {
            setValue(v)
            args.onChange(v)
          }}
        />
      </div>
    )
  },
} satisfies Meta<typeof Select>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.selectOptions(canvas.getByLabelText(LABEL), 'pac')
    await expect(args.onChange).toHaveBeenCalledWith('pac')
  },
}
