import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { CartProvider, useCart } from '../src/lib/cart'

const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>

afterEach(() => localStorage.clear())

describe('useCart', () => {
  it('adds items and increments qty up to the cap', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.add('letter'))
    act(() => result.current.add('letter'))
    expect(result.current.items).toEqual([{ slug: 'letter', qty: 2 }])
    for (let i = 0; i < 10; i++) act(() => result.current.add('letter'))
    expect(result.current.items[0].qty).toBe(5)
  })
  it('caps distinct items at 5', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    for (const slug of ['a', 'b', 'c', 'd', 'e', 'f']) act(() => result.current.add(slug))
    expect(result.current.items).toHaveLength(5)
  })
  it('persists to localStorage and hydrates on mount', () => {
    const first = renderHook(() => useCart(), { wrapper })
    act(() => first.result.current.add('letter'))
    first.unmount()
    const second = renderHook(() => useCart(), { wrapper })
    expect(second.result.current.items).toEqual([{ slug: 'letter', qty: 1 }])
  })
  it('setQty(0) and remove drop the line; clear empties', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.add('a'))
    act(() => result.current.add('b'))
    act(() => result.current.setQty('a', 0))
    expect(result.current.items).toEqual([{ slug: 'b', qty: 1 }])
    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
  })
})
