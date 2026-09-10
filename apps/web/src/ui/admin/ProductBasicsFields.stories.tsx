import { type FieldErrors, fieldErrorsFromIssues, productInputSchema } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { digitalLetter, drawing, letter, soldOutDrawing } from '../../fixtures/products'
import { measure, opacityOf } from '../../../.storybook/contrast'
import {
  EMPTY_BASICS,
  MIN_PRICE_CENTS,
  ProductBasicsFields,
  type ProductBasicsValues,
  basicsFromProduct,
  centsFromReais,
  countFromDigits,
  reaisFromCents,
  stockFrom,
} from './ProductBasicsFields'
import { type ProductLocalizedValues, localizedFromProduct } from './ProductLocalizedFields'

// The arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch that has
// to assert a ratio for itself.

/**
 * The payload these two components produce between them, assembled here rather than in `src`
 * because the container (Task 8) owns the whole request — specs and photos included — and half of
 * it is not a thing to ship. It is enough to run `productInputSchema` over, which is the only
 * check that matters: the schema is the contract, and every trap in it is a field on this form.
 */
function inputFrom(basics: ProductBasicsValues, localized: ProductLocalizedValues) {
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
 * Errors from a REAL rejected parse, not hand-written codes. Three fields fail for three different
 * reasons — a slug with capitals and a space, fifty centavos against a floor of a hundred, and an
 * empty stock box — and the decoder that keys them is the one the checkout and the API already
 * share. Written by hand, this object would agree with itself and with nothing else.
 */
const rejected = productInputSchema.safeParse(
  inputFrom({ ...basicsFromProduct(letter), slug: 'Carta Escrita', price: '0,50', stock: '', unlimitedStock: false }, localizedFromProduct(letter)),
)
const parseErrors: FieldErrors = rejected.success ? {} : fieldErrorsFromIssues(rejected.error.issues)

const meta = {
  component: ProductBasicsFields,
  title: 'Admin/ProductBasicsFields',
  args: {
    values: basicsFromProduct(letter),
    lang: 'pt',
    errors: {},
    onChange: fn(),
  },
  /**
   * The fields are controlled and hold nothing, so a story that types into one needs somewhere for
   * the characters to go. Driven by local state and not by `useArgs`: the browser project has no
   * manager to answer an args update, so a typed character would never come back.
   */
  render: function Render(args: ComponentProps<typeof ProductBasicsFields>) {
    const [values, setValues] = useState(args.values)
    return (
      <ProductBasicsFields
        {...args}
        values={values}
        onChange={(next) => {
          setValues(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof ProductBasicsFields>
export default meta
type Story = StoryObj<typeof meta>

/**
 * `letter`: a physical piece with no stock limit, R$ 45,00.
 *
 * THE PRICE IS SEEDED FROM CENTS AND IT IS THE SEEDING THAT IS ASSERTED — 4500 has to arrive in
 * the box as `45,00` and not as `4500`, `45` or `R$ 45,00`, because whatever it says is what the
 * person edits and what comes back out.
 *
 * The stock box is TICKED and the count is empty, which is the whole reason the box exists: the
 * fixture's `stock` is `null`, and a number input has no way to say that.
 */
export const Editing: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Identificador')).toHaveValue('carta-escrita')
    await expect(canvas.getByRole('textbox', { name: /Preço/ })).toHaveValue('45,00')

    const unlimited = canvas.getByRole('checkbox')
    await expect(unlimited).toBeChecked()
    await expect(unlimited).toHaveAccessibleName('Sob encomenda')
    await expect(canvas.getByLabelText('Estoque')).toBeDisabled()

    await expect(canvas.getByLabelText('Tipo')).toHaveValue('physical')
    await expect(canvas.getByLabelText('Situação')).toHaveValue('active')
  },
}

/**
 * THE SAME `stock: null`, THE OTHER SENTENCE, and it is the products table's rule rather than a
 * second one: no limit on a physical piece is made to order, and on a digital one it is simply
 * unlimited. A constant word here would have the panel offer to make a PDF to order.
 */
export const UnlimitedDigital: Story = {
  args: { values: basicsFromProduct(digitalLetter) },
  play: async ({ canvas }) => {
    const unlimited = canvas.getByRole('checkbox')
    await expect(unlimited).toBeChecked()
    await expect(unlimited).toHaveAccessibleName('Sem limite')
    await expect(canvas.queryByText('Sob encomenda')).toBeNull()
    await expect(canvas.getByLabelText('Tipo')).toHaveValue('digital')
  },
}

/** A real count: the box is clear, the field is editable and it holds a number. */
export const CountedStock: Story = {
  args: { values: basicsFromProduct(drawing) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox')).not.toBeChecked()
    const stock = canvas.getByLabelText('Estoque')
    await expect(stock).toBeEnabled()
    await expect(stock).toHaveValue('4')
    await expect(canvas.getByRole('textbox', { name: /Preço/ })).toHaveValue('120,00')
  },
}

/**
 * ZERO IS NOT NULL, which is the distinction the whole stock control exists for. `soldOutDrawing`
 * has `stock: 0` — a piece that has sold — and it must round trip as a counted zero rather than as
 * an unlimited one; the two are the same shape in the schema and opposite facts in the shop.
 *
 * The last two lines are the pair: same values, two different answers out of `stockFrom`.
 */
export const SoldOutIsNotUnlimited: Story = {
  args: { values: basicsFromProduct(soldOutDrawing) },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('checkbox')).not.toBeChecked()
    await expect(canvas.getByLabelText('Estoque')).toHaveValue('0')
    await expect(stockFrom(args.values)).toBe(0)
    await expect(stockFrom({ ...args.values, unlimitedStock: true })).toBeNull()
  },
}

/**
 * A new draft: every box empty, and INACTIVE. A piece with no photos and no English copy has no
 * business appearing in the shop the moment it is saved, and one click publishes it on purpose.
 */
export const NewProduct: Story = {
  args: { values: EMPTY_BASICS },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Identificador')).toHaveValue('')
    await expect(canvas.getByLabelText('Identificador')).toHaveAttribute('placeholder', 'carta-escrita')
    await expect(canvas.getByRole('textbox', { name: /Preço/ })).toHaveValue('')
    await expect(canvas.getByRole('checkbox')).not.toBeChecked()
    await expect(canvas.getByLabelText('Situação')).toHaveValue('inactive')
  },
}

/**
 * THE CONVERSION, IN BOTH DIRECTIONS, ON THE VALUES THAT BREAK THE OBVIOUS IMPLEMENTATION.
 *
 * `19.99 * 100` is 1998.9999999999998 in IEEE 754. Truncating it loses a centavo on every price
 * ending in 99; leaving it alone is not an integer at all, and `z.number().int()` rejects the
 * whole request with a message about integers rather than about money. `Math.round` rescues those
 * two and is still not the rule — `8.165 * 100` is 816.4999999999999, which rounds to 816 where
 * the decimal answer is 817 — and it cannot read `19,99` in the first place, which is what the
 * person in front of a Portuguese keyboard types.
 *
 * Reading the digit groups and combining them as integers has no float in it anywhere. The table
 * is the assertion: every line fails on a float implementation, on a truncating one, or on one
 * that reads the comma as a group separator.
 *
 * The last block is the round trip, which is the property that actually matters — a price loaded
 * from the API, shown, and saved again without being edited must be the same number of cents.
 */
export const ConvertsReaisToCents: Story = {
  play: async () => {
    const amounts: [string, number][] = [
      ['45,00', 4500],
      ['19,99', 1999],
      ['19.99', 1999],
      ['0,07', 7],
      ['0.07', 7],
      ['1,10', 110],
      ['1,1', 110],
      ['19', 1900],
      ['19,', 1900],
      ['19.', 1900],
      ['  45,00  ', 4500],
      ['1200,00', 120000],
    ]
    for (const [text, cents] of amounts) {
      await expect(centsFromReais(text), `${text} is ${cents} cents`).toBe(cents)
      await expect(Number.isInteger(centsFromReais(text)), `${text} converts to an integer`).toBe(true)
    }

    // Refused rather than guessed at. `1.200,00` and `1.200` are what pt-BR prints for one
    // thousand two hundred and what en-US prints for one and a fifth, and a field that picks one
    // of those is off by a factor of a thousand. Three decimals cannot be cents at all.
    for (const text of ['', '   ', 'abc', '-5', '19,999', '8,165', '1.200,00', '1.200', 'R$ 45,00', '45,0,0']) {
      await expect(Number.isNaN(centsFromReais(text)), `${text || '(empty)'} is not an amount`).toBe(true)
    }

    const printed: [number, string][] = [
      [4500, '45,00'],
      [1999, '19,99'],
      [7, '0,07'],
      [110, '1,10'],
      [100, '1,00'],
      [120000, '1200,00'],
    ]
    for (const [cents, text] of printed) {
      await expect(reaisFromCents(cents), `${cents} prints as ${text}`).toBe(text)
      await expect(centsFromReais(reaisFromCents(cents)), `${cents} survives the round trip`).toBe(cents)
    }
  },
}

/**
 * The same arithmetic through the schema, which is where a float would actually be caught: an
 * unrounded `19.99 * 100` is not an integer and `productInputSchema` says so, at the price field.
 *
 * And the answer for a box that cannot be read: `NaN`, not zero. `Number('')` is 0, 0 is SOLD OUT,
 * and a blank stock field that quietly published a piece as unavailable would be indistinguishable
 * from a piece that had sold. The schema keys the complaint at `stock`, where it belongs.
 */
export const SatisfiesTheSchema: Story = {
  play: async ({ args }) => {
    const localized = localizedFromProduct(letter)
    const valid = productInputSchema.safeParse(inputFrom({ ...args.values, price: '19,99' }, localized))
    await expect(valid.success).toBe(true)
    if (valid.success) {
      await expect(valid.data.priceCents).toBe(1999)
      await expect(valid.data.stock).toBeNull()
    }

    // `stock` is `nullable()` and NOT `optional()`, which is why the form always sends it: leaving
    // the key out is `stock: Required` rather than an unchanged stock level. This is the assertion
    // that would notice the day the schema stops agreeing.
    const { stock: _omitted, ...withoutStock } = inputFrom(args.values, localized)
    await expect(productInputSchema.safeParse(withoutStock).success).toBe(false)

    const floated = productInputSchema.safeParse({ ...inputFrom(args.values, localized), priceCents: 19.99 * 100 })
    await expect(floated.success).toBe(false)

    await expect(Number.isNaN(countFromDigits(''))).toBe(true)
    const blankStock = productInputSchema.safeParse(
      inputFrom({ ...args.values, unlimitedStock: false, stock: '' }, localized),
    )
    await expect(blankStock.success).toBe(false)
    if (!blankStock.success) {
      await expect(fieldErrorsFromIssues(blankStock.error.issues)['stock']).toBeDefined()
    }
  },
}

/**
 * THE FLOOR IS IN THE LABEL, and it is the schema's own floor rather than a number typed twice:
 * the hint is `formatPrice(MIN_PRICE_CENTS, lang)`, so it reads R$ 1,00 and not 100, and the two
 * parses below are what make the constant a CHECKED copy — move the minimum in `@shop/shared` and
 * this story goes red instead of the panel quietly promising the wrong minimum.
 */
export const ShowsThePriceFloor: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText('mínimo R$ 1,00')).toBeInTheDocument()

    const localized = localizedFromProduct(letter)
    const atTheFloor = { ...inputFrom(args.values, localized), priceCents: MIN_PRICE_CENTS }
    await expect(productInputSchema.safeParse(atTheFloor).success).toBe(true)
    await expect(productInputSchema.safeParse({ ...atTheFloor, priceCents: MIN_PRICE_CENTS - 1 }).success).toBe(false)
  },
}

