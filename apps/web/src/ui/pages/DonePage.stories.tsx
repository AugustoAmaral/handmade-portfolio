import { SHIPPING_METHODS, formatOrderNumber, formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { publicPaidOrder, publicPendingOrder } from '../../fixtures/orders'
import { DonePage } from './DonePage'
import { inShopShell } from './ShopShell.stories'

/** The `<dd>` beside a totals `<dt>`, the same reader every totals story on this branch uses. */
function valueOf(canvas: { getByText(text: string): HTMLElement }, label: string): HTMLElement {
  const term = canvas.getByText(label)
  const value = term.nextElementSibling
  if (!value) throw new Error(`the row "${label}" has no value cell after its label`)
  return value as HTMLElement
}

const meta = {
  component: DonePage,
  title: 'Pages/DonePage',
  decorators: [inShopShell],
  args: { order: publicPaidOrder, lang: 'pt', gaveUp: false },
} satisfies Meta<typeof DonePage>
export default meta
type Story = StoryObj<typeof meta>

// The webhook has landed. This is the only one of the three states the prototype has.
export const Paid: Story = {
  play: async ({ canvas }) => {
    // The headline is the page's `<h1>` and not a `<div>` that merely looks like one — this page
    // has no other heading, so without it the document has none at all.
    const heading = canvas.getByRole('heading', { level: 1 })
    await expect(canvas.getAllByRole('heading')).toHaveLength(1)
    await expect(heading.textContent).toBe('Pedido feito.Agora é minha vez.')
    // The second line is italic and it is the half that changes between the three states, so it is
    // pinned separately: a page that put both lines in the `<em>` passes the assertion above.
    await expect(heading.querySelector('em')?.textContent).toBe('Agora é minha vez.')

    await expect(canvas.getByText(`Pedido ${formatOrderNumber(publicPaidOrder.orderNumber)}`)).toBeInTheDocument()

    // Three rows, each read against a different fact, because they arrive as three fields of one
    // object and the only mistake available is printing one in another's row.
    await expect(valueOf(canvas, 'Total pago').textContent).toBe(formatPrice(publicPaidOrder.totalCents, 'pt'))
    await expect(valueOf(canvas, 'Envio').textContent).toBe(SHIPPING_METHODS.sedex.name.pt)
    await expect(valueOf(canvas, 'Prazo estimado').textContent).toBe(publicPaidOrder.eta!.pt)

    await expect(canvas.getByRole('link', { name: 'Voltar ao catálogo' })).toHaveAttribute('href', '/')
  },
}

// The state most buyers actually see first, and the one the design does not have: Stripe redirects
// the moment the card clears, and the webhook that flips the order to `paid` arrives separately.
export const Pending: Story = {
  args: { order: publicPendingOrder },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 })
    await expect(heading.querySelector('em')?.textContent).toBe('Confirmando o pagamento.')
    canvas.getByText('O Stripe está me avisando do pagamento. Isso leva alguns segundos — esta página se atualiza sozinha.')

    // `Total pago` is the one label on the page that would claim the very thing it is waiting for.
    await expect(valueOf(canvas, 'Total').textContent).toBe(formatPrice(publicPendingOrder.totalCents, 'pt'))
    await expect(canvas.queryByText('Total pago')).toBeNull()

    // Everything else is the same page in the same place. Moving the order number or the table
    // between states would make a normal wait look like something went wrong.
    await expect(canvas.getByText(`Pedido ${formatOrderNumber(publicPendingOrder.orderNumber)}`)).toBeInTheDocument()
    await expect(valueOf(canvas, 'Envio').textContent).toBe(SHIPPING_METHODS.pac.name.pt)
  },
}

