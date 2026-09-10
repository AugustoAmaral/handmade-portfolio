import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { FieldLabel } from './FieldLabel'
import { TextArea } from './TextArea'
import { contrast, parseColor, surfaceBehind } from '../../../.storybook/contrast'

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

// The assertion has to be about a NUMBER: "an outline exists" would happily pass the 1px
// hue-only signal this story exists to keep out. The surface is measured rather than assumed,
// because the control and its wrapper are both `bg-transparent`.

// The arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch that has
// to assert a ratio for itself. It was six copies until PR 4 Task 3, and by then they had
// diverged; the note at the top of that file records what the divergence was and what it cost.

// The regression this exists to catch is the one TextInput already guards: the first
// implementation styled focus as `outline-none focus:border-accent`, which left
// `outline-style: none` and moved only the 1px border — 2.81:1 between states, under the 3:1 WCAG
// 2.2 SC 2.4.11 asks for, and hue-only. TextArea shares that ring, so it needs its own guard:
// the shared FIELD string is not shared code, it is three copies, and a fix applied to one of
// them is not applied to the others. Asserting the outline is really painted AND that its colour
// clears 3:1 against the background MEASURED behind it fails the moment either half is walked
// back, including by re-adding `outline-none` (Tailwind 4 turns that into
// `--tw-outline-style: none`, which the width utility then resolves to).
export const FocusRing: Story = {
  play: async ({ canvas }) => {
    const field = canvas.getByLabelText(LABEL)

    field.blur()
    const unfocused = getComputedStyle(field).outlineStyle
    await expect(unfocused).toBe('none')

    field.focus()
    const { outlineStyle, outlineWidth, outlineColor, outlineOffset } = getComputedStyle(field)

    await expect(field).toHaveFocus()
    await expect(outlineStyle).not.toBe('none')
    await expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2)
    await expect(parseFloat(outlineOffset)).toBeGreaterThan(0)
    await expect(contrast(parseColor(outlineColor), surfaceBehind(field))).toBeGreaterThanOrEqual(3)
  },
}