/**
 * A COMMA SURVIVES BEING TYPED, which is the reason the price field holds text instead of the
 * design's `type="number"`. A number input parses with the BROWSER's locale: on an English-locale
 * Chromium the comma never lands, the box ends up holding `1999`, and R$ 19,99 is saved as
 * R$ 1.999,00. The middle assertion is the one that catches a value round-tripped through a
 * number — `19,` cannot survive it, so the `9`s that follow attach to the wrong side.
 */
export const KeepsAPartlyTypedAmount: Story = {
  play: async ({ args, canvas }) => {
    const price = canvas.getByRole('textbox', { name: /Preço/ })
    await userEvent.clear(price)
    await userEvent.type(price, '19,')
    await expect(price).toHaveValue('19,')

    await userEvent.type(price, '99')
    await expect(price).toHaveValue('19,99')
    await expect(centsFromReais((price as HTMLInputElement).value)).toBe(1999)
    await expect(args.onChange).toHaveBeenLastCalledWith({ ...basicsFromProduct(letter), price: '19,99' })
  },
}

/**
 * The box is a control and not a display: ticking it hands the container `unlimitedStock` and
 * KEEPS the count that was typed, so unticking gives it back rather than starting from an empty
 * field. The disabled state is the visible half of the same fact.
 */
