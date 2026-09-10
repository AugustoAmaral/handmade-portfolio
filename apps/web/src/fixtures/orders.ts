import type { AdminOrder, PublicOrder } from '@shop/shared'
import { deepFreeze } from './freeze'

const letterLine: AdminOrder['items'][number] = { productId: 'p-letter', slug: 'carta-escrita', name: { pt: 'Carta escrita à mão', en: 'Handwritten letter' }, qty: 1, unitAmountCents: 4500 }
const drawingLine: AdminOrder['items'][number] = { productId: 'p-drawing', slug: 'desenho-nanquim', name: { pt: 'Desenho a nanquim', en: 'India ink drawing' }, qty: 2, unitAmountCents: 12000 }
const digitalLine: AdminOrder['items'][number] = { productId: 'p-digital', slug: 'carta-digital', name: { pt: 'Carta digital', en: 'Digital letter' }, qty: 2, unitAmountCents: 2000 }

const items: AdminOrder['items'] = [letterLine, drawingLine]

// NO TWO ORDERS COST THE SAME, and that is a fixture rule rather than an accident. PR 3's sweep
// recorded these as money-identical: `shippedOrder` and `oversoldOrder` spread `paidOrder` and
// `expiredOrder` spreads `pendingOrder`, and none of the three redeclared `amounts` — so three
// orders carried 32600 and two carried 6700. An admin detail pane asserting that it shows THIS
// order's total then passed on three other orders as well, which is the defect this branch keeps
// producing: a test that is green because two values coincide. Every order below now has its own
// items array and its own total, and `fixtures.test.ts` asserts the distinctness so a future
// fixture cannot quietly collapse it again.
//
// Timelines are internally consistent: every order satisfies createdAt <= paidAt <= shippedAt for
// whichever of those it carries. Orders built by spreading `paidOrder` must override `paidAt` too,
// or they inherit a payment that happened before they existed.
//
// AND NO TWO OF THOSE STAMPS FALL ON THE SAME DAY, which is the second half of the same rule and
// was found by a mutation that survived: every order used to be paid a minute or two after it was
// created, so a pane showing `paidAt` where it should show `createdAt` printed exactly the same
// date and every assertion about it stayed green. A Stripe session is valid for 24 hours, so being
// paid the next morning is the ordinary case anyway.
export const pendingOrder: AdminOrder = deepFreeze({
  id: 'o-1',
  orderNumber: 410,
  status: 'pending',
  createdAt: '2026-09-01T12:00:00.000Z',
  buyer: { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' },
  shippingAddress: {
    country: 'BR',
    postalCode: '30150-904',
    street: 'Rua Sapucaí',
    number: '388',
    complement: 'ap. 51',
    district: 'Floresta',
    city: 'Belo Horizonte',
    state: 'MG',
  },
  shippingMethod: 'pac',
  notes: 'A carta é para minha avó, aniversário de 80 anos.',
  locale: 'pt',
  items: [letterLine],
  amounts: { itemsCents: 4500, shippingCents: 2200, totalCents: 6700, currency: 'brl' },
  // Every order that reached Stripe carries a session id, pending and expired included:
  // `apps/api/src/routes/checkout.ts:94` writes it immediately after creating the session, and
  // `models/order.ts:46` indexes it unique + sparse. The field is nonetheless optional in the
  // type because of the crash window between those two writes — an order created but killed
  // before the id is persisted. `lib/orphans.ts` sweeps those to `expired` at boot after an hour.
  // PR 4 Task 6 took up the invitation this comment used to end with: the admin order detail
  // renders the Stripe reference and says so when there is none, and `orderWithoutStripeSession`
  // below is the fixture behind that branch.
  stripeSessionId: 'cs_test_410',
})

export const paidOrder: AdminOrder = deepFreeze({
  ...pendingOrder,
  id: 'o-2',
  orderNumber: 411,
  status: 'paid',
  // ITS OWN BUYER, like every other order below. It used to inherit `pendingOrder`'s, and the
  // buyer's name is what the list prints as a row and the detail pane prints as its `<h2>` and its
  // region name — so a lookup that answered with the order NEXT TO this one rendered the same nine
  // characters and `TheListAndTheDetailAgree` could not tell. `fixtures.test.ts` pins the
  // distinctness now, so a later fixture cannot collapse it again.
  buyer: { name: 'Cecília Andrade', email: 'cecilia@example.com', phone: '+55 31 98888-4412' },
  createdAt: '2026-09-03T09:30:00.000Z',
  paidAt: '2026-09-04T08:00:00.000Z',
  shippingMethod: 'sedex',
  // `referral` is the checkout's optional "Como me encontrou?" and it is deliberately set HERE
  // rather than on `pendingOrder`: this way `paid`, `shipped` and `oversold` carry one and
  // `pending` and `expired` do not, so the admin's contact list is rendered both with and without
  // the row by fixtures that already exist.
  referral: 'Twitter',
  items,
  amounts: { itemsCents: 28500, shippingCents: 4100, totalCents: 32600, currency: 'brl' },
  stripeSessionId: 'cs_test_411',
})

export const shippedOrder: AdminOrder = deepFreeze({
  ...paidOrder,
  id: 'o-3',
  orderNumber: 412,
  status: 'shipped',
  createdAt: '2026-08-28T15:00:00.000Z',
  paidAt: '2026-08-29T10:00:00.000Z',
  shippedAt: '2026-08-30T10:00:00.000Z',
  trackingCode: 'BR8841200SC',
  buyer: { name: 'Júlia Ferreira', email: 'julia@example.com' },
  items: [{ ...drawingLine, qty: 1 }],
  amounts: { itemsCents: 12000, shippingCents: 4100, totalCents: 16100, currency: 'brl' },
  stripeSessionId: 'cs_test_412',
})

export const oversoldOrder: AdminOrder = deepFreeze({
  ...paidOrder,
  id: 'o-4',
  orderNumber: 413,
  status: 'oversold',
  createdAt: '2026-09-04T18:45:00.000Z',
  paidAt: '2026-09-05T12:00:00.000Z',
  buyer: { name: 'Bruno Tavares', email: 'bruno@example.com' },
  notes: undefined,
  // The only fixture with a gift message, and the only one with no notes — the two blocks the
  // admin renders from free text are separate facts and a fixture carrying both would not tell
  // them apart.
  giftMessage: 'Feliz aniversário, Lu. Do seu irmão chato.',
  items: [{ ...letterLine, qty: 2 }, { ...drawingLine, qty: 1 }],
  amounts: { itemsCents: 21000, shippingCents: 4100, totalCents: 25100, currency: 'brl' },
  stripeSessionId: 'cs_test_413',
})

export const expiredOrder: AdminOrder = deepFreeze({
  ...pendingOrder,
  id: 'o-5',
  orderNumber: 409,
  status: 'expired',
  createdAt: '2026-09-02T09:10:00.000Z',
  buyer: { name: 'Helena Prado', email: 'helena@example.com' },
  notes: undefined,
  items: [drawingLine],
  amounts: { itemsCents: 24000, shippingCents: 2200, totalCents: 26200, currency: 'brl' },
  stripeSessionId: 'cs_test_409',
})

/**
 * A DIGITAL-ONLY ORDER: no address and no shipping method, both of which `AdminOrder` types as
 * `null` and no other fixture ever is. `checkoutRequestSchema` makes both optional and
 * `computeTotals` charges no postage when nothing physical is in the cart, so the shop genuinely
 * produces this shape — and the admin's delivery block has to render it rather than print an empty
 * address. It is `paid` because that is the state in which somebody looks at it and sends the file.
 */
export const digitalOrder: AdminOrder = deepFreeze({
  ...pendingOrder,
  id: 'o-6',
  orderNumber: 414,
  status: 'paid',
  createdAt: '2026-09-05T08:00:00.000Z',
  paidAt: '2026-09-06T09:00:00.000Z',
  buyer: { name: 'Tiago Menezes', email: 'tiago@example.com' },
  shippingAddress: null,
  shippingMethod: null,
  notes: undefined,
  items: [digitalLine],
  amounts: { itemsCents: 4000, shippingCents: 0, totalCents: 4000, currency: 'brl' },
  stripeSessionId: 'cs_test_414',
})

/**
 * DISPATCHED WITH NO TRACKING CODE, which is the ORDINARY case and not an edge one: the API parses
 * `trackingCode` as `.optional()`, so a shipment handed over in person is legal with the field
 * absent, and `if (patch.trackingCode)` leaves whatever is stored alone. Without this fixture the
 * only shipped order on the branch carries a code, and the delivery line's "no code" branch would
 * be reachable by no story at all.
 */
export const shippedWithoutTracking: AdminOrder = deepFreeze({
  ...pendingOrder,
  id: 'o-7',
  orderNumber: 415,
  status: 'shipped',
  createdAt: '2026-08-20T11:00:00.000Z',
  paidAt: '2026-08-21T09:00:00.000Z',
  shippedAt: '2026-08-22T09:00:00.000Z',
  buyer: { name: 'Renata Villas', email: 'renata@example.com' },
  notes: undefined,
  items: [{ ...letterLine, qty: 3 }],
  amounts: { itemsCents: 13500, shippingCents: 2200, totalCents: 15700, currency: 'brl' },
  stripeSessionId: 'cs_test_415',
})

/**
 * THE CRASH-WINDOW ORDER: created, then killed before `checkout.ts` could persist the session id.
 * `stripeSessionId` is the only optional field on `AdminOrder` that the admin can do something
 * about — it is the handle Augusto would paste into the Stripe dashboard — so its absence is the
 * one thing on that screen that has to be said in words rather than left blank.
 */
export const orderWithoutStripeSession: AdminOrder = deepFreeze({
  ...pendingOrder,
  id: 'o-8',
  orderNumber: 416,
  status: 'pending',
  createdAt: '2026-09-06T21:15:00.000Z',
  buyer: { name: 'Caio Bastos', email: 'caio@example.com' },
  notes: undefined,
  shippingMethod: 'sedex',
  items: [letterLine, { ...drawingLine, qty: 1 }],
  amounts: { itemsCents: 16500, shippingCents: 4100, totalCents: 20600, currency: 'brl' },
  stripeSessionId: undefined,
})

// All five lifecycle states — the admin table renders this list, so a missing state
// means a status pill nobody ever sees in a story. Not sorted: ordering is the table's job.
export const adminOrders: AdminOrder[] = deepFreeze([
  oversoldOrder,
  shippedOrder,
  paidOrder,
  pendingOrder,
  expiredOrder,
])

export const publicPaidOrder: PublicOrder = deepFreeze({
  orderNumber: 411,
  status: 'paid',
  items: items.map((i) => ({ name: i.name, qty: i.qty })),
  totalCents: 32600,
  currency: 'brl',
  shippingMethod: 'sedex',
  eta: { pt: '3 a 5 dias úteis', en: '3–5 business days' },
})

/** The Done page covers pending as well as paid (spec, "Done page"), so both shapes exist. */
export const publicPendingOrder: PublicOrder = deepFreeze({
  orderNumber: 410,
  status: 'pending',
  items: [{ name: items[0]!.name, qty: items[0]!.qty }],
  totalCents: 6700,
  currency: 'brl',
  shippingMethod: 'pac',
  eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' },
})
