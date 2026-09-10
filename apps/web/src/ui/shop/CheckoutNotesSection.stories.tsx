import { type FieldErrors, checkoutRequestSchema } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { brCheckout } from '../../fixtures/checkout'
import { CheckoutNotesSection, type NotesValues } from './CheckoutNotesSection'

const EMPTY: NotesValues = { notes: '', giftMessage: '', referral: '' }
const FILLED: NotesValues = { notes: brCheckout.notes ?? '', giftMessage: 'Feliz aniversário, Ana.', referral: 'Instagram' }

const PLACEHOLDER = 'Notas para mim: o assunto da carta, o nome de quem vai receber, prazos, qualquer coisa.'

// Every field in this section is optional, so the only error it can ever show is a zod length
// ceiling — derived here by running the real schema over a request that busts two of them, the
// same way `fixtures/checkout.ts` derives the buyer errors, rather than typed in as prose this
// file believes zod produces.
const overLong = checkoutRequestSchema.safeParse({ ...brCheckout, notes: 'x'.repeat(1001), referral: 'y'.repeat(101) })
if (overLong.success) throw new Error('a 1001-character note must fail the schema')
const LENGTH_ERRORS: FieldErrors = {}
for (const issue of overLong.error.issues) {
  ;(LENGTH_ERRORS[issue.path.join('.')] ??= []).push(issue.message)
}

const meta = {
  component: CheckoutNotesSection,
  title: 'Shop/CheckoutNotesSection',
  args: { values: EMPTY, errors: {}, onChange: fn() },
  // See CheckoutBuyerSection.stories for why this is local state and not `useArgs`.
  render: function Render(args: ComponentProps<typeof CheckoutNotesSection>) {
    const [values, setValues] = useState(args.values)
    return (
      <div className="w-[520px]">
        <CheckoutNotesSection
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
} satisfies Meta<typeof CheckoutNotesSection>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ args, canvas }) => {
    const notes = canvas.getByLabelText('Notas para mim')
    // The long sentence stays a HINT and the short one is the name. A placeholder used as a label
    // is gone the moment there is a character in the box, which is the pattern this rebuild
    // exists to replace — so both have to be on screen at once.
    await expect(notes).toHaveAttribute('placeholder', PLACEHOLDER)

    await userEvent.type(notes, 'Capricha')
    await expect(args.onChange).toHaveBeenLastCalledWith('notes', 'Capricha')
  },
}

export const Filled: Story = {
  args: { values: FILLED },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Notas para mim')).toHaveValue(FILLED.notes)
    await expect(canvas.getByLabelText('É presente? Mensagem no cartão')).toHaveValue(FILLED.giftMessage)
    await expect(canvas.getByLabelText('Como me encontrou? (opcional)')).toHaveValue(FILLED.referral)
  },
}

export const WithErrors: Story = {
  args: { values: { ...FILLED, notes: 'x'.repeat(1001), referral: 'y'.repeat(101) }, errors: LENGTH_ERRORS },
  play: async ({ canvas }) => {
    // The raw zod prose, through the table's fallback — and asserted from the derived fixture, so
    // it tracks whatever zod actually says rather than what this file remembers it saying.
    await expect(canvas.getByLabelText('Notas para mim')).toHaveAccessibleErrorMessage(LENGTH_ERRORS['notes']![0]!)
    await expect(canvas.getByLabelText('Como me encontrou? (opcional)')).toHaveAccessibleErrorMessage(
      LENGTH_ERRORS['referral']![0]!,
    )
    await expect(canvas.getByLabelText('É presente? Mensagem no cartão')).not.toHaveAccessibleErrorMessage()
  },
}

export const InEnglish: Story = {
  args: { values: FILLED },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe('04 · About the order')
    await expect(canvas.getByLabelText('Is it a gift? Message on the card')).toBeInTheDocument()
    await expect(canvas.getByLabelText('How did you find me? (optional)')).toBeInTheDocument()
    await expect(canvas.queryByLabelText('Notas para mim')).toBeNull()
  },
}

/**
 * NOTHING HERE IS INFORMATION ABOUT THE BUYER, so nothing here gets an autofill token, and that
 * absence is a decision rather than an oversight — which is why it is pinned. SC 1.3.5 covers
 * fields that collect data ABOUT THE PERSON filling the form in; a note about the letter, a
 * message to print on a gift card and how somebody heard of the shop are none of them, and no
 * token in the HTML list names any of the three.
 *
 * The one that would tempt a sweep is `Como me encontrou?`, which sits beside `E-mail` and `Nome`
 * in the same visual language two sections up.
 */
export const NoPurposeToDeclare: Story = {
  args: { values: FILLED },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Notas para mim')).not.toHaveAttribute('autocomplete')
    await expect(canvas.getByLabelText('É presente? Mensagem no cartão')).not.toHaveAttribute('autocomplete')
    await expect(canvas.getByLabelText('Como me encontrou? (opcional)')).not.toHaveAttribute('autocomplete')
  },
}
