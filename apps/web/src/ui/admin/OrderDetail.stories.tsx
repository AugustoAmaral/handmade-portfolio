import { ADMIN_ORDER_TRANSITIONS, ORDER_STATUSES, formatOrderNumber, formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { intlCheckout } from '../../fixtures/checkout'
import {
  digitalOrder,
  expiredOrder,
  orderWithoutStripeSession,
  oversoldOrder,
  paidOrder,
  pendingOrder,
  shippedOrder,
  shippedWithoutTracking,
} from '../../fixtures/orders'
import { OrderDetail, formatAddress } from './OrderDetail'
import { measure, opacityOf } from '../../../.storybook/contrast'

// The contrast arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch
// that has to assert a ratio for itself.

const meta = {
  component: OrderDetail,
  title: 'Admin/OrderDetail',
  args: {
    order: paidOrder,
    lang: 'pt',
    trackingCode: '',
    onStartDispatch: fn(),
    onChangeTrackingCode: fn(),
    onConfirmDispatch: fn(),
    onCancelDispatch: fn(),
  },
} satisfies Meta<typeof OrderDetail>
export default meta
type Story = StoryObj<typeof meta>

/**
 * THE WHOLE PANE FOR AN ORDER WAITING TO BE MADE. Every number is read back off the fixture rather
 * than typed as a literal, and that assertion means something now: the five order fixtures used to
 * share two totals between them, so "shows this order's total" passed on four other orders as well.
 * `fixtures.test.ts` holds the distinctness.
 *
 * THREE CONTACT ROWS, NOT FOUR. The prototype carries `["CPF", "042.118.***-**"]` on all four of
 * its orders and renders it third of four — but spec decision 3 removed CPF from the checkout, so
 * it is never collected and cannot be displayed. The design's own `hint-placeholder-count="3"` on
 * that repeat becomes accidentally correct.
 *
 * A `<dl>`, WHICH THE PROTOTYPE IS NOT. Four `<span>` pairs in a flex row announce as eight
 * unrelated strings; a term and its definition are a pair a reader can move through.
 */
export const PaidOrder: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: 'Marina Bicalho' })).toBeInTheDocument()
    // THE OUTLINE, AS ONE EQUALITY. The pane is a region named after the customer and every block
    // inside it is a region named after its own heading — which is what makes the sections read as
    // parts of THIS order rather than as peers of it. The gift block is absent from the list
    // because this order has no gift message, so the list is a statement about both.
    await expect(canvas.getAllByRole('region').map((region) => region.getAttribute('aria-labelledby'))).toEqual([
      'admin-order-name',
      'admin-order-delivery',
      'admin-order-items',
      'admin-order-notes',
    ])
    await expect(canvas.getByText(`${formatOrderNumber(paidOrder.orderNumber)} · 03 set 2026`)).toBeInTheDocument()
    await expect(canvas.getByText('Em produção')).toBeInTheDocument()

    // The order's total is a term/value pair too, so it is the fourth of each list. Asserting both
    // lists as equalities is what keeps a row from being added without anyone noticing.
    await expect(canvas.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'E-mail',
      'Telefone / WhatsApp',
      'Como me achou',
      'Total',
    ])
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      paidOrder.buyer.email,
      paidOrder.buyer.phone,
      paidOrder.referral,
      formatPrice(paidOrder.amounts.totalCents, 'pt'),
    ])

    await expect(canvas.getByRole('heading', { level: 3, name: 'Envio' })).toBeInTheDocument()
    await expect(
      canvas.getByText('Rua Sapucaí, 388, ap. 51 — Floresta, Belo Horizonte / MG, 30150-904, Brasil'),
    ).toBeInTheDocument()
    // Before dispatch the delivery line carries the method's own estimate. There is no delivery
    // DATE anywhere in the model — the prototype's `previsão 12 set` is a baked string — so the
    // range the shipping table already publishes is what can honestly be shown.
    await expect(canvas.getByText('Correios SEDEX · 3 a 5 dias úteis')).toBeInTheDocument()

    await expect(canvas.getAllByRole('listitem').map((line) => line.textContent)).toEqual([
      `Carta escrita à mão1 × ${formatPrice(4500, 'pt')}`,
      `Desenho a nanquim2 × ${formatPrice(12000, 'pt')}`,
    ])

    await expect(canvas.getByText(paidOrder.notes!)).toBeInTheDocument()
    await expect(canvas.queryByRole('heading', { name: 'Mensagem do presente' })).toBeNull()
  },
}

