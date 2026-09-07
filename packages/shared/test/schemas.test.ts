import { describe, expect, it } from 'vitest'
import { productInputSchema, productUpdateSchema } from '../src/schemas'

const minimal = {
  slug: 'letter',
  name: { pt: 'Carta', en: 'Letter' },
  description: { pt: 'd', en: 'd' },
  priceCents: 5000,
  type: 'physical',
  stock: null,
  active: true,
}

describe('productInputSchema', () => {
  it('defaults subtitle, specs and featured so v1 payloads still parse', () => {
    expect(productInputSchema.parse(minimal)).toEqual({
      ...minimal,
      subtitle: { pt: '', en: '' },
      specs: [],
      featured: false,
    })
  })
  it('accepts subtitle, specs and featured', () => {
    const parsed = productInputSchema.parse({
      ...minimal,
      subtitle: { pt: 'Papel algodão · 2 folhas', en: 'Cotton paper · 2 sheets' },
      specs: [{ key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5', en: 'A5' } }],
      featured: true,
    })
    expect(parsed.specs).toHaveLength(1)
    expect(parsed.featured).toBe(true)
  })
  it('rejects a spec row missing a language and more than 12 rows', () => {
    expect(() =>
      productInputSchema.parse({ ...minimal, specs: [{ key: { pt: 'Formato', en: '' }, value: { pt: 'A5', en: 'A5' } }] }),
    ).toThrow()
    const rows = Array.from({ length: 13 }, () => ({ key: { pt: 'k', en: 'k' }, value: { pt: 'v', en: 'v' } }))
    expect(() => productInputSchema.parse({ ...minimal, specs: rows })).toThrow()
  })
  it('keeps the v1 constraints (slug charset, min price, non-negative stock)', () => {
    expect(() => productInputSchema.parse({ ...minimal, slug: 'Bad Slug' })).toThrow()
    expect(() => productInputSchema.parse({ ...minimal, priceCents: 50 })).toThrow()
    expect(() => productInputSchema.parse({ ...minimal, stock: -1 })).toThrow()
  })
})

describe('productUpdateSchema', () => {
  it('accepts an optional photos list with key and optional alt', () => {
    const parsed = productUpdateSchema.parse({
      ...minimal,
      photos: [{ key: 'products/1/a.webp', alt: { pt: 'Carta', en: 'Letter' } }, { key: 'products/1/b.webp' }],
    })
    expect(parsed.photos).toHaveLength(2)
    expect(parsed.photos![1]!.alt).toBeUndefined()
  })
  it('rejects a photo entry without key', () => {
    expect(() => productUpdateSchema.parse({ ...minimal, photos: [{ alt: { pt: 'x', en: 'x' } }] })).toThrow()
  })
})
