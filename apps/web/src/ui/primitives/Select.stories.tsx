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

// WCAG relative luminance, inline and deliberately — the same arithmetic TextInput's FocusRing
// story carries. The assertion has to be about a NUMBER: "an outline exists" would happily pass
// the 1px hue-only signal this story exists to keep out. The helpers are duplicated rather than
// shared because a CSF file cannot export a non-story without Storybook trying to render it.
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
    await expect(outlineColor).toBe(ACCENT)
    await expect(parseFloat(outlineOffset)).toBeGreaterThan(0)
    await expect(contrast(outlineColor, PAPER)).toBeGreaterThanOrEqual(3)
  },
}
