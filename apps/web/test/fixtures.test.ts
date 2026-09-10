import { ORDER_STATUSES, SHIPPING_METHODS, checkoutRequestSchema, checkoutRules, computeTotals } from '@shop/shared'
import { describe, expect, it } from 'vitest'
import {
  brCheckout,
  brCheckoutErrors,
  buyerCheckoutErrors,
  cartLines,
  digitalCheckout,
  intlCheckout,
} from '../src/fixtures/checkout'
import { adminOrders, paidOrder, publicPaidOrder, publicPendingOrder } from '../src/fixtures/orders'
import {
  digitalLetter,
  drawing,
  inactiveGuide,
  letter,
  productWithMaxSpecs,
  productWithThreePhotos,
  productWithoutPhotos,
  products,
  soldOutDrawing,
} from '../src/fixtures/products'

const allProducts = [
  letter,
  drawing,
  soldOutDrawing,
  digitalLetter,
  inactiveGuide,
  productWithoutPhotos,
  productWithMaxSpecs,
  productWithThreePhotos,
]

describe('fixtures', () => {
  it('ships four active products, one of them featured and one sold out', () => {
    expect(products).toHaveLength(4)
    expect(products.every((p) => p.active)).toBe(true)
    expect(products.filter((p) => p.featured)).toHaveLength(1)
    expect(products.some((p) => p.stock === 0)).toBe(true)
  })

  it('gives every product its own description and specs', () => {
    // Most of these are built by spreading another product, which used to leak the parent's prose
    // (the pencil portrait described itself as an India ink drawing) and its specs array by
    // reference. Both halves are checked: distinct text, and distinct array identities.
    expect(new Set(allProducts.map((p) => p.description.pt)).size).toBe(allProducts.length)
    expect(new Set(allProducts.map((p) => p.description.en)).size).toBe(allProducts.length)
    const specs = allProducts.map((p) => p.specs).filter((s) => s.length > 0)
    expect(new Set(specs).size).toBe(specs.length)
  })

  it('offers physical checkout values the real schema and rules accept', () => {
    // Only the physical ones: `checkoutRules` returns null immediately when hasPhysical is false,
    // so asserting toBeNull() for the digital fixture would pass no matter what it contained.
    for (const values of [brCheckout, intlCheckout]) {
      const parsed = checkoutRequestSchema.parse(values)
      expect(checkoutRules(parsed, true)).toBeNull()
    }
  })

  it('offers a digital checkout that needs no address', () => {
    const parsed = checkoutRequestSchema.parse(digitalCheckout)
    expect(parsed.items.map((i) => i.slug)).toEqual([digitalLetter.slug])
    expect(parsed.shippingAddress).toBeUndefined()
    expect(parsed.shippingMethod).toBeUndefined()
    // Priced WITH a shipping method selected, deliberately. `computeTotals` short-circuits to zero
    // shipping when the method is null, so passing null here would hold for a physical cart too.
    // Passing 'sedex' means the zero can only come from `hasPhysicalItems` being false.
    // `type` comes from the product, not a hard-coded 'digital': that is what makes this assert
    // something about the FIXTURE rather than about the literal typed on the line below.
    const lines = parsed.items.map((i) => ({ priceCents: digitalLetter.priceCents, qty: i.qty, type: digitalLetter.type }))
    expect(computeTotals(lines, 'sedex')).toEqual({
      itemsCents: digitalLetter.priceCents,
      shippingCents: 0,
      totalCents: digitalLetter.priceCents,
    })
  })

  it('has cart lines whose totals match the paid order', () => {
    // Anchored on independent numbers: `totalCents === itemsCents + shippingCents` is true by
    // construction of computeTotals and would hold for any cart at all.
    const totals = computeTotals(cartLines, 'sedex')
    expect(totals).toEqual({
      itemsCents: paidOrder.amounts.itemsCents,
      shippingCents: paidOrder.amounts.shippingCents,
      totalCents: paidOrder.amounts.totalCents,
    })
    expect(publicPaidOrder.totalCents).toBe(totals.totalCents)
    expect(publicPaidOrder.eta).toEqual(SHIPPING_METHODS.sedex.eta)
    expect(publicPendingOrder.eta).toEqual(SHIPPING_METHODS.pac.eta)
  })

  it('covers every admin order status', () => {
    // Derived from the shared union, so a sixth state added upstream fails here instead of
    // silently going unrendered by every story.
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

  it('keeps every order timeline ordered and every Stripe session unique', () => {
    // Orders are built by spreading `paidOrder`, which used to carry its `paidAt` and its
    // `stripeSessionId` into orders that then overrode only `createdAt`: one shipped four days
    // before it was paid, another was paid before it existed, and three shared one Stripe session.
    for (const o of adminOrders) {
      const stamps = [o.createdAt, o.paidAt, o.shippedAt].filter((s): s is string => s != null)
      expect({ id: o.id, stamps }).toEqual({ id: o.id, stamps: [...stamps].sort() })
    }
    // Not filtered on presence: every order that reached Stripe has a session id, so an order
    // missing one must fail here rather than quietly drop out of the uniqueness check.
    const sessions = adminOrders.map((o) => o.stripeSessionId)
    expect(sessions.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)
    expect(new Set(sessions).size).toBe(adminOrders.length)
  })

  it('exposes the checkout errors the API can really send', () => {
    // Two exact key lists, and nothing else. The rules never key on the buyer — a buyer error
    // arrives from the zod path instead, in its own response, which is what `buyerCheckoutErrors`
    // is for — and both halves of that sentence are already stated by the lists below. The
    // `startsWith('buyer')` guards that used to sit beside them could not fail: each one was
    // decided by the exact-key assertion on the line above it.
    expect(Object.keys(brCheckoutErrors).sort()).toEqual([
      'shippingAddress.district',
      'shippingAddress.number',
      'shippingAddress.postalCode',
      'shippingAddress.state',
      'shippingMethod',
    ])
    expect(Object.keys(buyerCheckoutErrors).sort()).toEqual(['buyer.email', 'buyer.name'])
  })

  it('freezes the fixtures so one story cannot corrupt another', () => {
    expect(() => {
      ;(letter.specs as unknown as unknown[]).push({})
    }).toThrow()
    expect(() => {
      ;(paidOrder.shippingAddress as unknown as Record<string, string>).city = 'Nowhere'
    }).toThrow()
    // Spreading a frozen fixture to override a field still works — that is how stories vary them.
    const varied = { ...letter, priceCents: 999, name: { pt: 'Outra', en: 'Other' } }
    expect(varied.priceCents).toBe(999)
    expect(varied.slug).toBe(letter.slug)
    expect(letter.priceCents).toBe(4500)
  })
})
