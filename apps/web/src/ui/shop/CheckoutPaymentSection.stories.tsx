import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { CheckoutPaymentSection } from './CheckoutPaymentSection'

// The prototype's second sentence, character for character. The first one is rewritten (spec
// decision 2: cards only), and keeping them as two keys is what lets this one be asserted as
// unchanged instead of buried inside a paragraph that was edited as a whole.
const VERBATIM = 'Nada de dado de cartão passa por aqui — você volta para cá com o pedido confirmado.'
const REWRITTEN = 'Cartão de crédito na página segura do Stripe.'

const meta = { component: CheckoutPaymentSection, title: 'Shop/CheckoutPaymentSection' } satisfies Meta<
  typeof CheckoutPaymentSection
>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText(VERBATIM, { exact: false }).textContent).toBe(`${REWRITTEN} ${VERBATIM}`)

    // The whole rendered text, not one node: the point of the rewrite is that these words are
    // nowhere on the last screen before payment, and an assertion scoped to one paragraph would
    // pass with `Pix` sitting in the heading beside it.
    await expect(canvasElement.textContent).not.toMatch(/pix|boleto/i)
  },
}

// The prototype draws this row exactly like a selected shipping option, dot and all. Building it
// out of the same radio gives the form a control that can hold one value, cannot be changed, and
// cannot be left empty — a field that is really a sentence. The dot is decoration and says so.
export const IsNotAChoice: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryAllByRole('radio')).toHaveLength(0)
    await expect(canvas.queryAllByRole('checkbox')).toHaveLength(0)
    await expect(canvasElement.querySelector('input')).toBeNull()
  },
}

export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe('05 · Payment')
    await expect(canvas.getByText(/No card data passes through here/).textContent).toBe(
      'Credit card on the secure Stripe page. No card data passes through here — you come back with the order confirmed.',
    )
  },
}