/**
 * THE AFFORDANCE IS DERIVED FROM `canTransition`, WHICH IS WHY IT CANNOT LIE. The prototype draws
 * `Marcar como despachado` identically on all four of its orders, two of which are already
 * `Despachado`; the API answers `409 INVALID_TRANSITION` for three of the five statuses, and a UI
 * that offers a transition the API refuses is a UI that lies.
 *
 * The table is asserted alongside the rendering rather than restated as a literal: if a sixth
 * status appears upstream, or `pending` ever gains a transition, this line is what says the
 * component's behaviour has to be looked at again.
 */
export const OffersDispatchOnlyWhereTheApiAllowsIt: Story = {
  play: async ({ canvas }) => {
    await expect(ORDER_STATUSES.filter((status) => ADMIN_ORDER_TRANSITIONS[status].includes('shipped'))).toEqual([
      'paid',
      'oversold',
    ])
    await expect(canvas.getByRole('button', { name: 'Marcar como despachado' })).toBeInTheDocument()
  },
}

/** The second of exactly two, and the only fixture with a gift message and no customer notes. */
export const OversoldOrder: Story = {
  args: { order: oversoldOrder },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Marcar como despachado' })).toBeInTheDocument()
    await expect(canvas.getByText('Estoque insuficiente')).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { level: 3, name: 'Mensagem do presente' })).toBeInTheDocument()
    await expect(canvas.getByText(oversoldOrder.giftMessage!)).toBeInTheDocument()
    // The customer's own notes are a separate fact and this order has none, so that block is gone
    // rather than empty — which is what makes the gift heading above a real assertion.
    await expect(canvas.queryByRole('heading', { name: 'Notas do cliente' })).toBeNull()
  },
}

/**
 * A dispatched order offers no second dispatch, and its delivery line swaps the estimate for the
 * code. The design has only the baked string `Correios SEDEX · rastreio BR8841200SC` and no way to
 * have produced it.
 */
export const ShippedOrder: Story = {
  args: { order: shippedOrder },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Marcar como despachado' })).toBeNull()
    await expect(canvas.getByText(`Correios SEDEX · rastreio ${shippedOrder.trackingCode}`)).toBeInTheDocument()
    await expect(canvas.queryByText(/3 a 5 dias/)).toBeNull()
  },
}

/**
 * DISPATCHED WITH NO CODE, which is the ORDINARY case rather than an edge one: `trackingCode` is
 * `.optional()` on the PATCH, so a parcel handed over in person ships with the field absent. The
 * line then says the method and stops — no estimate, because the order has already gone, and an
 * estimate on something dispatched two weeks ago is a sentence that is simply false.
 *
 * The code can never be added afterwards: `shipped → shipped` is not in `ADMIN_ORDER_TRANSITIONS`,
 * so the PATCH that would carry it is a 409. That is the API's shape, not this component's.
 */
export const ShippedWithoutTracking: Story = {
  args: { order: shippedWithoutTracking },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Correios PAC')).toBeInTheDocument()
    await expect(canvas.queryByText(/rastreio/)).toBeNull()
    await expect(canvas.queryByText(/8 a 12 dias/)).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Marcar como despachado' })).toBeNull()
  },
}

