import { describe, expect, it } from 'vitest'
import { INTL_ALLOWED_COUNTRIES, SHIPPING_METHODS, isAllowedCountry, shippingOptionsFor } from '../src/shipping'

describe('shipping methods', () => {
  it('offers PAC and SEDEX for Brazil, in that order', () => {
    expect(shippingOptionsFor('BR').map((o) => o.id)).toEqual(['pac', 'sedex'])
  })
  it('offers only the international method for an allowed foreign country', () => {
    expect(shippingOptionsFor('US').map((o) => o.id)).toEqual(['intl'])
    expect(shippingOptionsFor('PT')).toEqual([SHIPPING_METHODS.intl])
  })
  it('offers nothing for a country we do not ship to', () => {
    expect(shippingOptionsFor('KP')).toEqual([])
    expect(isAllowedCountry('KP')).toBe(false)
  })
  it('treats Brazil and every curated country as allowed', () => {
    expect(isAllowedCountry('BR')).toBe(true)
    for (const c of INTL_ALLOWED_COUNTRIES) expect(isAllowedCountry(c)).toBe(true)
  })
  it('carries bilingual names and ETAs and BRL cents for each method', () => {
    for (const m of Object.values(SHIPPING_METHODS)) {
      expect(m.cents).toBeGreaterThan(0)
      expect(Number.isInteger(m.cents)).toBe(true)
      expect(m.name.pt.length).toBeGreaterThan(0)
      expect(m.name.en.length).toBeGreaterThan(0)
      expect(m.eta.pt.length).toBeGreaterThan(0)
      expect(m.eta.en.length).toBeGreaterThan(0)
    }
    expect(SHIPPING_METHODS.pac.scope).toBe('BR')
    expect(SHIPPING_METHODS.intl.scope).toBe('INTL')
  })
})
