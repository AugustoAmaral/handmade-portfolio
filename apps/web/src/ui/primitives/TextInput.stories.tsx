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

// WCAG relative luminance, inline and deliberately. The assertion below has to be about a NUMBER:
// "an outline exists" would happily pass the 1px hue-only signal this story was written to keep
// out, and axe ships no rule for focus appearance, so nothing else in the suite is watching.
const PAPER = 'rgb(244, 240, 230)'
const ACCENT = 'rgb(166, 61, 32)'

function luminance(color: string): number {
  const [r, g, b] = color.match(/\d+/g)!.map(Number)
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

// The regression this exists to catch: the first implementation styled focus as
// `outline-none focus:border-accent`, which left `outline-style: none` and moved only the 1px
// border — 2.81:1 between states, under the 3:1 WCAG 2.2 asks for, and hue-only. Asserting the
// outline is really painted AND that its colour clears 3:1 against paper fails the moment either
// half is walked back, including by re-adding `outline-none` (Tailwind 4 turns that into
// `--tw-outline-style: none`, which the width utility then resolves to).
export const FocusRing: Story = {
  args: { placeholder: 'E-mail' },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('E-mail')

    input.blur()
    const unfocused = getComputedStyle(input).outlineStyle
    await expect(unfocused).toBe('none')

    input.focus()
    const focused = getComputedStyle(input)
    const { outlineStyle, outlineWidth, outlineColor, outlineOffset } = focused

    await expect(input).toHaveFocus()
    await expect(outlineStyle).not.toBe('none')
    await expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2)
    await expect(outlineColor).toBe(ACCENT)
    await expect(parseFloat(outlineOffset)).toBeGreaterThan(0)
    await expect(contrast(outlineColor, PAPER)).toBeGreaterThanOrEqual(3)
  },
}

// `disabled` used to be a prop that lied: the component accepted it, `FIELD` styled nothing for
// it, and no story rendered the combination — so a disabled field was pixel-identical to an
// enabled one and axe never even looked at one. Asserting the computed opacity, not just the
// attribute, is what makes the affordance itself non-optional.
export const Disabled: Story = {
  args: { value: 'marina@example.com', disabled: true },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText(LABEL)
    await expect(input).toBeDisabled()
    await expect(parseFloat(getComputedStyle(input).opacity)).toBeLessThan(1)
  },
}
