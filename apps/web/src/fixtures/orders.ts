import type { AdminOrder, PublicOrder } from '@shop/shared'
import { deepFreeze } from './freeze'

const items: AdminOrder['items'] = [
  { productId: 'p-letter', slug: 'carta-escrita', name: { pt: 'Carta escrita à mão', en: 'Handwritten letter' }, qty: 1, unitAmountCents: 4500 },
  { productId: 'p-drawing', slug: 'desenho-nanquim', name: { pt: 'Desenho a nanquim', en: 'India ink drawing' }, qty: 2, unitAmountCents: 12000 },
]

// Timelines are internally consistent: every order satisfies createdAt <= paidAt <= shippedAt for
// whichever of those it carries. Orders built by spreading `paidOrder` must override `paidAt` too,
// or they inherit a payment that happened before they existed. An admin order-detail story renders
// this as a timeline, so a backwards one is visible rather than theoretical.
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
  items: [items[0]!],
  amounts: { itemsCents: 4500, shippingCents: 2200, totalCents: 6700, currency: 'brl' },
  // Every order that reached Stripe carries a session id, pending and expired included:
  // `apps/api/src/routes/checkout.ts:94` writes it immediately after creating the session, and
  // `models/order.ts:46` indexes it unique + sparse. The field is nonetheless optional in the
  // type because of the crash window between those two writes — an order created but killed
  // before the id is persisted. `lib/orphans.ts` sweeps those to `expired` at boot after an hour.
  // So PR 4's admin UI must still handle its absence; add a fixture for it there if the UI needs one.
  stripeSessionId: 'cs_test_410',
})

export const paidOrder: AdminOrder = deepFreeze({
  ...pendingOrder,
  id: 'o-2',
  orderNumber: 411,
  status: 'paid',
  createdAt: '2026-09-03T09:30:00.000Z',
  paidAt: '2026-09-03T09:31:00.000Z',
  shippingMethod: 'sedex',
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
  paidAt: '2026-08-28T15:04:00.000Z',
  shippedAt: '2026-08-30T10:00:00.000Z',
  trackingCode: 'BR8841200SC',
  buyer: { name: 'Júlia Ferreira', email: 'julia@example.com' },
  stripeSessionId: 'cs_test_412',
})

export const oversoldOrder: AdminOrder = deepFreeze({
  ...paidOrder,
  id: 'o-4',
  orderNumber: 413,
  status: 'oversold',
  createdAt: '2026-09-04T18:45:00.000Z',
  paidAt: '2026-09-04T18:46:00.000Z',
  buyer: { name: 'Bruno Tavares', email: 'bruno@example.com' },
  notes: undefined,
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
  stripeSessionId: 'cs_test_409',
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
