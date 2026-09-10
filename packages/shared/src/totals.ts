import { SHIPPING_METHODS, type ShippingMethod } from './shipping.js'

export interface TotalsLine {
  priceCents: number
  qty: number
  type: 'physical' | 'digital'
}

export interface Totals {
  itemsCents: number
  shippingCents: number
  totalCents: number
}

export function hasPhysicalItems(lines: readonly { type: 'physical' | 'digital' }[]): boolean {
  return lines.some((l) => l.type === 'physical')
}

// Display math for the web and the pre-Stripe order snapshot for the API. Never a source of
// prices: callers pass priceCents they loaded from the catalog (web) or from Mongo (API).
export function computeTotals(lines: readonly TotalsLine[], method: ShippingMethod | null): Totals {
  const itemsCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0)
  const shippingCents = method && hasPhysicalItems(lines) ? SHIPPING_METHODS[method].cents : 0
  return { itemsCents, shippingCents, totalCents: itemsCents + shippingCents }
}
