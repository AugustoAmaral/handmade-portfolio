import { describe, expect, it } from 'vitest'
import { checkoutRequestSchema } from '../src/schemas'

const valid = { items: [{ slug: 'letter', qty: 1 }], destination: 'BR', locale: 'pt' }

describe('checkoutRequestSchema', () => {
  it('accepts a valid request', () => {
    expect(checkoutRequestSchema.parse(valid)).toEqual(valid)
  })
  it('rejects qty over 5', () => {
    expect(() => checkoutRequestSchema.parse({ ...valid, items: [{ slug: 'letter', qty: 6 }] })).toThrow()
  })
  it('rejects more than 5 distinct items', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => ({ slug, qty: 1 }))
    expect(() => checkoutRequestSchema.parse({ ...valid, items })).toThrow()
  })
  it('rejects duplicate slugs', () => {
    const items = [{ slug: 'a', qty: 1 }, { slug: 'a', qty: 2 }]
    expect(() => checkoutRequestSchema.parse({ ...valid, items })).toThrow()
  })
  it('rejects unknown destination', () => {
    expect(() => checkoutRequestSchema.parse({ ...valid, destination: 'MOON' })).toThrow()
  })
})
