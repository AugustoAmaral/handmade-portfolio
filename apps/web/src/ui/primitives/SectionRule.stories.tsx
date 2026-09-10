import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { measure, opacityOf } from '../../../.storybook/contrast'
import { EYEBROW_TYPE, Eyebrow } from './Eyebrow'
import { SectionRule } from './SectionRule'

const meta = {
  component: SectionRule,
  title: 'Primitives/SectionRule',
  args: { children: 'Fotos' },
} satisfies Meta<typeof SectionRule>
export default meta
type Story = StoryObj<typeof meta>

/**
 * The prototype's ruled section header: mono uppercase over a 1px ink rule, with an optional
 * action pinned to the right of the same rule. It appears four times in the admin form alone
 * (the two language columns, the photos section and the specs section) and was inlined as a class
 * string the first time; this is the hoist.
 */
export const Ruled: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 2, name: 'Fotos' })
    await expect(heading.textContent).toBe('Fotos')
    // The rule is on the wrapper and not on the heading, which is what lets an action share it.
    // Measured as a WIDTH: Tailwind's preflight sets `border-style: solid` on every element at a
    // width of 0, so a style assertion here reads `solid` for a border nobody drew.
    await expect(getComputedStyle(heading).borderBottomWidth).toBe('0px')
    const wrapper = heading.parentElement!
    await expect(getComputedStyle(wrapper).borderBottomWidth).toBe('1px')
  },
}

/**
 * FULL STRENGTH, AND THAT IS THE WHOLE REASON THIS IS NOT AN `Eyebrow` VARIANT. Both are made of
 * the same type recipe, which is why the recipe is now a shared constant rather than a fifth copy
 * of four utility classes — but `Eyebrow` is a muted tag at `opacity-65` and the prototype draws
 * these headings at full ink on purpose. Adding `opacity-65` here to "match" would dim every
 * section heading in the admin form.
 *
 * The relational line is what holds the arithmetic: every other ratio on this branch is a `>=`, so
 * a measurement bug that errs HIGH passes all of them. The eyebrow beside it MUST measure strictly
 * less than the heading, which needs no magic number.
 */
export const IsFullStrengthUnlikeAnEyebrow: Story = {
  args: {
    children: 'Fotos',
    action: <Eyebrow>{'4 fotos'}</Eyebrow>,
  },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { name: 'Fotos' })
    await expect(opacityOf(heading)).toBe(1)
    await expect(measure(heading, 'color')).toBeGreaterThanOrEqual(4.5)

    const eyebrow = canvas.getByText('4 fotos')
    await expect(opacityOf(eyebrow)).toBeCloseTo(0.65, 5)
    await expect(measure(eyebrow, 'color')).toBeGreaterThanOrEqual(4.5)
    await expect(measure(eyebrow, 'color')).toBeLessThan(measure(heading, 'color'))

    // Both are cut from the same recipe, and this is the line that fails if one of them drifts.
    for (const token of EYEBROW_TYPE.split(' ')) {
      await expect(heading.className).toContain(token)
      await expect(eyebrow.className).toContain(token)
    }
  },
}

/**
 * THE ONE ALTERNATIVE LEVEL, for the admin order detail, whose pane is titled by the customer's
 * name and whose sections are about that order rather than peers of it. Level 2 is still the
 * default, so nothing written before this prop existed moved.
 */
export const NestedUnderAPaneTitle: Story = {
  args: { level: 3, children: 'Entrega' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 3, name: 'Entrega' })).toBeInTheDocument()
    await expect(canvas.queryByRole('heading', { level: 2 })).toBeNull()
  },
}

/** The action shares the rule rather than sitting under it, and it keeps its own semantics. */
export const CarriesAnAction: Story = {
  args: {
    id: 'photos-heading',
    children: 'Fotos',
    action: (
      <button type="button" className="border-ink border-b">
        Adicionar foto
      </button>
    ),
  },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { name: 'Fotos' })
    await expect(heading).toHaveAttribute('id', 'photos-heading')
    const action = canvas.getByRole('button', { name: 'Adicionar foto' })
    await expect(heading.parentElement!.contains(action)).toBe(true)
    // Baseline-aligned on one line, which is the design's shape: the action is not a second row.
    await expect(getComputedStyle(heading.parentElement!).alignItems).toBe('baseline')
  },
}