export const TogglesTheStockLimit: Story = {
  args: { values: basicsFromProduct(drawing) },
  play: async ({ args, canvas }) => {
    const unlimited = canvas.getByRole('checkbox')
    await userEvent.click(unlimited)

    await expect(args.onChange).toHaveBeenLastCalledWith({ ...basicsFromProduct(drawing), unlimitedStock: true })
    await expect(unlimited).toBeChecked()
    await expect(canvas.getByLabelText('Estoque')).toBeDisabled()
    await expect(canvas.getByLabelText('Estoque')).toHaveValue('4')

    await userEvent.click(unlimited)
    await expect(args.onChange).toHaveBeenLastCalledWith(basicsFromProduct(drawing))
    await expect(canvas.getByLabelText('Estoque')).toBeEnabled()
  },
}

/**
 * The errors are a real rejected parse decoded by `fieldErrorsFromIssues`, and they land on three
 * different fields through the same table the checkout uses. The key list is asserted first
 * because a payload that accidentally parsed would leave the object empty and every line below it
 * would be asserting nothing.
 *
 * The messages are raw English out of zod, and that is the branch's known upstream gap rather than
 * a defect here: `errorHandler` copies `issue.message` through, `useErrorMessage` renders anything
 * it does not recognise instead of dropping it, and the wrong-language sentence is what keeps the
 * bug visible. The fix is codes on the API side.
 */
