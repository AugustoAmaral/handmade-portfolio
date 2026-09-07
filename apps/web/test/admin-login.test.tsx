import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/i18n'
import { AdminLogin } from '../src/pages/admin/AdminLogin'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('AdminLogin', () => {
  it('stores the token and navigates on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'tok1' }), { status: 200 })))
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/products" element={<p>products-screen</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(localStorage.getItem('shop_admin_token')).toBe('tok1'))
    expect(screen.getByText('products-screen')).toBeInTheDocument()
  })
  it('shows an error on bad credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'nope' } }), { status: 401 }),
      ),
    )
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes><Route path="/admin" element={<AdminLogin />} /></Routes>
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument()
  })
})