// Thirty seconds later, per spec:202. The container has stopped polling, so "this page refreshes
// itself" has become a promise it no longer keeps.
export const StillConfirming: Story = {
  args: { order: publicPendingOrder, gaveUp: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).querySelector('em')?.textContent).toBe(
      'Ainda confirmando.',
    )
    canvas.getByText(
      'A confirmação do pagamento ainda não chegou até mim. Se o Stripe te mandou o recibo, está tudo certo: eu recebo a confirmação e te aviso por e-mail.',
    )
    // Still not paid, so still not "Total pago" — `gaveUp` changes what the page SAYS, not what it
    // knows.
    await expect(canvas.queryByText('Total pago')).toBeNull()
    await expect(valueOf(canvas, 'Total').textContent).toBe(formatPrice(publicPendingOrder.totalCents, 'pt'))
  },
}

// The lookup has not produced an order: a wrong session id in a shared link is enough. The order
// itself exists — it is created before the Stripe redirect — so the headline still holds; what is
// missing is everything this browser would have read off it.
export const OrderNotLoaded: Story = {
  args: { order: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).querySelector('em')?.textContent).toBe(
      'Confirmando o pagamento.',
    )
    // No number, no table — rather than a row of dashes about an order nothing has read.
    await expect(canvas.queryByText(/^Pedido #/)).toBeNull()
    await expect(canvas.queryByText('Total')).toBeNull()
    // The way out survives every state: it is the only control on the page.
    await expect(canvas.getByRole('link', { name: 'Voltar ao catálogo' })).toHaveAttribute('href', '/')
  },
}

// A digital order has no method and no ETA — `PublicOrder` types both nullable and `computeTotals`
// charges nothing for it — so the table shrinks to the one row it can fill instead of printing two
// dashes. Built by spreading the fixture, which `freeze.ts` documents as the supported way to vary
// one.
export const DigitalOrder: Story = {
  args: { order: { ...publicPaidOrder, shippingMethod: null, eta: null } },
  play: async ({ canvas }) => {
    await expect(valueOf(canvas, 'Total pago').textContent).toBe(formatPrice(publicPaidOrder.totalCents, 'pt'))
    await expect(canvas.queryByText('Envio')).toBeNull()
    await expect(canvas.queryByText('Prazo estimado')).toBeNull()
    // One row, counted rather than inferred from the two absences above: a table that rendered a
    // fourth row nobody asked for would pass both of them.
    await expect(canvas.getAllByRole('definition')).toHaveLength(1)
  },
}

// FOUND BY MUTATION, and the story exists because of it: every order fixture carries the ETA of
// its own shipping method verbatim, so `order.eta[lang]` and `SHIPPING_METHODS[m].eta[lang]` print
// the same characters and `Paid` cannot tell them apart. It matters which one is on screen —
// `PublicOrder.eta` is the snapshot taken when the order was placed, and the shipping table is
// edited afterwards, so a page that looked the method up would quietly rewrite the promise made to
// a buyer whose parcel is already late.
export const EtaIsTheOrdersOwnSnapshot: Story = {
  args: { order: { ...publicPaidOrder, eta: { pt: 'até 20 de outubro', en: 'by 20 October' } } },
  play: async ({ canvas }) => {
    await expect(valueOf(canvas, 'Prazo estimado').textContent).toBe('até 20 de outubro')
    await expect(canvas.queryByText(SHIPPING_METHODS.sedex.eta.pt)).toBeNull()
    // The method's NAME is still the method's, which is the half that is a lookup.
    await expect(valueOf(canvas, 'Envio').textContent).toBe(SHIPPING_METHODS.sedex.name.pt)
  },
}

export const InEnglish: Story = {
  args: { lang: 'en' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Order placed.Now it is my turn.')
    await expect(valueOf(canvas, 'Total paid').textContent).toBe(formatPrice(publicPaidOrder.totalCents, 'en'))
    // The order's own data follows `lang`, the chrome follows the copy instance: two props, and a
    // page that passed one and not the other reads as English over a Portuguese ETA.
    await expect(valueOf(canvas, 'Estimated time').textContent).toBe(publicPaidOrder.eta!.en)
  },
}
