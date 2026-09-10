import { type FieldErrors, fieldErrorsFromIssues, productInputSchema } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { letter } from '../../fixtures/products'
import { measure, opacityOf } from '../../../.storybook/contrast'
import { basicsFromProduct, centsFromReais, stockFrom } from './ProductBasicsFields'
import {
  EMPTY_LOCALIZED,
  ProductLocalizedFields,
  type ProductLocalizedValues,
  localizedFromProduct,
} from './ProductLocalizedFields'

// The arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch that has
// to assert a ratio for itself.

/** The same assembly `ProductBasicsFields.stories.tsx` uses; the schema is the only real spec. */
function inputFrom(localized: ProductLocalizedValues) {
  const basics = basicsFromProduct(letter)
  return {
    slug: basics.slug,
    priceCents: centsFromReais(basics.price),
    stock: stockFrom(basics),
    type: basics.type,
    active: basics.active,
    ...localized,
  }
}

/**
 * Errors from a real rejected parse: a product with no Portuguese name and no English description.
 * `localizedTextSchema` is `.min(1)` on BOTH halves, so an empty box in either column is a 400 —
 * which is the design's own note at the top of the form, enforced for the first time.
 */
const rejected = productInputSchema.safeParse(
  inputFrom({
    name: { pt: '', en: 'Handwritten letter' },
    subtitle: { pt: '', en: '' },
    description: { pt: 'Escrita à mão.', en: '' },
  }),
)
const parseErrors: FieldErrors = rejected.success ? {} : fieldErrorsFromIssues(rejected.error.issues)

const meta = {
  component: ProductLocalizedFields,
  title: 'Admin/ProductLocalizedFields',
  args: {
    values: localizedFromProduct(letter),
    errors: {},
    onChange: fn(),
  },
  render: function Render(args: ComponentProps<typeof ProductLocalizedFields>) {
    const [values, setValues] = useState(args.values)
    return (
      <ProductLocalizedFields
        {...args}
        values={values}
        onChange={(next) => {
          setValues(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof ProductLocalizedFields>
export default meta
type Story = StoryObj<typeof meta>

/**
 * The two columns as the design draws them, in Portuguese: `Nome` on the left and `Name` on the
 * right, each holding its own half of the same product.
 *
 * THE SIX EQUALITIES ARE THE POINT. Both halves of all three pairs are on screen at once and each
 * box holds the language of its column — swap the two columns' `column` prop and every line here
 * fails, which is exactly the mistake that is invisible to a reader who does not speak both.
 */
export const Editing: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'Português' })).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'English' })).toBeInTheDocument()

    await expect(canvas.getByLabelText('Nome')).toHaveValue('Carta escrita à mão')
    await expect(canvas.getByLabelText('Name')).toHaveValue('Handwritten letter')
    await expect(canvas.getByLabelText('Subdescrição')).toHaveValue('Papel algodão · 2 folhas')
    await expect(canvas.getByLabelText('Subtitle')).toHaveValue('Cotton paper · 2 sheets')
    await expect(canvas.getByLabelText('Descrição')).toHaveValue(letter.description.pt)
    await expect(canvas.getByLabelText('Description')).toHaveValue(letter.description.en)
    // Six rows, the design's number: a description box one line tall is where the prose that sells
    // the piece gets written badly.
    await expect(canvas.getByLabelText('Descrição')).toHaveAttribute('rows', '6')
  },
}

/**
 * THE KEY COLLISION, ASSERTED. `Nome` and `Name` are two different fields whose labels are written
 * in the language of their column, and on this project the key IS the English sentence with one
 * instance — so keying both as `Name` puts one entry in `pt.json` and labels both boxes the same
 * word. Keyed `Name (PT)` and `Name (EN)`, the Portuguese panel is the design and the English one
 * is unambiguous; the two lookups below return two different elements, which one shared key could
 * not produce.
 *
 * The heading is what disambiguates them for a reader who never sees the two columns, so it is a
 * real region name rather than a styled `<div>`: the label plus the region is the whole sentence.
 */
export const KeysEachColumnSeparately: Story = {
  play: async ({ canvas }) => {
    // The two lookups ARE the first half of the assertion: one shared key would put the same
    // label on both boxes and `getByLabelText` throws on a duplicate rather than returning one.
    const pt = canvas.getByLabelText('Nome')
    const en = canvas.getByLabelText('Name')

    const portuguese = canvas.getByRole('region', { name: 'Português' })
    await expect(portuguese.contains(pt)).toBe(true)
    await expect(portuguese.contains(en)).toBe(false)

    const headings = canvas.getAllByRole('heading')
    await expect(headings.map((heading) => heading.textContent)).toEqual(['Português', 'English'])
  },
}

/**
 * In English the keys render themselves, and the suffix is what stops the two columns collapsing
 * into two fields called `Name`. `English` is the one entry in `pt.json` deliberately identical to
 * its key: the column is an island of English content and naming it in English is the fact the
 * reader needs — the design's own choice, kept.
 */
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Name (PT)')).toHaveValue('Carta escrita à mão')
    await expect(canvas.getByLabelText('Name (EN)')).toHaveValue('Handwritten letter')
    await expect(canvas.getByLabelText('Subtitle (PT)')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Description (EN)')).toBeInTheDocument()

    const headings = canvas.getAllByRole('heading')
    await expect(headings.map((heading) => heading.textContent)).toEqual(['Portuguese', 'English'])
  },
}

