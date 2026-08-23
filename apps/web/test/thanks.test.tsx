import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/i18n'
import { CartProvider } from '../src/lib/cart'
import { ThanksPage } from '../src/pages/ThanksPage'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function renderPage() {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={['/thanks?session_id=sess_123']}>
        <ThanksPage />
      </MemoryRouter>
    </CartProvider>,
  )
}

describe('ThanksPage', () => {
  it('stops polling immediately on a non-404 failure and shows the error message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }), { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    expect(await screen.findByText(/couldn't confirm your order/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
