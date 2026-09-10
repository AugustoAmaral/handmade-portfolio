import { CART_MAX_DISTINCT, CART_MAX_QTY, type CartItem, cartItemSchema } from '@shop/shared'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'shop_cart'

// Validated on read, not just parsed. The stored value is user-editable and survives deploys, so
// a shape from an older version — or a hand-edited one — must degrade to an empty cart rather
// than reach the UI as a half-formed line. Both guards are load-bearing and neither implies the
// other: `Array.isArray` rejects a stored object, the per-item schema rejects a bad element
// inside a real array. An item the checkout schema would reject (over-cap qty) is dropped rather
// than clamped — a cart that cannot be ordered is corrupt, not large.
function load(): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const result = cartItemSchema.safeParse(item)
      return result.success ? [result.data] : []
    })
  } catch {
    return []
  }
}

export interface CartApi {
  items: CartItem[]
  count: number
  add(slug: string): void
  setQty(slug: string, qty: number): void
  remove(slug: string): void
  clear(): void
}

export function useCart(): CartApi {
  const [items, setItems] = useState<CartItem[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const add = useCallback((slug: string) => {
    setItems((prev) => {
      const line = prev.find((i) => i.slug === slug)
      if (line) return prev.map((i) => (i.slug === slug ? { ...i, qty: Math.min(i.qty + 1, CART_MAX_QTY) } : i))
      if (prev.length >= CART_MAX_DISTINCT) return prev
      return [...prev, { slug, qty: 1 }]
    })
  }, [])

  const setQty = useCallback((slug: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.slug !== slug)
        : prev.map((i) => (i.slug === slug ? { ...i, qty: Math.min(qty, CART_MAX_QTY) } : i)),
    )
  }, [])

  const remove = useCallback((slug: string) => setItems((prev) => prev.filter((i) => i.slug !== slug)), [])
  const clear = useCallback(() => setItems([]), [])

  return { items, count: items.reduce((n, i) => n + i.qty, 0), add, setQty, remove, clear }
}