export const ShowsFieldErrors: Story = {
  args: {
    values: { ...basicsFromProduct(letter), slug: 'Carta Escrita', price: '0,50', stock: '', unlimitedStock: false },
    errors: parseErrors,
  },
  play: async ({ canvas }) => {
    await expect(Object.keys(parseErrors)).toEqual(['slug', 'priceCents', 'stock'])

    const slug = canvas.getByLabelText('Identificador')
    await expect(slug).toHaveAttribute('aria-invalid', 'true')
    await expect(slug).toHaveAccessibleDescription('Invalid')

    const price = canvas.getByRole('textbox', { name: /Preço/ })
    await expect(price).toHaveAttribute('aria-invalid', 'true')
    await expect(price).toHaveAccessibleDescription('Number must be greater than or equal to 100')

    const stock = canvas.getByLabelText('Estoque')
    await expect(stock).toHaveAttribute('aria-invalid', 'true')
    await expect(stock).toHaveAccessibleDescription('Expected number, received nan')

    await expect(canvas.getByLabelText('Tipo')).not.toHaveAttribute('aria-invalid')
  },
}

/**
 * The panel has no language toggle of its own and renders in whatever language the shop was left
 * in, so every key here has to resolve in English too. Keys ARE the English sentence and
 * `fallbackLng` is false, so one that drifted from its `pt.json` entry paints flawless English on
 * the Portuguese screen with nothing red anywhere — this is the story that would catch it.
 */
