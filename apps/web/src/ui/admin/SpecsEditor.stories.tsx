import { type FieldErrors, fieldErrorsFromIssues, productInputSchema } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { letter, productWithMaxSpecs } from '../../fixtures/products'
import { measure, opacityOf } from '../../../.storybook/contrast'
import { basicsFromProduct, centsFromReais, stockFrom } from './ProductBasicsFields'
import { localizedFromProduct } from './ProductLocalizedFields'
import {
  EMPTY_SPEC,
  MAX_SPECS,
  type SpecDraft,
  SpecsEditor,
  isBlankSpec,
  specsFromProduct,
  specsForSubmit,
  submitIndexes,
} from './SpecsEditor'

// The contrast arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch
// that has to assert a ratio for itself.

/** The whole payload, so the only spec these stories check against is the schema itself. */
function inputFrom(specs: SpecDraft[]) {
  const basics = basicsFromProduct(letter)
  return {
    slug: basics.slug,
    priceCents: centsFromReais(basics.price),
    stock: stockFrom(basics),
    type: basics.type,
    active: basics.active,
    ...localizedFromProduct(letter),
    specs: specsForSubmit(specs),
  }
}

/**
 * A REAL rejected parse of a half-filled row. `specSchema` is `{ key, value }` of
 * `localizedTextSchema`, which is `.min(1)` on both halves — four required non-empty strings per
 * row — so a row with a Portuguese key and nothing else fails three times over. The blank row in
 * front of it is dropped before the parse, which is what MOVES these paths from `specs.2.…` to
 * `specs.1.…` and is the reason the component maps display rows onto submit indexes at all.
 */
const halfFilled: SpecDraft[] = [
  { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } },
  { ...EMPTY_SPEC },
  { key: { pt: 'Papel', en: '' }, value: { pt: '', en: '' } },
]
const rejected = productInputSchema.safeParse(inputFrom(halfFilled))
const parseErrors: FieldErrors = rejected.success ? {} : fieldErrorsFromIssues(rejected.error.issues)

