import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { FieldLabel } from './FieldLabel'
import { Select } from './Select'
import { contrast, parseColor, surfaceBehind } from '../../../.storybook/contrast'

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

// The assertion has to be about a NUMBER: "an outline exists" would happily pass the 1px
// hue-only signal this story exists to keep out. The surface is measured rather than assumed,
// because the control and its wrapper are both `bg-transparent`.

// The arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch that has
// to assert a ratio for itself. It was six copies until PR 4 Task 3, and by then they had
// diverged; the note at the top of that file records what the divergence was and what it cost.

// Same guard as TextInput and TextArea, and NOT assumed to behave the same: this is a native
// `<select>` with `appearance: auto`, which ships a UA focus ring of its own, so whether the
// authored outline actually wins had to be measured rather than inferred. Measured in headless
// Chromium: unfocused reports `outline-style: none` at the UA's inert 3px, focused reports
// `rgb(166, 61, 32) solid 2px` at offset 2px — the authored ring paints, the UA one does not
// come back.
//
// The regression it catches is the shared one: focus styled as `outline-none focus:border-accent`
// left `outline-style: none` and moved only the 1px border — 2.81:1 between states, under the 3:1
// WCAG 2.2 SC 2.4.11 asks for, and hue-only. The three controls repeat the utility string rather
// than sharing it, so each one needs its own guard.
export const FocusRing: Story = {
  play: async ({ canvas }) => {
    const select = canvas.getByLabelText(LABEL)

    select.blur()
    const unfocused = getComputedStyle(select).outlineStyle
    await expect(unfocused).toBe('none')

    select.focus()
    const { outlineStyle, outlineWidth, outlineColor, outlineOffset } = getComputedStyle(select)

    await expect(select).toHaveFocus()
    await expect(outlineStyle).not.toBe('none')
    await expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2)
    await expect(parseFloat(outlineOffset)).toBeGreaterThan(0)
    await expect(contrast(parseColor(outlineColor), surfaceBehind(select))).toBeGreaterThanOrEqual(3)
  },
}