export const InEnglish: Story = {
  args: { values: basicsFromProduct(digitalLetter), lang: 'en' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Identifier')).toBeInTheDocument()
    await expect(canvas.getByRole('checkbox')).toHaveAccessibleName('Unlimited')
    await expect(canvas.getByRole('option', { name: 'Physical' })).toBeInTheDocument()
    await expect(canvas.getByRole('option', { name: 'Active' })).toBeInTheDocument()
    // The floor follows the language through `formatPrice`, which is why it is not a copy string.
    await expect(canvas.getByText('minimum R$1.00')).toBeInTheDocument()
  },
}

/**
 * THE LABELS ARE `FieldLabel` UNMODIFIED — `opacity-75`, 7.39:1 on paper — which is what the design
 * draws and what the primitive already is. The branch's "below opacity-65 fails AA" rule is about
 * the muted meta lines and does not reach these; raising them would flatten a hierarchy the design
 * states in exactly this value. Two-sided on purpose: the ratio proves legibility, the opacity
 * equality proves nobody lifted it "to be safe".
 *
 * THE TWO RELATIONAL LINES ARE THE ONES THAT HOLD THE ARITHMETIC. Every ratio here is a `>=`, so a
 * measurement bug that errs HIGH passes all of them — deleting the alpha compositing from `over()`
 * left the whole 202-story suite green, because an uncomposited muted colour reads as more legible
 * rather than less. The label must measure strictly less than the full-strength text in the box
 * beside it, and the hint (85% inside the label's 75%) strictly less than the label.
 *
 * THE CHECKBOX AND ITS RING ARE GUARDED HERE OR NOWHERE: axe ships no rule for non-text contrast
 * at all. The ring is the radio's — 2px accent pulled inside the row, because a 2px outline around
 * an 11px control is an indicator nobody sees — and it is measured against what it is painted on.
 */
export const MeasuresItsLabels: Story = {
  play: async ({ canvas }) => {
    const label = canvas.getByText('Identificador')
    await expect(opacityOf(label)).toBeCloseTo(0.75, 5)
    await expect(measure(label, 'color')).toBeGreaterThanOrEqual(4.5)

    const hint = canvas.getByText('mínimo R$ 1,00')
    await expect(opacityOf(hint)).toBeCloseTo(0.6375, 5)
    await expect(measure(hint, 'color')).toBeGreaterThanOrEqual(4.5)

    const slug = canvas.getByLabelText('Identificador')
    await expect(measure(label, 'color')).toBeLessThan(measure(slug, 'color'))
    await expect(measure(hint, 'color')).toBeLessThan(measure(label, 'color'))

    const unlimited = canvas.getByRole('checkbox')
    await expect(opacityOf(unlimited)).toBe(1)
    await expect(measure(unlimited, 'accentColor')).toBeGreaterThanOrEqual(3)

    const row = unlimited.parentElement!
    await expect(getComputedStyle(row).outlineStyle).toBe('none')

    // Tabbed and not focused programmatically: the ring hangs on `:focus-visible`, which a
    // scripted focus() is not guaranteed to match.
    for (let i = 0; i < 10 && document.activeElement !== unlimited; i += 1) await userEvent.tab()
    await expect(unlimited).toHaveFocus()

    const focused = getComputedStyle(row)
    await expect(focused.outlineStyle).not.toBe('none')
    await expect(parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2)
    // Negative offset, so the ring is painted ON the row and the row is what it is measured
    // against — the distinction the shared helper's `surfaceOf` exists for.
    await expect(parseFloat(focused.outlineOffset)).toBeLessThan(0)
    await expect(measure(row, 'outlineColor', row)).toBeGreaterThanOrEqual(3)
  },
}
