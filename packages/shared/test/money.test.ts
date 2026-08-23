import { describe, expect, it } from 'vitest'
import { formatPrice } from '../src/money'

describe('formatPrice', () => {
  it('formats BRL for pt locale (NBSP after R$)', () => {
    expect(formatPrice(5000, 'pt')).toBe('R$ 50,00')
  })
  it('formats BRL for en locale', () => {
    expect(formatPrice(12050, 'en')).toBe('R$120.50')
  })
})
