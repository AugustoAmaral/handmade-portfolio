import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { digitalLetter, drawing, letter } from '../../fixtures/products'
import { SpecsTable } from './SpecsTable'

const meta = {
  component: SpecsTable,
  title: 'Shop/SpecsTable',
  args: { specs: letter.specs, lang: 'pt' },
} satisfies Meta<typeof SpecsTable>
export default meta
type Story = StoryObj<typeof meta>

export const EverySpecIsATermAndItsDefinition: Story = {
  play: async ({ canvas, args }) => {
    const terms = canvas.getAllByRole('term')
    const definitions = canvas.getAllByRole('definition')
    await expect(terms).toHaveLength(args.specs.length)
    await expect(definitions).toHaveLength(args.specs.length)

    // Read off the fixture rather than typed here, and in the story's own language, so the two
    // things that make this a description list are both pinned: the text is the catalogue's, and
    // it is the catalogue's IN THE LANGUAGE THE PROP NAMES. `text-transform: uppercase` leaves
    // textContent alone, so a `.toUpperCase()` smuggled into the component reddens this too — the
    // fixture's keys are `Formato`, not `FORMATO`.
    await expect(terms.map((term) => term.textContent)).toEqual(args.specs.map((spec) => spec.key[args.lang]))
    await expect(definitions.map((value) => value.textContent)).toEqual(
      args.specs.map((spec) => spec.value[args.lang]),
    )

    // The adjacency is the whole point of the markup and neither list above can see it: pair row
    // n's key with row n+1's value and both lists are still complete and still in order.
    for (const [index, term] of terms.entries()) {
      await expect(term.nextElementSibling).toBe(definitions[index])
    }
  },
}

export const OneSpec: Story = {
  args: { specs: drawing.specs },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('term')).toHaveLength(1)
    // The boundary the empty case hangs on is `=== 0`, not `<= 1`. Widen that guard by one and this
    // is the only story in the file that notices.
    await expect(canvas.queryByText('Sem ficha técnica para esta peça.')).toBeNull()
  },
}

export const Empty: Story = {
  args: { specs: digitalLetter.specs },
  play: async ({ canvas, canvasElement }) => {
    // getByText throws when the message is missing, which IS the assertion — an `expect` after it
    // could only ever pass.
    canvas.getByText('Sem ficha técnica para esta peça.')
    // Not an empty <dl>: it announces a list with nothing in it, which describes a table that
    // failed to load rather than a piece with nothing to tabulate. This assertion is the ONLY thing
    // holding that — an empty <dl> was rendered here on purpose to check, and axe's
    // `definition-list` rule passed it without a word.
    await expect(canvasElement.querySelector('dl')).toBeNull()
    await expect(canvas.queryAllByRole('term')).toHaveLength(0)
  },
}

// `lang` is a prop because `i18n.resolvedLanguage` is `undefined` in English; a component reading
// the language off the instance renders blanks on every English page. The story above is written
// against `args.lang`, so it follows this one — and the literal below is what stops both of them
// passing for a component that hard-codes `.pt`.
export const InEnglish: Story = {
  args: { lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('180gsm cotton')).toBeInTheDocument()
    await expect(canvas.getAllByRole('term').map((term) => term.textContent)).toEqual(
      letter.specs.map((spec) => spec.key.en),
    )
  },
}
