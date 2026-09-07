import { describe, expect, it } from 'vitest'
import { checkoutRequestSchema, checkoutRules } from '../src/checkout'

const buyer = { name: 'Marina Bicalho', email: 'marina@example.com' }
const brAddress = {
  country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388', complement: 'ap. 51',
  district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
}
const usAddress = { country: 'US', postalCode: '10001', street: '350 5th Ave', city: 'New York', state: 'NY' }
const base = { items: [{ slug: 'letter', qty: 1 }], locale: 'pt', buyer }

describe('checkoutRequestSchema', () => {
  it('accepts a minimal digital-only request', () => {
    const parsed = checkoutRequestSchema.parse(base)
    expect(parsed.buyer.email).toBe('marina@example.com')
    expect(parsed.shippingAddress).toBeUndefined()
  })
  it('accepts a full physical request and uppercases the country', () => {
    const parsed = checkoutRequestSchema.parse({
      ...base, shippingAddress: { ...brAddress, country: 'br' }, shippingMethod: 'pac',
      notes: 'For my grandmother', giftMessage: 'Happy 80th', referral: 'Twitter',
    })
    expect(parsed.shippingAddress!.country).toBe('BR')
    expect(parsed.shippingMethod).toBe('pac')
  })
  it('rejects qty over 5, more than 5 distinct items and duplicate slugs', () => {
    expect(() => checkoutRequestSchema.parse({ ...base, items: [{ slug: 'letter', qty: 6 }] })).toThrow()
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => ({ slug, qty: 1 }))
    expect(() => checkoutRequestSchema.parse({ ...base, items: six })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, items: [{ slug: 'a', qty: 1 }, { slug: 'a', qty: 2 }] })).toThrow()
  })
  it('rejects a bad e-mail, a one-letter name, an unknown method and oversized notes', () => {
    expect(() => checkoutRequestSchema.parse({ ...base, buyer: { ...buyer, email: 'nope' } })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, buyer: { ...buyer, name: 'M' } })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, shippingMethod: 'drone' })).toThrow()
    expect(() => checkoutRequestSchema.parse({ ...base, notes: 'x'.repeat(1001) })).toThrow()
  })
  it('does not allow CPF or any unknown buyer field to sneak in', () => {
    const parsed = checkoutRequestSchema.parse({ ...base, buyer: { ...buyer, cpf: '000' } })
    expect((parsed.buyer as Record<string, unknown>).cpf).toBeUndefined()
  })
})

describe('checkoutRules', () => {
  it('has no rules for a digital-only cart', () => {
    expect(checkoutRules({}, false)).toBeNull()
    expect(checkoutRules({ shippingAddress: usAddress, shippingMethod: 'pac' }, false)).toBeNull()
  })
  it('requires address and method for a physical cart', () => {
    expect(checkoutRules({}, true)).toEqual({ shippingAddress: ['required'], shippingMethod: ['required'] })
  })
  it('accepts a valid Brazilian address with PAC or SEDEX', () => {
    expect(checkoutRules({ shippingAddress: brAddress, shippingMethod: 'pac' }, true)).toBeNull()
    expect(checkoutRules({ shippingAddress: brAddress, shippingMethod: 'sedex' }, true)).toBeNull()
  })
  it('enforces CEP, number, district and 2-letter state for Brazil', () => {
    const errors = checkoutRules({
      shippingAddress: { ...brAddress, postalCode: '123', number: undefined, district: undefined, state: 'Minas' },
      shippingMethod: 'pac',
    }, true)
    expect(errors).toEqual({
      'shippingAddress.postalCode': ['invalid_cep'],
      'shippingAddress.number': ['required'],
      'shippingAddress.district': ['required'],
      'shippingAddress.state': ['invalid_state'],
    })
  })
  it('accepts CEP with or without the dash', () => {
    expect(checkoutRules({ shippingAddress: { ...brAddress, postalCode: '30150904' }, shippingMethod: 'pac' }, true)).toBeNull()
  })
  it('rejects a Brazilian method for a foreign address and vice versa', () => {
    expect(checkoutRules({ shippingAddress: usAddress, shippingMethod: 'sedex' }, true)).toEqual({ shippingMethod: ['not_available'] })
    expect(checkoutRules({ shippingAddress: brAddress, shippingMethod: 'intl' }, true)).toEqual({ shippingMethod: ['not_available'] })
  })
  it('accepts the international method for an allowed country', () => {
    expect(checkoutRules({ shippingAddress: usAddress, shippingMethod: 'intl' }, true)).toBeNull()
  })
  it('rejects a country we do not ship to', () => {
    const errors = checkoutRules({ shippingAddress: { ...usAddress, country: 'KP' }, shippingMethod: 'intl' }, true)
    expect(errors).toEqual({ 'shippingAddress.country': ['not_allowed'], shippingMethod: ['not_available'] })
  })
})
