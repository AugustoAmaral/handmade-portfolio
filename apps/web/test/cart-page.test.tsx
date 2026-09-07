import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/i18n'
import { CartProvider } from '../src/lib/cart'
import { CartPage } from '../src/pages/CartPage'

const products = [
  {
    id: '1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, description: { pt: 'x', en: 'x' },
    priceCents: 5000, type: 'physical', stock: 1, photos: [], active: true,
  },
]

function renderPage() {
  localStorage.setItem('shop_cart', JSON.stringify([{ slug: 'letter', qty: 1 }]))
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CartProvider>
        <MemoryRouter>
          <CartPage />
        </MemoryRouter>
      </CartProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('CartPage checkout errors', () => {
  it('shows a specific message naming the item on OUT_OF_STOCK and removes it from the cart', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/products')) {
        return Promise.resolve(new Response(JSON.stringify({ products }), { status: 200 }))
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: { code: 'OUT_OF_STOCK', message: 'Not enough stock for: letter' } }),
          { status: 400 },
        ),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    const checkoutButton = await screen.findByRole('button', { name: /checkout/i })
    await userEvent.click(checkoutButton)

    expect(await screen.findByText(/"Letter" just sold out/i)).toBeInTheDocument()
    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument()
  })
})
