import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { NoticePage } from './NoticePage'
import { inShopShell } from './ShopShell.stories'

const meta = {
  component: NoticePage,
  title: 'Pages/NoticePage',
  decorators: [inShopShell],
  args: { kind: 'catalogue-unavailable', onRetry: fn() },
} satisfies Meta<typeof NoticePage>
export default meta
type Story = StoryObj<typeof meta>

// A shop that is DOWN, which until this component existed was indistinguishable from a shop with
// nothing to sell: the catalogue's own empty state painted "Nenhuma peça no catálogo ainda." over a
// failed request, and nothing anywhere said the difference.
export const CatalogueUnavailable: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const heading = canvas.getByRole('heading', { level: 1 })
    await expect(heading.textContent).toBe('Não consegui carregar o catálogo.')
    await expect(canvas.getByText('Algo quebrou do meu lado. Tente de novo em instantes.')).toBeInTheDocument()

    // No way out to the catalogue, because this IS the catalogue. A link back to the page the
    // reader is already on is not an escape, and it is the one destination this band cannot offer.
    await expect(canvas.queryByRole('link', { name: 'Ver o catálogo' })).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Tentar de novo' }))
    await expect(args.onRetry).toHaveBeenCalledTimes(1)
  },
}

export const ProductUnavailable: Story = {
  args: { kind: 'product-unavailable' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Não consegui carregar esta peça.')
    // Both ways out here, and they are different offers: ask again, or go somewhere that works.
    await expect(canvas.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
    await expect(canvas.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
  },
}

// The state `ProductRoute` used to render as a blank page. It is a separate `kind` from the one
// above rather than the same error with different odds: a 404 answers the same way however many
// times it is asked, so the retry is absent and the sentence says the piece is gone rather than
// that the shop is broken.
export const ProductNotFound: Story = {
  args: { kind: 'product-not-found', onRetry: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Essa peça não está no catálogo.')
    await expect(
      canvas.getByText('Pode ter sido vendida, ou o endereço está errado. O catálogo tem tudo que está à venda.'),
    ).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    await expect(canvas.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
  },
}

export const InEnglish: Story = {
  args: { kind: 'product-not-found', onRetry: undefined },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('This piece is not in the catalogue.')
    await expect(canvas.getByRole('link', { name: 'See the catalogue' })).toHaveAttribute('href', '/')
  },
}