/**
 * NEITHER OF THE TWO REMAINING STATUSES CAN BE DISPATCHED, and `expiredOrder` is also the sparsest
 * contact list on the branch: a buyer with no phone and no referral leaves one row. The prototype
 * renders all four rows unconditionally, so an order like this one would print two empty values and
 * a CPF that was never collected.
 */
export const ExpiredOrder: Story = {
  args: { order: expiredOrder },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Marcar como despachado' })).toBeNull()
    await expect(canvas.getAllByRole('term').map((term) => term.textContent)).toEqual(['E-mail', 'Total'])
    await expect(canvas.getByText('Expirado')).toBeInTheDocument()
  },
}

/** `pending` is the third status the API refuses, and the one that looks most like it should work. */
export const PendingOrder: Story = {
  args: { order: pendingOrder },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Marcar como despachado' })).toBeNull()
    await expect(canvas.getByText('Aguardando pagamento')).toBeInTheDocument()
  },
}

/**
 * THE ORDER WITH NOWHERE TO SEND IT. `AdminOrder` types `shippingAddress` and `shippingMethod` as
 * NULLABLE and no other fixture is null on either: a cart with nothing physical in it omits both at
 * checkout and `computeTotals` charges no postage for it. The delivery block says what happens
 * instead, reusing the catalogue's own words for a digital piece rather than inventing a sentence.
 */
export const DigitalOrder: Story = {
  args: { order: digitalOrder },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 3, name: 'Envio' })).toBeInTheDocument()
    await expect(canvas.getByText('Entrega por e-mail')).toBeInTheDocument()
    await expect(canvas.queryByText(/Correios/)).toBeNull()
    await expect(canvas.queryByText(/Rua Sapucaí/)).toBeNull()
    await expect(canvas.getAllByRole('definition').at(-1)!.textContent).toBe(
      formatPrice(digitalOrder.amounts.totalCents, 'pt'),
    )
  },
}

/**
 * THE FIXTURE COMMENT ADDRESSED TO THIS PR, ANSWERED. `stripeSessionId` is optional on `AdminOrder`
 * because of the crash window between creating a Stripe session and persisting its id, and
 * `lib/orphans.ts` sweeps such an order to `expired` an hour later. Until it does, it sits in the
 * panel looking exactly like every other pending order.
 *
 * It is the one optional field on this screen Augusto can act on — it is the handle he would paste
 * into the Stripe dashboard — so its absence is said in words rather than left blank.
 */
export const NeverReachedStripe: Story = {
  args: { order: orderWithoutStripeSession },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Este pedido não chegou ao Stripe.')).toBeInTheDocument()
    await expect(canvas.queryByText(/^Stripe · /)).toBeNull()
  },
}

/**
 * `Responder por e-mail` IS A PURE `mailto:` (spec:4 and spec:206): tracking codes go out by hand,
 * there is no transactional e-mail provider, and this link is the whole mechanism. In the design it
 * is one of the two hoverable things in the admin with no handler and no address behind it.
 *
 * The href is decoded rather than compared against a second call to the builder, which would assert
 * that `routes.mailto` equals itself.
 */
export const RepliesByEmail: Story = {
  args: { order: shippedOrder },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Responder por e-mail' })
    const url = new URL(link.getAttribute('href')!)
    await expect(url.protocol).toBe('mailto:')
    await expect(url.pathname).toBe(shippedOrder.buyer.email)
    const query = new URLSearchParams(url.search)
    await expect(query.get('subject')).toBe(`Pedido ${formatOrderNumber(shippedOrder.orderNumber)}`)
    await expect(query.get('body')).toBe(`Código de rastreio: ${shippedOrder.trackingCode}`)
  },
}

/** With no code to send, the body is left out entirely rather than sent empty. */
export const RepliesWithNoTrackingCodeToQuote: Story = {
  play: async ({ canvas }) => {
    const url = new URL(canvas.getByRole('link', { name: 'Responder por e-mail' }).getAttribute('href')!)
    await expect(url.pathname).toBe(paidOrder.buyer.email)
    await expect(new URLSearchParams(url.search).get('body')).toBeNull()
  },
}

