import { type FieldErrors, type ShippingAddress, checkoutRules } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { brCheckout, brCheckoutErrors, incompleteBrCheckout, intlCheckout } from '../../fixtures/checkout'
import { type AddressValues, CheckoutAddressSection } from './CheckoutAddressSection'

/**
 * The form's shape from a request fixture. Four of the eight fields are optional in the schema and
 * all eight are required by a controlled input, so the empty string is the form's way of spelling
 * "absent" — which is also why `checkoutRules` tests `!address.number` rather than `=== undefined`.
 * Exported for the page story in Task 10.
 */
export function addressValuesOf(address: ShippingAddress | undefined): AddressValues {
  return {
    country: address?.country ?? '',
    postalCode: address?.postalCode ?? '',
    street: address?.street ?? '',
    number: address?.number ?? '',
    complement: address?.complement ?? '',
    district: address?.district ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
  }
}

// France, spread off the international fixture rather than written from nothing: `intlCheckout` is
// validated against the real schema by `fixtures.test.ts` and this keeps the same field set.
const FRANCE = { ...addressValuesOf(intlCheckout.shippingAddress), country: 'FR', postalCode: '75001', city: 'Paris', state: '' }

// `not_allowed` appears in no fixture, so it is DERIVED from the same function that emits it in
// production rather than typed in as a string this file believes the rules produce.
const zimbabwe = checkoutRules({ shippingAddress: { ...brCheckout.shippingAddress!, country: 'ZW' }, shippingMethod: 'intl' }, true)
if (!zimbabwe) throw new Error('a country I do not ship to must violate the rules')
const NOT_ALLOWED: FieldErrors = zimbabwe

const meta = {
  component: CheckoutAddressSection,
  title: 'Shop/CheckoutAddressSection',
  excludeStories: ['addressValuesOf'],
  args: { values: addressValuesOf(brCheckout.shippingAddress), errors: {}, onChange: fn() },
  // See CheckoutBuyerSection.stories for why this is local state and not `useArgs`.
  render: function Render(args: ComponentProps<typeof CheckoutAddressSection>) {
    const [values, setValues] = useState(args.values)
    return (
      <div className="w-[520px]">
        <CheckoutAddressSection
          {...args}
          values={values}
          onChange={(field, value) => {
            setValues((current) => ({ ...current, [field]: value }))
            args.onChange(field, value)
          }}
        />
      </div>
    )
  },
} satisfies Meta<typeof CheckoutAddressSection>
export default meta
type Story = StoryObj<typeof meta>

export const Brazil: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByLabelText('CEP')).toHaveValue(args.values.postalCode)
    await expect(canvas.getByLabelText('Bairro')).toHaveValue(args.values.district)
    await expect(canvas.getByLabelText('Número')).toHaveValue(args.values.number)
    await expect(canvas.getByLabelText('Estado')).toHaveValue(args.values.state)
  },
}

export const BrazilEmpty: Story = {
  args: { values: { ...addressValuesOf(undefined), country: 'BR' } },
  play: async ({ args, canvas }) => {
    const cep = canvas.getByLabelText('CEP')
    await userEvent.type(cep, '30150-904')
    await expect(args.onChange).toHaveBeenLastCalledWith('postalCode', '30150-904')
    await expect(cep).toHaveValue('30150-904')
  },
}

// The plan's story. The three BR-only fields are asserted absent as well as the label swap,
// because a component that renamed CEP to "Código postal" and kept Bairro and Número on screen
// would satisfy the two assertions the plan wrote and still collect a Brazilian address for
// France. The BR story above is the other half: hide the fields unconditionally and it reddens.
export const CountryDrivesTheFields: Story = {
  args: { values: FRANCE },
  play: async ({ canvas }) => {
    await expect(canvas.queryByLabelText(/cep/i)).not.toBeInTheDocument()
    await expect(canvas.getByLabelText(/código postal|postal code/i)).toBeInTheDocument()
    await expect(canvas.queryByLabelText('Bairro')).toBeNull()
    await expect(canvas.queryByLabelText('Número')).toBeNull()
    await expect(canvas.queryByLabelText('Complemento')).toBeNull()
    await expect(canvas.getByLabelText('Estado / província')).toBeInTheDocument()
  },
}

