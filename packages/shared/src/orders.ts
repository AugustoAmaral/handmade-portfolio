import type { Buyer, ShippingAddress } from './checkout.js'
import type { LocalizedText } from './schemas.js'
import type { ShippingMethod } from './shipping.js'

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'oversold', 'expired'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_NUMBER_PREFIX = 'MHP'
export function formatOrderNumber(n: number): string {
  return `#${ORDER_NUMBER_PREFIX}-${String(n).padStart(4, '0')}`
}

// Admin-driven transitions only. Webhook transitions (pending→paid, pending→expired,
// paid→oversold) are enforced in the API by atomic conditional updates, not by this table.
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: [],
  paid: ['shipped'],
  shipped: [],
  oversold: ['shipped'],
  expired: [],
}
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_ORDER_TRANSITIONS[from].includes(to)
}

export interface OrderItemSnapshot {
  productId: string
  slug: string
  name: LocalizedText
  qty: number
  unitAmountCents: number
}

export interface OrderAmounts {
  itemsCents: number
  shippingCents: number
  totalCents: number
  currency: string
}

/** What the thank-you page sees. No buyer data. */
export interface PublicOrder {
  orderNumber: number
  status: OrderStatus
  items: { name: LocalizedText; qty: number }[]
  totalCents: number
  currency: string
  shippingMethod: ShippingMethod | null
  eta: LocalizedText | null
}

/** What the admin sees. */
export interface AdminOrder {
  id: string
  orderNumber: number
  status: OrderStatus
  createdAt: string
  paidAt?: string
  shippedAt?: string
  buyer: Buyer
  shippingAddress: ShippingAddress | null
  shippingMethod: ShippingMethod | null
  notes?: string
  giftMessage?: string
  referral?: string
  locale: 'pt' | 'en'
  items: OrderItemSnapshot[]
  amounts: OrderAmounts
  trackingCode?: string
  stripeSessionId?: string
  stripePaymentIntentId?: string
}
