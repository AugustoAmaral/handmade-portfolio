import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { AdminLoginPage } from './AdminLoginPage'
import { inAdminShell } from './AdminShell.stories'

const meta = {
  component: AdminLoginPage,
  title: 'Pages/AdminLoginPage',
  // The signed-out bar, which is the only one this screen is ever seen under: the two section
  // links would land back on the login they were clicked from.
  decorators: [inAdminShell(undefined, false)],
  args: { values: { email: '', password: '' }, onChange: fn(), onSubmit: fn() },
} satisfies Meta<typeof AdminLoginPage>
export default meta
type Story = StoryObj<typeof meta>

/**
 * THE WHOLE SCREEN, WHICH IS ONE CARD IN AN EMPTY PANEL. The design has no login at all — `senha`,
 * `login`, `token`, `entrar`, `sair` and `password` return zero hits across the prototype's 975
 * lines — so this page is the card Task 2 invented plus the one thing only a page can decide:
 * where it sits, and that it is the entire contents of the shell's `<main>`.
 */
export const SignedOut: Story = {
  play: async ({ canvas }) => {
    // The card's own `<h1>` is the DOCUMENT's `<h1>`, which is why this page adds no heading of its
    // own. Two would put a "Painel" over "Entrar no painel" and say the same thing twice.
    const headings = canvas.getAllByRole('heading')
    await expect(headings.map((h) => h.tagName)).toEqual(['H1'])
    await expect(headings[0]!.textContent).toBe('Entrar no painel')

    // Inside the one `<main>`, not beside it. The page is the only thing in it.
    await expect(canvas.getByRole('button', { name: 'Entrar' }).closest('main')).not.toBeNull()
    await expect(canvas.getAllByRole('main')).toHaveLength(1)

    // The bar this screen is seen under has nothing a session pays for, and still has the way out.
    await expect(canvas.queryByRole('link', { name: 'Produtos' })).toBeNull()
    await expect(canvas.getByRole('link', { name: 'Ver a loja' })).toBeInTheDocument()
  },
}

/**
 * A PASS-THROUGH PAGE'S ONE FAILURE MODE IS DROPPING A PROP, so the three that are easiest to lose
 * — the two optional flags and the error code — are each asserted through the page rather than
 * only on the card. `LoginCard.stories` proves the card renders them; this proves they arrive.
 */
export const RefusedAndRemembered: Story = {
  args: { error: 'invalid-credentials', pending: false, values: { email: 'augusto@example.com', password: '' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('E-mail e senha não conferem.')
    await expect(canvas.getByLabelText('E-mail')).toHaveValue('augusto@example.com')
    await expect(canvas.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  },
}

export const SessionEnded: Story = {
  args: { sessionEnded: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Sua sessão terminou. Entre de novo.')).toBeInTheDocument()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Entrar' })).toBeDisabled()
    await expect(canvas.getByRole('status').textContent).toBe('Entrando…')
  },
}

export const Submits: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByLabelText('Senha'), 'segredo{Enter}')
    // The card is a real `<form>` with its submit inside it, so Enter costs nothing to support —
    // unlike the checkout, whose button is in another component and needed the `form` attribute.
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

// Keys ARE the English sentences and `fallbackLng` is false, so a key that drifted from its
// pt.json entry paints flawless English on the Portuguese screen with nothing red anywhere.
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Sign in to the panel')
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  },
}
