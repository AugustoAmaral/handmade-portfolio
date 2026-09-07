import { describe, expect, it } from 'vitest'
import { ORDER_STATUSES, canTransition, formatOrderNumber } from '../src/orders'

describe('orders vocabulary', () => {
  it('formats order numbers zero-padded to four digits with the MHP prefix', () => {
    expect(formatOrderNumber(1)).toBe('#MHP-0001')
    expect(formatOrderNumber(413)).toBe('#MHP-0413')
    expect(formatOrderNumber(12345)).toBe('#MHP-12345')
  })
  it('lists the five statuses', () => {
    expect(ORDER_STATUSES).toEqual(['pending', 'paid', 'shipped', 'oversold', 'expired'])
  })
  it('only allows the admin to ship paid or oversold orders', () => {
    expect(canTransition('paid', 'shipped')).toBe(true)
    expect(canTransition('oversold', 'shipped')).toBe(true)
    expect(canTransition('pending', 'shipped')).toBe(false)
    expect(canTransition('shipped', 'shipped')).toBe(false)
    expect(canTransition('expired', 'shipped')).toBe(false)
    expect(canTransition('paid', 'paid')).toBe(false)
  })
})
