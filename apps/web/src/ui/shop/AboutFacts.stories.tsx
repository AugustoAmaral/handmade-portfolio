import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { AboutFacts } from './AboutFacts'

// Verbatim from the prototype's `aboutFacts`, in its order. Not the component's arguments — it
// takes none — so these assert that the band is wired to pt.json and to the numbers the design
// committed to, which is the whole of what this component can get wrong.
const FACTS = [
  { value: '4', label: 'peças no catálogo' },
  { value: '2026', label: 'primeira carta enviada' },
  { value: '5 dias', label: 'prazo médio de produção' },
  { value: '1', label: 'pessoa fazendo tudo' },
]

const meta = { component: AboutFacts, title: 'Shop/AboutFacts' } satisfies Meta<typeof AboutFacts>
export default meta
type Story = StoryObj<typeof meta>

export const EveryFactIsALabelAndItsNumber: Story = {
  play: async ({ canvas }) => {
    const terms = canvas.getAllByRole('term')
    const definitions = canvas.getAllByRole('definition')

    // The label is the term and the number is its definition, not the other way round: `4` alone
    // describes nothing, and a band of bare numerals read out in sequence is what the prototype's
    // <div>s produce. Read as text so a `.toUpperCase()` in the component reddens this too —
    // `text-transform` leaves textContent as written.
    await expect(terms.map((term) => term.textContent)).toEqual(FACTS.map((fact) => fact.label))
    await expect(definitions.map((value) => value.textContent)).toEqual(FACTS.map((fact) => fact.value))

    // Neither list above can see the pairing: give `2026` the lead-time label and both are still
    // complete and still in order. axe cannot see it either — Task 7 measured the `definition-list`
    // rule silent on an empty <dl>, and it has nothing at all to say about which <dd> follows which
    // <dt> — so this assertion is the only thing holding the association.
    for (const [index, term] of terms.entries()) {
      await expect(term.nextElementSibling).toBe(definitions[index])
    }
  },
}

export const TheNumberIsPaintedAboveItsLabel: Story = {
  play: async ({ canvas }) => {
    const terms = canvas.getAllByRole('term')
    const definitions = canvas.getAllByRole('definition')
    // The design puts the number on top; a <dl> puts the term first. The cell resolves that with
    // `flex-col-reverse` instead of swapping the elements, and this is what proves the design half
    // of that bargain still holds. Measured from the boxes rather than asserted on the class name:
    // an arbitrary Tailwind value that fails to compile leaves the class attribute exactly as
    // written and the cell rendering in plain DOM order.
    for (const [index, term] of terms.entries()) {
      const value = definitions[index]!
      await expect(value.getBoundingClientRect().bottom).toBeLessThan(term.getBoundingClientRect().top)
    }
  },
}

// The plan asked for a single-fact story, "so the grid does not collapse oddly". A band of four
// fixed editorial facts cannot render one, and a prop added so a story could reach a state the app
// never reaches would be worse than the missing story. This is the collapse the band actually
// meets: the same four facts in a container too narrow for two tracks. `auto-fit` at a 200px floor
// stacks them; a fixed column count, or a floor low enough to keep fitting tracks in, puts four
// cramped cells side by side and reddens here.
export const NarrowEnoughToStack: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const cells = canvas.getAllByRole('term').map((term) => term.parentElement!)
    for (const [index, cell] of cells.entries()) {
      if (index === 0) continue
      await expect(cell.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        cells[index - 1]!.getBoundingClientRect().bottom,
      )
    }
  },
}

// `5 dias` is the only value in the band that is a `t()` key; `4`, `2026` and `1` are numerals and
// read the same in both languages, so they are literals rather than identity entries in pt.json.
// This story is what holds that line in both directions: hard-code `5 dias` in the component and
// the value list below reddens, route `2026` through a key that pt.json is missing and it reddens
// too.
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'pieces in the catalogue',
      'first letter sent',
      'average production time',
      'person doing everything',
    ])
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      '4',
      '2026',
      '5 days',
      '1',
    ])
  },
}
