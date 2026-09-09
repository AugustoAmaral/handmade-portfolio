import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { FieldLabel } from './FieldLabel'
import { TextArea } from './TextArea'

const LABEL = 'Mensagem no cartão'

const meta = {
  component: TextArea,
  title: 'Primitives/TextArea',
  args: { id: 'note', value: '', onChange: fn() },
  render: function Render(args: ComponentProps<typeof TextArea>) {
    const [value, setValue] = useState(args.value)
    return (
      <div className="flex max-w-xs flex-col gap-2">
        <FieldLabel htmlFor={args.id}>{LABEL}</FieldLabel>
        <TextArea
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
} satisfies Meta<typeof TextArea>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Mensagem no cartão' },
  play: async ({ canvas }) => {
    const field = canvas.getByPlaceholderText('Mensagem no cartão')
    await userEvent.type(field, 'Feliz aniversário')
    await expect(field).toHaveValue('Feliz aniversário')
  },
}

export const WithError: Story = {
  args: { value: '', error: 'Escreva a mensagem' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(LABEL)).toHaveAccessibleErrorMessage('Escreva a mensagem')
  },
}