const meta = {
  component: SpecsEditor,
  title: 'Admin/SpecsEditor',
  args: {
    values: specsFromProduct(letter),
    errors: {},
    onChange: fn(),
  },
  render: function Render(args: ComponentProps<typeof SpecsEditor>) {
    const [values, setValues] = useState(args.values)
    return (
      <SpecsEditor
        {...args}
        values={values}
        onChange={(next) => {
          setValues(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof SpecsEditor>
export default meta
type Story = StoryObj<typeof meta>

/** The design's shape: a ruled header with its own add action, two language columns, three rows. */
export const Editing: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Dados · chave e valor' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('group')).toHaveLength(3)
    await expect(canvas.getByLabelText('Chave, Linha 1')).toHaveValue('Formato')
    await expect(canvas.getByLabelText('Valor, Linha 1')).toHaveValue('A5, 2 folhas')
    await expect(canvas.getByLabelText('Key, Linha 1')).toHaveValue('Format')
    await expect(canvas.getByLabelText('Value, Linha 1')).toHaveValue('A5, 2 sheets')
    await expect(canvas.getByLabelText('Chave, Linha 3')).toHaveValue('Prazo')
    await expect(canvas.getByLabelText('Value, Linha 3')).toHaveValue('5 business days')

    // The draft is a COPY. The fixtures are deep-frozen, so an aliased pair turns the first
    // keystroke into a TypeError — and nothing else in these stories would notice, because every
    // edit below builds a new object anyway.
    const draft = specsFromProduct(letter)
    await expect(draft[0]!.key).not.toBe(letter.specs[0]!.key)
    await expect(Object.isFrozen(draft[0]!.value)).toBe(false)
  },
}

/**
 * THE DENSEST ACCESSIBILITY GAP IN THE ADMIN, CLOSED. The prototype gives these four boxes a
 * placeholder and nothing else — an axe `label` violation four times per row, sixteen on a
 * four-spec product — and its two column headings are `<span>`s with no programmatic relationship
 * to anything.
 *
 * Task 3 could solve the same problem with zero copy keys, by composing a control's visible word
 * with its row header through `aria-labelledby`. A spec row HAS NO HEADER: it is identified only
 * by a key box whose value may be empty, and on a new row all four boxes are empty. So the row
 * name has to be invented, and the only honest one is its position — which is what the person
 * sees, and what the photo cards next to it already use (`Foto 2`).
 *
 * TWELVE BOXES, TWELVE NAMES, and that is what this story is: `getByLabelText` throws on a
 * duplicate, so twelve successful lookups ARE the assertion that no two controls share a name.
 * The four field words are keyed with the language suffix Task 4 settled (`Key (PT)` → `Chave`,
 * `Key (EN)` → `Key`), because `Chave` and `Key` are two different boxes and not translations of
 * each other.
 */
export const NamesEveryBoxAfterItsRow: Story = {
  play: async ({ canvas }) => {
    const names = ['Chave', 'Valor', 'Key', 'Value']
    for (let row = 1; row <= 3; row += 1) {
      for (const name of names) await expect(canvas.getByLabelText(`${name}, Linha ${row}`)).toBeInTheDocument()
      await expect(canvas.getByRole('group', { name: `Linha ${row}` })).toBeInTheDocument()
      await expect(canvas.getByRole('button', { name: `Apagar, Linha ${row}` })).toBeInTheDocument()
    }
    await expect(canvas.getAllByRole('textbox')).toHaveLength(12)

    // The placeholders stay the design's, and they are the sighted reader's only per-box label —
    // so they carry the same four words the accessible names are built from.
    await expect(canvas.getByLabelText('Chave, Linha 1')).toHaveAttribute('placeholder', 'Chave')
    await expect(canvas.getByLabelText('Value, Linha 1')).toHaveAttribute('placeholder', 'Value')
  },
}

/** Twelve boxes, one keystroke: the other eleven halves come back untouched. */
export const EditsOneCornerOfOneRow: Story = {
  play: async ({ args, canvas }) => {
    const box = canvas.getByLabelText('Value, Linha 2')
    await userEvent.clear(box)
    await userEvent.type(box, '180gsm')

    const expected = specsFromProduct(letter)
    expected[1] = { key: { ...expected[1]!.key }, value: { pt: expected[1]!.value.pt, en: '180gsm' } }
    await expect(args.onChange).toHaveBeenLastCalledWith(expected)
    await expect(canvas.getByLabelText('Chave, Linha 2')).toHaveValue('Papel')
    await expect(canvas.getByLabelText('Valor, Linha 2')).toHaveValue('Algodão 180g')
  },
}

/**
 * THE PLAN'S CLAIM, MEASURED RATHER THAN TRUSTED. It says rows need synthetic identity because
 * "the array index is not stable across a delete, and using it is the classic bug where deleting
 * row 2 clears row 3's text". That is the UNCONTROLLED-input version of the bug. These boxes are
 * controlled from props, so React reusing a DOM node under an index key still paints the right
 * value — the first three lines below are that measurement, and they pass with a bare index key.
 *
 * WHAT ACTUALLY BREAKS IS THE CONTROL UNDER YOUR FINGER. Deleting row 2 means clicking row 2's
 * ✕, so that button is focused when the list shrinks; under a bare index key React keeps the node
 * and re-points it at what used to be row 3. The button stays focused, its name silently becomes
 * `Apagar, Linha 2` again, and the next Space — the key that scrolls a page — deletes another row.
 *
 * THE FIX IS NOT IDENTITY, WHICH THIS LAYER CANNOT MINT ANYWAY. Minting ids is state, so it would
 * have to arrive in the prop type and be maintained by Task 8's container, for every row, forever.
 * Qualifying the key with the row COUNT costs nothing and is enough: any deletion re-keys the
 * whole list, so no control can survive one and inherit another row's job. Typing does not change
 * the count, so a caret is never disturbed mid-word.
 *
 * The last two lines are what fail if the count comes back out of the key: both ✕ nodes captured
 * before the delete must be gone afterwards, and focus must be on nothing rather than on a live
 * control that now means something else.
 */
export const DeletingAMiddleRowMovesNoText: Story = {
  play: async ({ canvas }) => {
    const deleteSecond = canvas.getByRole('button', { name: 'Apagar, Linha 2' })
    const deleteThird = canvas.getByRole('button', { name: 'Apagar, Linha 3' })
    await userEvent.click(deleteSecond)

    await expect(canvas.getAllByRole('group')).toHaveLength(2)
    await expect(canvas.getByLabelText('Chave, Linha 1')).toHaveValue('Formato')
    await expect(canvas.getByLabelText('Chave, Linha 2')).toHaveValue('Prazo')
    await expect(canvas.getByLabelText('Value, Linha 2')).toHaveValue('5 business days')

    await expect(deleteSecond.isConnected).toBe(false)
    await expect(deleteThird.isConnected).toBe(false)
    await expect(document.activeElement).toBe(document.body)
  },
}

/**
 * THE EMPTY ROW IS THE DECISION THIS COMPONENT TURNS ON. `+ Adicionar linha` appends four empty
 * strings, and all four are `.min(1)` in `specSchema` — so under the design's own behaviour a
 * brand-new product, which the prototype seeds with exactly one blank row, is unsaveable the
 * moment it is opened, with four validation errors about a row nobody typed in.
 *
 * SO A WHOLLY BLANK ROW IS DROPPED BEFORE SUBMIT, and the row says so where it happens. Adding a
 * row is a gesture for starting to type, not an assertion that a spec exists; refusing to save a
 * product because of a row somebody changed their mind about punishes the affordance.
 *
 * A HALF-FILLED ROW IS A DIFFERENT FACT and is kept, so the schema rejects it — see the story
 * below. Somebody typed something there, and silently discarding typed content is worse than an
 * error that names the two boxes still empty.
 */
export const AddsABlankRowAndSaysItWillNotBeSaved: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Adicionar linha' }))
    await expect(args.onChange).toHaveBeenLastCalledWith([...specsFromProduct(letter), EMPTY_SPEC])

    const row = canvas.getByRole('group', { name: 'Linha 4' })
    await expect(canvas.getByLabelText('Chave, Linha 4')).toHaveValue('')
    await expect(row).toHaveAccessibleDescription('Linhas em branco não são salvas.')
    // Only the blank one says it: the three filled rows carry no such description.
    await expect(canvas.getByRole('group', { name: 'Linha 1' })).not.toHaveAccessibleDescription()

    await userEvent.type(canvas.getByLabelText('Chave, Linha 4'), 'Peso')
    await expect(canvas.getByRole('group', { name: 'Linha 4' })).not.toHaveAccessibleDescription()
  },
}

/**
 * The two halves of the decision, run through the real schema. A product whose only extra row is
 * blank parses; the same product with a half-filled row does not, and the errors name the three
 * boxes that are empty — `key.en`, `value.pt` and `value.en` — rather than the row as a whole.
 */
export const DropsBlankRowsAndKeepsHalfFilledOnes: Story = {
  play: async () => {
    const filled = specsFromProduct(letter)
    await expect(productInputSchema.safeParse(inputFrom([...filled, EMPTY_SPEC])).success).toBe(true)
    await expect(specsForSubmit([...filled, EMPTY_SPEC])).toEqual(filled)

    await expect(isBlankSpec(EMPTY_SPEC)).toBe(true)
    await expect(isBlankSpec({ key: { pt: 'Peso', en: '' }, value: { pt: '', en: '' } })).toBe(false)
    // Whitespace is not content: a row holding a stray space would otherwise be kept and rejected.
    await expect(isBlankSpec({ key: { pt: '  ', en: '' }, value: { pt: '', en: '' } })).toBe(true)

    await expect(rejected.success).toBe(false)
    await expect(Object.keys(parseErrors)).toEqual(['specs.1.key.en', 'specs.1.value.pt', 'specs.1.value.en'])
  },
}

/**
 * WHERE THE DROPPED ROW BITES. The errors above are keyed `specs.1.…` because the blank row in
 * front of the half-filled one is not sent — but on screen the half-filled row is the THIRD. A
 * component that read `specs.2.…` for its third row would paint those three errors on nothing at
 * all, and a component that read them for the blank row would paint them on the wrong row.
 *
 * `submitIndexes` is the map, and it is the only reason this works. The last line is the one that
 * fails if it is ever dropped for a plain index.
 */
export const KeepsErrorsOnTheRowTheyBelongTo: Story = {
  args: { values: halfFilled, errors: parseErrors },
  play: async ({ canvas }) => {
    await expect(submitIndexes(halfFilled)).toEqual([0, null, 1])

    await expect(canvas.getByLabelText('Key, Linha 3')).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByLabelText('Valor, Linha 3')).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByLabelText('Value, Linha 3')).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByLabelText('Key, Linha 3')).toHaveAccessibleDescription(
      'String must contain at least 1 character(s)',
    )
    // The Portuguese key is the one thing that WAS typed, and the blank row above owns nothing.
    await expect(canvas.getByLabelText('Chave, Linha 3')).not.toHaveAttribute('aria-invalid')
    for (const name of ['Chave', 'Valor', 'Key', 'Value']) {
      await expect(canvas.getByLabelText(`${name}, Linha 2`)).not.toHaveAttribute('aria-invalid')
    }
  },
}