/** A new draft: six empty boxes, both columns, nothing pre-filled from the other one. */
export const NewProduct: Story = {
  args: { values: EMPTY_LOCALIZED },
  play: async ({ canvas }) => {
    const boxes = [...canvas.getAllByRole('textbox')]
    await expect(boxes).toHaveLength(6)
    for (const box of boxes) await expect(box).toHaveValue('')
  },
}

/**
 * EDITING ONE HALF LEAVES THE OTHER FIVE ALONE. The values are three nested pairs, and the obvious
 * spread — replacing `name` with `{ pt: next }` — drops the English name silently, which the form
 * would not show and the API would reject as `name.en: Required` a screen away from the edit.
 */
export const EditsOneHalfOfThePair: Story = {
  play: async ({ args, canvas }) => {
    const pt = canvas.getByLabelText('Nome')
    await userEvent.clear(pt)
    await userEvent.type(pt, 'Carta nova')

    await expect(args.onChange).toHaveBeenLastCalledWith({
      ...localizedFromProduct(letter),
      name: { pt: 'Carta nova', en: 'Handwritten letter' },
    })
    await expect(canvas.getByLabelText('Name')).toHaveValue('Handwritten letter')
    await expect(canvas.getByLabelText('Descrição')).toHaveValue(letter.description.pt)
  },
}

/**
 * THE SUBTITLE TRAP, WHICH IS THE REASON THE VALUES ARE TYPED AS A PAIR AND NOT AS A PARTIAL.
 * `subtitle` carries `.default({ pt: '', en: '' })` and a default only fires when the field is
 * ENTIRELY absent: `{ pt: 'x' }` is `subtitle.en: Required`, because both keys are required even
 * though empty strings are allowed. So a form that sends only the half somebody typed gets a 400
 * about a field that is optional, and the three lines below are the three cases in order —
 * both halves empty is fine, the field missing altogether is fine, one half alone is not.
 */
export const SubtitleNeedsBothKeys: Story = {
  play: async () => {
    const values = localizedFromProduct(letter)
    const empty = { ...values, subtitle: { pt: '', en: '' } }
    await expect(productInputSchema.safeParse(inputFrom(empty)).success).toBe(true)

    const { subtitle: _dropped, ...withoutSubtitle } = inputFrom(values)
    const defaulted = productInputSchema.safeParse(withoutSubtitle)
    await expect(defaulted.success).toBe(true)
    if (defaulted.success) await expect(defaulted.data.subtitle).toEqual({ pt: '', en: '' })

    const halfFilled = productInputSchema.safeParse({ ...withoutSubtitle, subtitle: { pt: 'Papel algodão' } })
    await expect(halfFilled.success).toBe(false)
    if (!halfFilled.success) {
      await expect(fieldErrorsFromIssues(halfFilled.error.issues)['subtitle.en']).toEqual(['Required'])
    }
  },
}

/**
 * The errors are a real rejected parse decoded by `fieldErrorsFromIssues`, whose keys are zod
 * paths — `name.pt`, `description.en` — and they have to land in the right COLUMN, which is the
 * only thing that could go wrong here and the only thing asserted. The key list comes first: a
 * payload that accidentally parsed would leave the object empty and everything below it green.
 */
export const ShowsFieldErrors: Story = {
  args: {
    values: {
      name: { pt: '', en: 'Handwritten letter' },
      subtitle: { pt: '', en: '' },
      description: { pt: 'Escrita à mão.', en: '' },
    },
    errors: parseErrors,
  },
  play: async ({ canvas }) => {
    await expect(Object.keys(parseErrors)).toEqual(['name.pt', 'description.en'])

    const namePt = canvas.getByLabelText('Nome')
    await expect(namePt).toHaveAttribute('aria-invalid', 'true')
    await expect(namePt).toHaveAccessibleDescription('String must contain at least 1 character(s)')

    await expect(canvas.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
    await expect(canvas.getByLabelText('Descrição')).not.toHaveAttribute('aria-invalid')
    await expect(canvas.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true')
    // Empty is legal for a subtitle, so neither half of that pair is marked.
    await expect(canvas.getByLabelText('Subdescrição')).not.toHaveAttribute('aria-invalid')
  },
}

/**
 * The labels are `FieldLabel` at `opacity-75` (7.39:1) and the column headings are FULL-STRENGTH
 * ink — not the checkout section's `opacity-65`, which was a correction of a muted `.55` tag this
 * heading never had. The pair is measured rather than eyeballed because the difference between
 * them is the entire visual hierarchy of the column.
 *
 * THE RELATIONAL LINE IS THE ONE THAT HOLDS THE ARITHMETIC. Every other ratio here is a `>=`, so a
 * measurement bug that errs HIGH passes all of them — deleting the alpha compositing from `over()`
 * once left the whole suite green, because an uncomposited muted colour reads as more legible
 * rather than less. A label that measures the same as the heading above it is not being measured
 * through its opacity at all.
 */
export const MeasuresItsLabelsAgainstItsHeadings: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { name: 'Português' })
    await expect(opacityOf(heading)).toBe(1)
    await expect(measure(heading, 'color')).toBeGreaterThanOrEqual(4.5)

    const label = canvas.getByText('Nome')
    await expect(opacityOf(label)).toBeCloseTo(0.75, 5)
    await expect(measure(label, 'color')).toBeGreaterThanOrEqual(4.5)
    await expect(measure(label, 'color')).toBeLessThan(measure(heading, 'color'))
  },
}
