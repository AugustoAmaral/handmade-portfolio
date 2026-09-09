import { SHIPPING_METHODS, computeTotals, formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { cartLines } from '../../fixtures/checkout'
import { drawing, letter } from '../../fixtures/products'
import { lineOf } from './CartLine.stories'
import { OrderSummaryPanel } from './OrderSummaryPanel'

// The same derivation the drawer's stories use: quantities read out of the totals fixture so the
// lines on screen and the money under them cannot disagree, and the money is the real
// `computeTotals` rather than arithmetic done in this file.
const LINES = [lineOf(letter, cartLines[0]!.qty), lineOf(drawing, cartLines[1]!.qty)]
const TOTALS = computeTotals(cartLines, 'pac')
const METHOD = SHIPPING_METHODS.pac.name.pt

/** The `<dd>` beside a totals `<dt>`. Structural, and loud when the structure moves. */
function valueOf(canvas: { getByText(text: string): HTMLElement }, label: string): HTMLElement {
  const term = canvas.getByText(label)
  const value = term.nextElementSibling
  if (!value) throw new Error(`the totals row "${label}" has no value cell after its label`)
  return value as HTMLElement
}

/** `<li><div><span>name</span><span>meta</span></div><span>total</span></li>` */
function metaOf(item: Element): string {
  const meta = item.firstElementChild?.lastElementChild
  if (!meta) throw new Error('the summary line rendered no meta row under the product name')
  return meta.textContent ?? ''
}

const meta = {
  component: OrderSummaryPanel,
  title: 'Shop/OrderSummaryPanel',
  args: {
    lines: LINES,
    itemsCents: TOTALS.itemsCents,
    shippingCents: TOTALS.shippingCents,
    totalCents: TOTALS.totalCents,
    shippingMethodName: METHOD,
    lang: 'pt',
    submitting: false,
    submitError: null,
    onSubmit: fn(),
  },
  render: (args) => (
    <div className="w-[380px]">
      <OrderSummaryPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof OrderSummaryPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvas }) => {
    // Each of the three totals against a DIFFERENT one of the three props: they arrive already
    // computed and the only mistake available is wiring one into another's row, which reads as
    // perfectly plausible money.
    await expect(valueOf(canvas, 'Subtotal').textContent).toBe(formatPrice(TOTALS.itemsCents, 'pt'))
    await expect(valueOf(canvas, `Frete (${METHOD})`).textContent).toBe(formatPrice(TOTALS.shippingCents, 'pt'))
    await expect(valueOf(canvas, 'Total').textContent).toBe(formatPrice(TOTALS.totalCents, 'pt'))

    // `unitCents` has had no reader since Task 5 put it on the view model for this line, and the
    // SECOND line is the one that can prove it has one now: `cartLines` buys the letter once and
    // the drawing twice, so on line 1 the unit price and the line total are the same number and an
    // implementation printing `lineCents` in the meta row is indistinguishable there. Found by
    // mutation — the first version of this story asserted line 1 and stayed green through it.
    const items = canvas.getAllByRole('listitem')
    await expect(metaOf(items[1]!)).toBe(`${LINES[1]!.qty} × ${formatPrice(drawing.priceCents, 'pt')}`)
    await expect(items[1]!.lastElementChild?.textContent).toBe(formatPrice(LINES[1]!.lineCents, 'pt'))
    await expect(metaOf(items[0]!)).toBe(`${LINES[0]!.qty} × ${formatPrice(letter.priceCents, 'pt')}`)

    const button = canvas.getByRole('button', { name: /pagar/i })
    await expect(button.textContent).toBe(`Pagar ${formatPrice(TOTALS.totalCents, 'pt')}`)
    await userEvent.click(button)
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

// No method chosen yet: the label loses its parenthesis and the value loses its number. The em
// dash is silence to a screen reader, so the row would announce "Frete" and stop — and unlike the
// drawer, this panel can name the control that fills the gap, because it is on this page.
export const ShippingNotChosen: Story = {
  args: { shippingCents: null, totalCents: TOTALS.itemsCents, shippingMethodName: null },
  play: async ({ canvas }) => {
    await expect(valueOf(canvas, 'Frete').textContent).toBe('—Escolha uma opção de envio')
    await expect(canvas.queryByText(`Frete (${METHOD})`)).toBeNull()
    // The other half of the same guard: an em dash rendered unconditionally passes here and only
    // `Default` catches it.
    await expect(valueOf(canvas, 'Total').textContent).toBe(formatPrice(TOTALS.itemsCents, 'pt'))
  },
}

// The plan's own version of this story cannot run: it calls `userEvent.click` on the disabled
// button, and `PillButton` paints `pointer-events-none` over a disabled control, so user-event
// THROWS ("Unable to perform pointer interaction") before reaching the assertion it was written
// for. A raw DOM click is what actually tests the guard — the browser refuses to dispatch it to a
// disabled control, and would dispatch it to an enabled one, so the assertion still reddens when
// `disabled` goes away.
export const SubmittingDisablesTheButton: Story = {
  args: { submitting: true },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: /pagar/i })
    await expect(button).toBeDisabled()
    button.click()
    // Double-submitting a checkout creates two pending orders and two Stripe sessions.
    await expect(args.onSubmit).not.toHaveBeenCalled()

    // The name does not change while it is busy — a disabled button may never be announced at all,
    // and a control that renames itself is one a voice-control user can no longer ask for. The
    // busy state is a live region beside it, which IS announced.
    await expect(button.textContent).toBe(`Pagar ${formatPrice(TOTALS.totalCents, 'pt')}`)
    await expect(canvas.getByRole('status').textContent).toBe('Redirecionando para o Stripe')
  },
}

// The API's own failures are codes, same as the cross-field rules, so they go through the same
// table. A container that translated them instead would be resolving copy outside `src/ui`, where
// `copy.test.ts` cannot see it and a missing entry ships as fluent English.
export const SubmitErrorTranslatesTheCode: Story = {
  args: { submitError: 'OUT_OF_STOCK' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe(
      'Não tenho estoque suficiente de uma das peças. Diminua a quantidade na sacola.',
    )
  },
}

// The fallback, from the other direction: anything the table does not know is rendered as it
// arrived. Swallowing it would leave the buyer staring at a button that did nothing.
export const UnknownSubmitErrorIsShownRaw: Story = {
  args: { submitError: 'Gateway timeout while reaching the acquirer' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Gateway timeout while reaching the acquirer')
  },
}

// The drawer's call, made again here: no totals, because "Total R$ 0,00" is arithmetic about
// nothing, and no button, because the thing it starts is an order with no items in it.
export const Empty: Story = {
  args: { lines: [], itemsCents: 0, shippingCents: null, totalCents: 0, shippingMethodName: null },
  play: async ({ canvas }) => {
    canvas.getByText('A sacola está vazia.')
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.queryByText('Total')).toBeNull()
  },
}

export const InEnglish: Story = {
  args: { lang: 'en', shippingMethodName: SHIPPING_METHODS.pac.name.en },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe('Your order')
    await expect(canvas.getByRole('button').textContent).toBe(`Pay ${formatPrice(TOTALS.totalCents, 'en')}`)
    await expect(valueOf(canvas, `Shipping (${SHIPPING_METHODS.pac.name.en})`).textContent).toBe(
      formatPrice(TOTALS.shippingCents, 'en'),
    )
  },
}
