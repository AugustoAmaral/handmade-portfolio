import { CART_MAX_DISTINCT, CART_MAX_QTY } from '@shop/shared'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCart } from '../../src/app/state/useCart'

beforeEach(() => localStorage.clear())

describe('useCart', () => {
  it('adds a line and counts units, not lines', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.add('a'))
    act(() => result.current.add('b'))
    expect(result.current.items).toEqual([
      { slug: 'a', qty: 2 },
      { slug: 'b', qty: 1 },
    ])
    expect(result.current.count).toBe(3)
  })

  it('caps a line at CART_MAX_QTY and the cart at CART_MAX_DISTINCT', () => {
    const { result } = renderHook(() => useCart())
    for (let i = 0; i < CART_MAX_QTY + 3; i++) act(() => result.current.add('a'))
    expect(result.current.items[0]!.qty).toBe(CART_MAX_QTY)

    for (let i = 0; i < CART_MAX_DISTINCT + 2; i++) act(() => result.current.add(`slug-${i}`))
    expect(result.current.items.length).toBe(CART_MAX_DISTINCT)
  })

  it('removes the line when the quantity reaches zero', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.setQty('a', 0))
    expect(result.current.items).toEqual([])
  })

  it('sets a quantity directly and clamps it to CART_MAX_QTY', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.setQty('a', 3))
    expect(result.current.items).toEqual([{ slug: 'a', qty: 3 }])

    // `add` is not the only way past the cap. The drawer's stepper is the only caller today, but
    // it passes a number, and a cart the checkout schema rejects is a checkout that 400s.
    act(() => result.current.setQty('a', CART_MAX_QTY + 4))
    expect(result.current.items[0]!.qty).toBe(CART_MAX_QTY)
  })

  it('removes only the named line', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.add('b'))
    act(() => result.current.remove('a'))
    expect(result.current.items).toEqual([{ slug: 'b', qty: 1 }])
  })

  it('persists to localStorage and reloads from it', () => {
    const first = renderHook(() => useCart())
    act(() => first.result.current.add('a'))
    expect(JSON.parse(localStorage.getItem('shop_cart')!)).toEqual([{ slug: 'a', qty: 1 }])

    const second = renderHook(() => useCart())
    expect(second.result.current.items).toEqual([{ slug: 'a', qty: 1 }])
  })

  it('starts empty when the stored value is corrupt rather than throwing', () => {
    localStorage.setItem('shop_cart', '{not json')
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
  })

  it('starts empty when the stored value is valid JSON of the wrong shape', () => {
    // The v1 guarded the parse but not the result: `JSON.parse('"x"')` succeeds and hands the
    // cart a string, and every consumer then reads `.slug` off characters.
    localStorage.setItem('shop_cart', '{"slug":"a"}')
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([])
  })

  it('drops the stored entries that are not cart items and keeps the ones that are', () => {
    // The array check above is not the same guard as the item check here, and only this shape
    // separates them: it IS an array, so `Array.isArray` passes it and every malformed ELEMENT
    // reaches a consumer that reads `line.qty`. Note an over-cap qty is dropped, not clamped —
    // a stored line the checkout schema would reject is treated as corrupt, not as a big order.
    localStorage.setItem(
      'shop_cart',
      JSON.stringify([{ slug: 'a', qty: 2 }, { nope: 1 }, 'x', null, { slug: 'c', qty: CART_MAX_QTY + 1 }]),
    )
    const { result } = renderHook(() => useCart())
    expect(result.current.items).toEqual([{ slug: 'a', qty: 2 }])
  })

  it('clears', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.add('a'))
    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
    expect(JSON.parse(localStorage.getItem('shop_cart')!)).toEqual([])
  })
})