/**
 * THE ADDRESS IS ONE STRING AND THE DESIGN'S SHAPE IS EXACT, down to the em dash (U+2014, one space
 * each side) that separates the street line from the locality line. Every optional part drops out
 * cleanly: `intlCheckout`'s address has no number, no complement and no district, and the result is
 * still a sentence rather than a row of stray commas.
 *
 * The country is a NAME and not the stored two-letter code, resolved through `Intl.DisplayNames` in
 * the panel's own language — a table of country names would be a fourth place for `BR` to be
 * spelled and would have to grow with `INTL_ALLOWED_COUNTRIES`.
 */
export const FormatsAnAddressTheWayTheDesignDraws: Story = {
  play: async () => {
    await expect(formatAddress(paidOrder.shippingAddress!, 'pt')).toBe(
      'Rua Sapucaí, 388, ap. 51 — Floresta, Belo Horizonte / MG, 30150-904, Brasil',
    )
    await expect(formatAddress(intlCheckout.shippingAddress!, 'en')).toBe(
      '350 5th Ave — New York / NY, 10001, United States',
    )
    await expect(formatAddress(intlCheckout.shippingAddress!, 'pt')).toContain('Estados Unidos')
  },
}

/** In English the keys render themselves, and the month abbreviation follows the language. */
export const InEnglish: Story = {
  globals: { locale: 'en' },
  args: { order: shippedOrder, lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(`${formatOrderNumber(shippedOrder.orderNumber)} · 28 Aug 2026`)).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { level: 3, name: 'Delivery' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { level: 3, name: 'Items' })).toBeInTheDocument()
    await expect(canvas.getByText('India ink drawing')).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Reply by e-mail' })).toBeInTheDocument()
  },
}

/**
 * THE THREE MUTED RECIPES THE EXTRACT MEASURED AS FAILING ON THIS PANE: the contact keys and the
 * section eyebrows at `opacity:.55` (3.82:1) and the code/date and delivery lines at `.6` (4.47:1,
 * AA by 0.03). All of them sit at the branch's `opacity-65` floor, which is 5.26:1 — except the
 * section headings, which `SectionRule` draws at FULL ink because the prototype does.
 *
 * THE MUTED VALUE IS ON THE WORD AND NEVER ON A ROW THAT HOLDS SOMETHING ELSE. The contact row is
 * the case to watch: its key is muted and its value is not, and `opacity` composites a subtree as
 * one group, so the same class one element up would dim the e-mail address with it.
 *
 * THE RELATIONAL LINES ARE WHAT HOLD THE ARITHMETIC. Every ratio here is a `>=`, so a measurement
 * bug that errs HIGH passes all of them — deleting the alpha compositing from the shared helper
 * once left the whole 202-story suite green, because an uncomposited muted colour reads as MORE
 * legible than it is.
 */
export const MeasuresItsMutedWordsAgainstTheirNeighbours: Story = {
  play: async ({ canvas }) => {
    const key = canvas.getAllByRole('term')[0]!
    const value = canvas.getAllByRole('definition')[0]!
    await expect(opacityOf(key)).toBeCloseTo(0.65, 5)
    await expect(opacityOf(value)).toBe(1)
    await expect(measure(key, 'color')).toBeGreaterThanOrEqual(4.5)
    await expect(measure(key, 'color')).toBeLessThan(measure(value, 'color'))

    const delivery = canvas.getByText('Correios SEDEX · 3 a 5 dias úteis')
    await expect(opacityOf(delivery)).toBeCloseTo(0.65, 5)
    await expect(measure(delivery, 'color')).toBeGreaterThanOrEqual(4.5)

    const heading = canvas.getByRole('heading', { level: 3, name: 'Envio' })
    await expect(opacityOf(heading)).toBe(1)
    await expect(measure(delivery, 'color')).toBeLessThan(measure(heading, 'color'))
  },
}