/**
 * `specs` is `.max(12)` in the schema, and the branch's precedent for a cap is that the control
 * disables — `CartLine` does exactly this at `CART_MAX_QTY`, with the reason in a visible sentence
 * beside it, because a disabled button cannot be focused and therefore cannot carry an
 * `aria-describedby` either. Letting the add button fire and letting the schema refuse the whole
 * product would report a twelve-row cap as a save that failed.
 *
 * `MAX_SPECS` IS A SECOND COPY OF THE SCHEMA'S 12 AND IS CHECKED, the way `MIN_PRICE_CENTS` is:
 * the two parses below run the boundary through `productInputSchema` itself, so moving the cap
 * upstream reddens this story instead of leaving the sentence quietly lying about the limit.
 */
export const StopsAtTwelveRows: Story = {
  args: { values: specsFromProduct(productWithMaxSpecs) },
  play: async ({ args, canvas }) => {
    const filled = specsFromProduct(productWithMaxSpecs)
    await expect(filled).toHaveLength(MAX_SPECS)
    await expect(productInputSchema.safeParse(inputFrom(filled)).success).toBe(true)
    await expect(productInputSchema.safeParse(inputFrom([...filled, filled[0]!])).success).toBe(false)

    const add = canvas.getByRole('button', { name: 'Adicionar linha' })
    await expect(add).toBeDisabled()
    await expect(canvas.getByText('Máximo de 12 linhas.')).toBeInTheDocument()
    await userEvent.click(add)
    await expect(args.onChange).not.toHaveBeenCalled()

    await userEvent.click(canvas.getByRole('button', { name: 'Apagar, Linha 12' }))
    await expect(canvas.getByRole('button', { name: 'Adicionar linha' })).toBeEnabled()
    await expect(canvas.queryByText('Máximo de 12 linhas.')).toBeNull()
  },
}

