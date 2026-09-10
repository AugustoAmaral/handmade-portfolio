import { describe, expect, it } from 'vitest'
import { Counter, nextOrderNumber } from '../src/models/counter'

describe('nextOrderNumber', () => {
  it('starts at 1 and increments', async () => {
    expect(await nextOrderNumber()).toBe(1)
    expect(await nextOrderNumber()).toBe(2)
    expect(await nextOrderNumber()).toBe(3)
  })
  it('hands out distinct numbers under concurrency, including the very first upsert', async () => {
    const numbers = await Promise.all(Array.from({ length: 20 }, () => nextOrderNumber()))
    expect(new Set(numbers).size).toBe(20)
    expect(Math.max(...numbers)).toBe(20)
    expect(await Counter.countDocuments()).toBe(1)
  })
})
