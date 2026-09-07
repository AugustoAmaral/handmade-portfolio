import { describe, expect, it } from 'vitest'
import { computeTotals, hasPhysicalItems } from '../src/totals'

const letter = { priceCents: 5000, qty: 2, type: 'physical' as const }
const doodle = { priceCents: 1500, qty: 1, type: 'digital' as const }

describe('computeTotals', () => {
  it('sums items and adds the chosen method for a physical cart', () => {
    expect(computeTotals([letter, doodle], 'sedex')).toEqual({ itemsCents: 11500, shippingCents: 4100, totalCents: 15600 })
  })
  it('charges no shipping for a digital-only cart even if a method is passed', () => {
    expect(computeTotals([doodle], 'pac')).toEqual({ itemsCents: 1500, shippingCents: 0, totalCents: 1500 })
  })
  it('charges no shipping when no method is chosen yet', () => {
    expect(computeTotals([letter], null)).toEqual({ itemsCents: 10000, shippingCents: 0, totalCents: 10000 })
  })
  it('returns zeros for an empty cart', () => {
    expect(computeTotals([], 'pac')).toEqual({ itemsCents: 0, shippingCents: 0, totalCents: 0 })
  })
})

describe('hasPhysicalItems', () => {
  it('is true when at least one line is physical', () => {
    expect(hasPhysicalItems([doodle, letter])).toBe(true)
    expect(hasPhysicalItems([doodle])).toBe(false)
    expect(hasPhysicalItems([])).toBe(false)
  })
})
