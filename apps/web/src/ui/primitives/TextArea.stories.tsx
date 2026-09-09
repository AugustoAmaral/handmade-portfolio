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

// WCAG relative luminance, inline and deliberately — the same arithmetic TextInput's FocusRing
// story carries. The assertion has to be about a NUMBER: "an outline exists" would happily pass
// the 1px hue-only signal this story exists to keep out. The helpers are duplicated rather than
// shared because a CSF file cannot export a non-story without Storybook trying to render it.
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

// The surface the ring is painted ON, measured instead of assumed. The control is `bg-transparent`
// and so is its wrapper, so the first opaque background up the tree is what a user actually sees
// behind the outline. Reading it from the DOM is what gives the contrast assertion below something
// to do: with a file-local literal on both sides it was arithmetic over two constants two lines
// after `outlineColor` had already been pinned to one of them, so it could only ever run in the
// case where it was guaranteed to pass.
function isOpaque(color: string): boolean {
  const parts = color.match(/[\d.]+/g)
  return parts != null && (parts.length < 4 || Number(parts[3]) > 0)
}

function surfaceBehind(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const background = getComputedStyle(node).backgroundColor
    if (isOpaque(background)) return background
  }
  // Louder than a default: a white fallback would quietly hand the assertion the highest-contrast
  // background there is and pass no matter what the ring did.
  throw new Error('nothing opaque behind the control to measure the focus ring against')
}

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
    await expect(contrast(outlineColor, surfaceBehind(field))).toBeGreaterThanOrEqual(3)
  },
}