// `checkoutRules` runs on the PARSED request, where zod has already trimmed and upper-cased the
// country, so it branches on `BR` while the form still holds whatever was typed. A component that
// compares the raw value shows France's form to someone who typed `br` and then hands them an
// `invalid_cep` from an API that disagreed about which country this is.
export const LowercaseCountryIsStillBrazil: Story = {
  args: { values: { ...addressValuesOf(brCheckout.shippingAddress), country: ' br ' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('CEP')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Bairro')).toBeInTheDocument()
  },
}

// The codes half of the table, against the errors the REAL rules produce for the incomplete
// Brazilian address they are derived from. Each message is a different branch of the switch, so a
// table that fell through to the raw code would print "invalid_cep" here in four different places.
export const WithErrors: Story = {
  args: { values: addressValuesOf(incompleteBrCheckout.shippingAddress), errors: brCheckoutErrors },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('CEP')).toHaveAccessibleErrorMessage('Informe um CEP válido, como 30150-904.')
    await expect(canvas.getByLabelText('Número')).toHaveAccessibleErrorMessage('Campo obrigatório.')
    await expect(canvas.getByLabelText('Bairro')).toHaveAccessibleErrorMessage('Campo obrigatório.')
    await expect(canvas.getByLabelText('Estado')).toHaveAccessibleErrorMessage('Use a sigla do estado, como MG.')
    // `shippingMethod` is in the same fixture and belongs to another section: an errorFor() that
    // ignored its argument would light this field up too.
    await expect(canvas.getByLabelText('Cidade')).not.toHaveAccessibleErrorMessage()
  },
}

export const CountryIsNotServed: Story = {
  args: { values: { ...addressValuesOf(brCheckout.shippingAddress), country: 'ZW' }, errors: NOT_ALLOWED },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('País')).toHaveAccessibleErrorMessage('Ainda não envio para este país.')
  },
}

// The one error key with no field to hang on: `checkoutRules` emits a bare `shippingAddress` when
// there is no address at all. The form always sends one, so this only ever arrives from a request
// the page did not build — and an error with nowhere to go is an error that gets dropped.
export const AddressIsMissingEntirely: Story = {
  args: { values: addressValuesOf(undefined), errors: { shippingAddress: ['required'] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Campo obrigatório.')
  },
}

export const InEnglish: Story = {
  args: { values: FRANCE },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe('02 · Shipping address')
    await expect(canvas.getByLabelText('Postal code')).toBeInTheDocument()
    await expect(canvas.getByLabelText('State / province')).toBeInTheDocument()
    await expect(canvas.queryByLabelText('Código postal')).toBeNull()
  },
}

/**
 * SC 1.3.5, and the section where getting it wrong costs the most: a token that names the wrong
 * thing does not fail silently, it makes a password manager fill the WRONG BOX — a shipping form
 * that autofills the city into the street line is worse than one that autofills nothing.
 *
 * TWO FIELDS DELIBERATELY CARRY NO TOKEN, and their absence is asserted so a later drive-by cannot
 * fill the gap with a guess. The HTML autofill list models a street address as `address-line1..3`
 * plus administrative levels, and this form decomposes a Brazilian address FINER than that:
 *
 *   - `Número` has no purpose in the list at all. There is no house-number token; in the model the
 *     number is part of line 1, which the `Rua / logradouro` box already claims. The nearest
 *     unused token is `address-line2`, and taking it would put the complement's content in the
 *     number box.
 *   - `Bairro` is the tempting one, and the candidates are `address-level3` ("the third
 *     administrative level") and `address-line3`. A bairro is not an administrative level of
 *     anything — Brazil's are the state and the municipality, which are already level 1 and level
 *     2 — and this form has no third address LINE either, since the complement is line 2. Both
 *     would be a token chosen by elimination, which is the definition of a guess.
 *
 * `country` and not `country-name`: the box holds a code (`BR`, `FR`), `checkoutRules` compares it
 * upper-cased against `BR`, and `shippingOptionsFor` looks it up in `INTL_ALLOWED_COUNTRIES` — so
 * a browser filling in `Brasil` here would be filling in something the API rejects.
 *
 * The INTERNATIONAL shape needs no story of its own: it is this form minus number, complement and
 * district, so every field it has is one of the six asserted below.
 */
export const AutofillTokens: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('País')).toHaveAttribute('autocomplete', 'country')
    await expect(canvas.getByLabelText('CEP')).toHaveAttribute('autocomplete', 'postal-code')
    await expect(canvas.getByLabelText('Rua / logradouro')).toHaveAttribute('autocomplete', 'address-line1')
    await expect(canvas.getByLabelText('Complemento')).toHaveAttribute('autocomplete', 'address-line2')
    await expect(canvas.getByLabelText('Cidade')).toHaveAttribute('autocomplete', 'address-level2')
    await expect(canvas.getByLabelText('Estado')).toHaveAttribute('autocomplete', 'address-level1')

    await expect(canvas.getByLabelText('Número')).not.toHaveAttribute('autocomplete')
    await expect(canvas.getByLabelText('Bairro')).not.toHaveAttribute('autocomplete')
  },
}