/**
 * No rows: the two column headings go with them. They describe columns that do not exist, and the
 * design leaves them standing over nothing. There is no empty-state sentence because the way back
 * is `+ Adicionar linha`, which this component owns and which is on screen — the products table
 * writes one only because the button that fixes its empty state belongs to another component.
 */
export const NoRowsYet: Story = {
  args: { values: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryAllByRole('group')).toHaveLength(0)
    await expect(canvas.queryByText('Português')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Adicionar linha' })).toBeEnabled()
  },
}

/** In English the keys render themselves, and the suffix is what keeps `Chave` and `Key` apart. */
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Data · key and value' })).toBeInTheDocument()
    await expect(canvas.getByLabelText('Key (PT), Row 1')).toHaveValue('Formato')
    await expect(canvas.getByLabelText('Key (EN), Row 1')).toHaveValue('Format')
    await expect(canvas.getByLabelText('Value (PT), Row 1')).toHaveValue('A5, 2 folhas')
    await expect(canvas.getByRole('button', { name: 'Delete, Row 1' })).toBeInTheDocument()
  },
}

/**
 * TWO SITES THE EXTRACT MEASURED AS FAILING, AND ONE THE GATE CANNOT SEE.
 *
 * The column headings are drawn at `opacity:.6`, which is 4.47:1 on paper — AA by 0.03 — and the
 * branch's floor is `opacity-65`. axe would have caught those; it cannot catch the ✕, because
 * `color-contrast` SKIPS single-character text as a suspected icon ligature, so a one-glyph button
 * passes at any contrast at all. It is measured here or nowhere.
 *
 * THE RELATIONAL LINE IS WHAT HOLDS THE ARITHMETIC. Every ratio here is a `>=`, so a measurement
 * bug that errs HIGH passes all of them — deleting the alpha compositing from `over()` once left
 * the whole suite green, because an uncomposited muted colour reads as MORE legible. A heading
 * that measures the same as the full-strength box beside it is not being measured at all.
 *
 * THE 24px IS SC 2.5.8, WHICH NOTHING IN THIS REPO TESTS EITHER. The design's ✕ is a 20px span;
 * WCAG 2.2 asks 24×24 of a target with no spacing exception, and this is a control that deletes
 * four fields. The header's spacer column follows it so the column still lines up.
 */
export const MeasuresItsColumnHeadsAndItsDeleteButton: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByText('Português')
    await expect(opacityOf(heading)).toBeCloseTo(0.65, 5)
    await expect(measure(heading, 'color')).toBeGreaterThanOrEqual(4.5)

    const box = canvas.getByLabelText('Chave, Linha 1')
    await expect(measure(heading, 'color')).toBeLessThan(measure(box, 'color'))

    const remove = canvas.getByRole('button', { name: 'Apagar, Linha 1' })
    await expect(opacityOf(remove)).toBe(1)
    await expect(measure(remove, 'color')).toBeGreaterThanOrEqual(4.5)

    const { width, height } = remove.getBoundingClientRect()
    await expect(width).toBeGreaterThanOrEqual(24)
    await expect(height).toBeGreaterThanOrEqual(24)
  },
}
