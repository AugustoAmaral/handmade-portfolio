import { type FieldErrors, SHIPPING_METHODS, checkoutRules, formatPrice, shippingOptionsFor } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { intlCheckout } from '../../fixtures/checkout'
import { CheckoutShippingSection } from './CheckoutShippingSection'

// `not_available` is in no fixture, so it is derived from the function that emits it: a US address
// with a domestic method is a real request the API really rejects with exactly this code.
const mismatched = checkoutRules({ shippingAddress: intlCheckout.shippingAddress, shippingMethod: 'pac' }, true)
if (!mismatched) throw new Error('a domestic method on an international address must violate the rules')
const NOT_AVAILABLE: FieldErrors = mismatched

// WCAG relative luminance, inline for the same reason TextInput.stories carries its own copy: the
// assertion has to be about a NUMBER. "the radio has an accent colour" passes for any colour, and
// axe evaluates no rule against a form control's indicator.
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

/**
 * The row a radio sits in: `<label><input><span>name</span><span>eta</span><span>price</span></label>`.
 * Read structurally rather than with `getByText`, because `formatPrice` separates "R$" from the
 * digits with a NO-BREAK SPACE and testing-library's normaliser collapses it to an ordinary one —
 * so the query never matches the string `formatPrice` returns. Measured, not guessed: the first
 * version of this file used `getByText` and went red on exactly that.
 */
function cellsOf(radio: HTMLElement): { eta: string; price: string } {
  const row = radio.parentElement
  if (!row || row.children.length !== 4) throw new Error('a shipping option row is not input + name + eta + price')
  return { eta: row.children[2]!.textContent ?? '', price: row.children[3]!.textContent ?? '' }
}

const meta = {
  component: CheckoutShippingSection,
  title: 'Shop/CheckoutShippingSection',
  args: { options: shippingOptionsFor('BR'), selected: 'pac', lang: 'pt', errors: {}, onSelect: fn() },
  render: (args) => (
    <div className="w-[520px]">
      <CheckoutShippingSection {...args} />
    </div>
  ),
} satisfies Meta<typeof CheckoutShippingSection>
export default meta
type Story = StoryObj<typeof meta>

export const Brazil: Story = {
  play: async ({ args, canvas }) => {
    const radios = canvas.getAllByRole('radio')
    await expect(radios).toHaveLength(2)
    await expect(radios[0]).toBeChecked()
    await expect(radios[1]).not.toBeChecked()

    // The ID, not just "it fired": two options report through one callback and reporting the
    // wrong one is a checkout that charges SEDEX for PAC.
    await userEvent.click(canvas.getByRole('radio', { name: /Correios SEDEX/ }))
    await expect(args.onSelect).toHaveBeenCalledWith('sedex')

    // Each row against its OWN option. The price is the number the buyer is agreeing to and
    // `option.cents` is the only place it can come from; a row that printed the other option's
    // price, or the other option's ETA, still renders two entirely plausible rows.
    await expect(cellsOf(canvas.getByRole('radio', { name: /Correios PAC/ }))).toEqual({
      eta: SHIPPING_METHODS.pac.eta.pt,
      price: formatPrice(SHIPPING_METHODS.pac.cents, 'pt'),
    })
    await expect(cellsOf(canvas.getByRole('radio', { name: /Correios SEDEX/ }))).toEqual({
      eta: SHIPPING_METHODS.sedex.eta.pt,
      price: formatPrice(SHIPPING_METHODS.sedex.cents, 'pt'),
    })
  },
}

// The mechanism the prototype's <div onClick> does not have. Arrow keys inside a radio group are
// the browser's, and they only exist because these are real radios sharing a `name`.
export const ArrowKeysMoveBetweenOptions: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.tab()
    await expect(canvas.getAllByRole('radio')[0]).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    await expect(args.onSelect).toHaveBeenCalledWith('sedex')
  },
}

// Two measured numbers, because both are invisible to axe: the checked indicator is a non-text
// element (WCAG 1.4.11, 3:1) and focus appearance has no axe rule at all. The ring is asserted on
// the ROW rather than the control — a 2px outline around an 11px circle satisfies the letter of
// 2.4.11 and nobody sees it — so this fails if `has-[:focus-visible]` stops compiling, which is
// exactly the kind of Tailwind variant that fails silently.
export const SelectionAndFocusAreVisible: Story = {
  play: async ({ canvas }) => {
    const radio = canvas.getAllByRole('radio')[0]!
    const row = radio.parentElement!
    const surface = getComputedStyle(row).backgroundColor

    await expect(contrast(getComputedStyle(radio).accentColor, surface)).toBeGreaterThanOrEqual(3)

    await expect(getComputedStyle(row).outlineStyle).toBe('none')
    await userEvent.tab()
    await expect(radio).toHaveFocus()

    const focused = getComputedStyle(row)
    await expect(focused.outlineStyle).not.toBe('none')
    await expect(parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2)
    await expect(contrast(focused.outlineColor, surface)).toBeGreaterThanOrEqual(3)
  },
}

export const International: Story = {
  args: { options: shippingOptionsFor('US'), selected: 'intl' },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('radio')).toHaveLength(1)
    // The legend is the group's accessible name and it is the only thing on screen that says why
    // there is one option here and two in the story above it.
    await expect(canvas.getByRole('group')).toHaveAccessibleName('Enviar para: fora do Brasil')
  },
}

export const NoneSelected: Story = {
  args: { selected: null, errors: { shippingMethod: ['required'] } },
  play: async ({ canvas }) => {
    for (const radio of canvas.getAllByRole('radio')) await expect(radio).not.toBeChecked()
    // Announced, not just painted: `aria-describedby` on the fieldset is what attaches the
    // sentence to the group, and `role="alert"` is what gets it read out when it appears.
    await expect(canvas.getByRole('group')).toHaveAccessibleDescription('Campo obrigatório.')
    await expect(canvas.getByRole('alert').textContent).toBe('Campo obrigatório.')
  },
}

export const MethodDoesNotMatchTheAddress: Story = {
  args: { options: shippingOptionsFor('US'), selected: null, errors: NOT_AVAILABLE },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Esta opção de envio não vale para este endereço.')
  },
}

// A country I do not ship to has no options at all, which the plan's story list does not cover and
// `shippingOptionsFor` reaches with one line. Rendering the fieldset anyway leaves an empty
// hairline box — a 1px ink rectangle with nothing in it — above a form that cannot be completed.
export const NoOptionsForThisCountry: Story = {
  args: { options: shippingOptionsFor('ZW'), selected: null },
  play: async ({ canvas }) => {
    await expect(canvas.queryAllByRole('radio')).toHaveLength(0)
    await expect(canvas.queryByRole('group')).toBeNull()
    await expect(canvas.getByText('Nenhuma opção de envio para este endereço.')).toBeInTheDocument()
  },
}

// `lang` is a prop because `i18n.resolvedLanguage` is `undefined` in English. The ETA is the one
// field that differs between the two languages for a domestic method — both names are literally
// `Correios PAC` — so it is the only string here that can catch a hard-coded `.pt`.
export const InEnglish: Story = {
  args: { lang: 'en' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(cellsOf(canvas.getByRole('radio', { name: /Correios PAC/ }))).toEqual({
      eta: SHIPPING_METHODS.pac.eta.en,
      price: formatPrice(SHIPPING_METHODS.pac.cents, 'en'),
    })
    await expect(canvas.getByRole('group')).toHaveAccessibleName('Ship to: Brazil')
  },
}
