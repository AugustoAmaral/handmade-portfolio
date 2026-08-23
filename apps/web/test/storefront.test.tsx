import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/i18n'
import { Storefront } from '../src/pages/Storefront'

const products = [
  {
    id: '1', slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, description: { pt: 'x', en: 'x' },
    priceCents: 5000, type: 'physical', stock: null, photos: [], active: true,
  },
  {
    id: '2', slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, description: { pt: 'x', en: 'x' },
    priceCents: 12000, type: 'physical', stock: 0, photos: [], active: true,
  },
]

function renderPage() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ products }), { status: 200 })))
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Storefront />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Storefront', () => {
  it('renders products with localized names and formatted prices', async () => {
    renderPage()
    expect(await screen.findByText('Letter')).toBeInTheDocument()
    expect(screen.getByText('R$120.00')).toBeInTheDocument()
  })
  it('shows a sold-out badge when stock is 0', async () => {
    renderPage()
    expect(await screen.findByText(/sold out/i)).toBeInTheDocument()
  })
})
