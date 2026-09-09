import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { FieldLabel } from './FieldLabel'
import { TextInput } from './TextInput'

const LABEL = 'E-mail'

const meta = {
  component: TextInput,
  title: 'Primitives/TextInput',
  // `onChange` is required on the component, so it MUST be declared here: `StoryObj<typeof meta>`
  // only makes an arg optional once meta supplies a default, and without it every story owes an
  // `onChange` it never passes.
  args: { id: 'email', value: '', onChange: fn() },
  // Local state, NOT `useArgs`: under the vitest storybook project there is no manager to service
  // the UPDATE_STORY_ARGS message, so `updateArgs` never re-renders and a controlled input stays
  // frozen at its initial value — the typing assertion below silently tested nothing.
  //
  // The render parameter is annotated rather than inferred because the base tsconfig sets
  // `declaration: true`: tsc must be able to NAME this type, and `Props` is not exported (TS4023).
  //
  // The FieldLabel is part of the story because it is part of the contract — TextInput does not
  // name itself, and an unlabelled field fails axe's `label` rule.
  render: function Render(args: ComponentProps<typeof TextInput>) {
    const [value, setValue] = useState(args.value)
    return (
      <div className="flex max-w-xs flex-col gap-2">
        <FieldLabel htmlFor={args.id}>{LABEL}</FieldLabel>
        <TextInput
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
} satisfies Meta<typeof TextInput>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { placeholder: 'E-mail' },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('E-mail')
    await userEvent.type(input, 'marina@example.com')
    await expect(input).toHaveValue('marina@example.com')
  },
}

export const WithError: Story = {
  args: { value: 'nope', error: 'E-mail inválido' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('E-mail inválido')).toBeInTheDocument()
  },
}

// The error is only useful if a screen reader reaches it. `toHaveAccessibleErrorMessage` resolves
// aria-errormessage the way an AT would, so this fails if the id wiring or the announcement
// technique regresses — neither of which the visual assertion above would notice.
export const ErrorIsAnnounced: Story = {
  args: { value: 'nope', error: 'E-mail inválido' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(LABEL)).toHaveAccessibleErrorMessage('E-mail inválido')
  },
}
