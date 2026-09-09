import { ORDER_STATUSES, SHIPPING_METHODS, checkoutRequestSchema, checkoutRules, computeTotals } from '@shop/shared'
import { describe, expect, it } from 'vitest'
import {
  brCheckout,
  brCheckoutErrors,
  cartLines,
  digitalCheckout,
  incompleteBrCheckout,
  intlCheckout,
} from '../src/fixtures/checkout'
import { adminOrders, paidOrder, publicPaidOrder } from '../src/fixtures/orders'
import { products } from '../src/fixtures/products'

describe('fixtures', () => {
  it('ships four active products, one of them featured and one sold out', () => {
    expect(products).toHaveLength(4)
    expect(products.every((p) => p.active)).toBe(true)
    expect(products.filter((p) => p.featured)).toHaveLength(1)
    expect(products.some((p) => p.stock === 0)).toBe(true)
  })

  it('offers checkout values the real schema and rules accept', () => {
    for (const values of [brCheckout, intlCheckout, digitalCheckout]) {
      const parsed = checkoutRequestSchema.parse(values)
      const hasPhysical = values !== digitalCheckout
      expect(checkoutRules(parsed, hasPhysical)).toBeNull()
    }
  })

  it('has cart lines whose totals add up', () => {
    const totals = computeTotals(cartLines, 'sedex')
    expect(totals.itemsCents).toBeGreaterThan(0)
    // cartLines and paidOrder describe the same purchase, so the shared totals math must
    // reproduce the numbers orders.ts hard-codes. Without this the assertion above is vacuous:
    // computeTotals returns totalCents = itemsCents + shippingCents by construction.
    expect(totals).toEqual({
      itemsCents: paidOrder.amounts.itemsCents,
      shippingCents: paidOrder.amounts.shippingCents,
      totalCents: paidOrder.amounts.totalCents,
    })
    expect(publicPaidOrder.totalCents).toBe(totals.totalCents)
    expect(publicPaidOrder.shippingMethod).toBe('sedex')
    expect(publicPaidOrder.eta).toEqual(SHIPPING_METHODS.sedex.eta)
  })

  it('covers every admin order status', () => {
    // Derived from the shared status union, not a hard-coded list: a sixth lifecycle state added
    // to ORDER_STATUSES must fail here rather than quietly go unrendered by every story.
    expect(new Set(adminOrders.map((o) => o.status))).toEqual(new Set(ORDER_STATUSES))
  })

  it('prices every admin order with the real shipping table', () => {
    for (const order of adminOrders) {
      const lines = order.items.map((i) => ({ priceCents: i.unitAmountCents, qty: i.qty, type: 'physical' as const }))
      expect({ id: order.id, ...computeTotals(lines, order.shippingMethod) }).toEqual({
        id: order.id,
        itemsCents: order.amounts.itemsCents,
        shippingCents: order.amounts.shippingCents,
        totalCents: order.amounts.totalCents,
      })
    }
  })

  it('derives the checkout error fixture from the real rules', () => {
    expect(brCheckoutErrors).toEqual(checkoutRules(incompleteBrCheckout, true))
    expect(Object.keys(brCheckoutErrors).sort()).toEqual([
      'shippingAddress.district',
      'shippingAddress.number',
      'shippingAddress.postalCode',
      'shippingAddress.state',
      'shippingMethod',
    ])
  })

  it('never carries buyer keys in the checkout error fixture', () => {
    // Regression guard. The API sends this object straight from checkoutRules
    // (apps/api/src/routes/checkout.ts:36-37), and checkoutRequestSchema.parse has already
    // rejected a bad buyer on a separate path, so a `buyer.*` key here would be a shape the
    // checkout page can never actually receive. The first fixture got this wrong.
    expect(Object.keys(brCheckoutErrors).filter((k) => k.startsWith('buyer'))).toEqual([])
  })
})
