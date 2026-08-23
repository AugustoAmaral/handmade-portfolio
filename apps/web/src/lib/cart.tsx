import { CART_MAX_DISTINCT, CART_MAX_QTY } from '@shop/shared'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface CartLine { slug: string; qty: number }

interface CartApi {
  items: CartLine[]
  add(slug: string): void
  setQty(slug: string, qty: number): void
  remove(slug: string): void
  clear(): void
  count: number
}

const CartContext = createContext<CartApi | null>(null)
const STORAGE_KEY = 'shop_cart'

function load(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const api: CartApi = {
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    add(slug) {
      setItems((prev) => {
        const line = prev.find((i) => i.slug === slug)
        if (line) return prev.map((i) => (i.slug === slug ? { ...i, qty: Math.min(i.qty + 1, CART_MAX_QTY) } : i))
        if (prev.length >= CART_MAX_DISTINCT) return prev
        return [...prev, { slug, qty: 1 }]
      })
    },
    setQty(slug, qty) {
      setItems((prev) =>
        qty <= 0 ? prev.filter((i) => i.slug !== slug) : prev.map((i) => (i.slug === slug ? { ...i, qty: Math.min(qty, CART_MAX_QTY) } : i)),
      )
    },
    remove(slug) {
      setItems((prev) => prev.filter((i) => i.slug !== slug))
    },
    clear() {
      setItems([])
    },
  }

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart outside CartProvider')
  return ctx
}
