import type { CheckoutRequest } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { brCheckout, buyerCheckoutErrors, emptyCheckout } from '../../fixtures/checkout'
import { type BuyerValues, CheckoutBuyerSection } from './CheckoutBuyerSection'

/**
 * The form's own shape from a request fixture. `phone` is optional in the schema and required in
 * the form (a controlled input cannot hold `undefined` without React re-classing it as
 * uncontrolled halfway through), and that gap is exactly the kind of thing that gets papered over
 * with a cast at a call site. Exported because the page story in Task 10 needs the same
 * derivation and a second copy of it is a second place for it to be done differently.
 */
export function buyerValuesOf(buyer: CheckoutRequest['buyer']): BuyerValues {
  return { name: buyer.name, email: buyer.email, phone: buyer.phone ?? '' }
}

const meta = {
  component: CheckoutBuyerSection,
  title: 'Shop/CheckoutBuyerSection',
  // Every named export of a stories file is indexed as a story unless it is listed here.
  excludeStories: ['buyerValuesOf'],
  args: { values: buyerValuesOf(emptyCheckout.buyer), errors: {}, onChange: fn() },
  // Local state, not `useArgs`: the vitest browser project has no manager to service the
  // args-update message, so a controlled input stays frozen at its initial value and every
  // typing assertion below would pass without testing anything. Documented in TextInput.stories.
  //
  // The annotation is explicit because the base tsconfig sets `declaration: true` and tsc has to
  // be able to name this parameter's type.
  render: function Render(args: ComponentProps<typeof CheckoutBuyerSection>) {
    const [values, setValues] = useState(args.values)
    return (
      <div className="w-[520px]">
        <CheckoutBuyerSection
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
} satisfies Meta<typeof CheckoutBuyerSection>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ args, canvas }) => {
    const name = canvas.getByLabelText('Nome completo')
    await userEvent.type(name, 'Marina Bicalho')

    // The FIELD KEY, not just "it fired". Three fields report through one callback and the only
    // mistake on offer is wiring one field's key onto another's input, which reads as a working
    // form until the container writes the name into the e-mail.
    await expect(args.onChange).toHaveBeenLastCalledWith('name', 'Marina Bicalho')
    await expect(name).toHaveValue('Marina Bicalho')
  },
}

export const Filled: Story = {
  args: { values: buyerValuesOf(brCheckout.buyer) },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByLabelText('Nome completo')).toHaveValue(args.values.name)
    await expect(canvas.getByLabelText('E-mail')).toHaveValue(args.values.email)
    await expect(canvas.getByLabelText('Telefone / WhatsApp')).toHaveValue(args.values.phone)
  },
}

// The reflow the deleted CPF field left behind. Four fields wrapped 2x2; three wrap 2+1 and leave
// the phone alone in a half-width row at exactly the widths the checkout's own two-column page
// produces. Geometry, not class names: `col-span-full` that fails to compile leaves the name the
// same width as the e-mail and no other assertion in this file would notice.
export const FullNameSpansTheRow: Story = {
  args: { values: buyerValuesOf(brCheckout.buyer) },
  play: async ({ canvas }) => {
    const box = (label: string) => canvas.getByLabelText(label).parentElement!.getBoundingClientRect()
    const name = box('Nome completo')
    const email = box('E-mail')
    const phone = box('Telefone / WhatsApp')

    await expect(name.width).toBeGreaterThan(email.width)
    await expect(name.bottom).toBeLessThanOrEqual(email.top)
    // The other half of the same decision: e-mail and phone share a row, so the row the name took
    // was not bought by pushing them onto three separate lines.
    await expect(email.top).toBe(phone.top)
  },
}

// zod's messages arrive as raw English prose because the API copies `issue.message` through
// untouched, and the translation table's default branch renders them rather than dropping them.
// Asserting the exact fixture string is what proves the fallback is a passthrough and not a
// silently-swallowed error: with the default returning '' the field would still be outlined in
// accent and say nothing.
export const WithErrors: Story = {
  args: { values: buyerValuesOf(emptyCheckout.buyer), errors: buyerCheckoutErrors },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Nome completo')).toHaveAccessibleErrorMessage(
      buyerCheckoutErrors['buyer.name']![0]!,
    )
    await expect(canvas.getByLabelText('E-mail')).toHaveAccessibleErrorMessage(buyerCheckoutErrors['buyer.email']![0]!)
    // The rules never reject a phone, so this field must stay clean while the two beside it do
    // not — an error looked up by the wrong key would light up all three.
    await expect(canvas.getByLabelText('Telefone / WhatsApp')).not.toHaveAccessibleErrorMessage()
  },
}

// With `fallbackLng: false` and the key as the English sentence, a key that drifted from its
// pt.json entry renders as perfectly formed English on the Portuguese page and nothing complains.
// This is the story that sees it.
export const InEnglish: Story = {
  args: { values: buyerValuesOf(brCheckout.buyer) },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe('01 · Who is buying')
    await expect(canvas.getByLabelText('Full name')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Phone / WhatsApp')).toBeInTheDocument()
    await expect(canvas.queryByLabelText('Nome completo')).toBeNull()
  },
}
