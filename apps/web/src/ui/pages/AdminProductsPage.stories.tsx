import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { drawing, inactiveGuide, letter, products } from '../../fixtures/products'
import { AdminProductsPage } from './AdminProductsPage'
import { inAdminShell } from './AdminShell.stories'

/**
 * FIVE PRODUCTS, FOUR OF THEM ACTIVE — the same shape the design's own seed has, reached by adding
 * the inactive guide to the shop's catalogue rather than by typing a list here. The summary's two
 * numbers are read off this list in every assertion below, so a page that counted rows instead of
 * products, or `length` instead of the active ones, has nowhere to hide.
 */
const CATALOGUE = [...products, inactiveGuide]

const TABLE = {
  onToggleActive: fn(),
  onAskDelete: fn(),
  onCancelDelete: fn(),
  onConfirmDelete: fn(),
}

const meta = {
  component: AdminProductsPage,
  title: 'Pages/AdminProductsPage',
  decorators: [inAdminShell('products')],
  args: { products: CATALOGUE, lang: 'pt', table: TABLE },
} satisfies Meta<typeof AdminProductsPage>
export default meta
type Story = StoryObj<typeof meta>

export const Catalogue: Story = {
  play: async ({ canvas }) => {
    // ONE HEADING, AND IT IS THE PAGE'S. `ProductsTable` deliberately brings none — its name is a
    // visually hidden `<caption>` — so this band is the whole outline and `heading-order` cannot
    // fire on this screen at all. Asserting the level is the only thing that would notice an
    // `<h1>` quietly becoming a styled `<div>`.
    const headings = canvas.getAllByRole('heading')
    await expect(headings.map((h) => h.tagName)).toEqual(['H1'])
    await expect(headings[0]!.textContent).toBe('Produtos')

    // The design's `5 cadastrados · 4 ativos · 1 digitais`, minus the third stat and with both
    // singulars that its template cannot express. Equality and not a substring: `toHaveTextContent`
    // matches by SUBSTRING and would be satisfied by `15 cadastrados`.
    await expect(canvas.getByText(/cadastrados/).textContent).toBe('5 cadastrados · 4 ativos')

    await expect(canvas.getByRole('link', { name: 'Novo produto' })).toHaveAttribute(
      'href',
      '/admin/products/new',
    )

    // Header row plus one per product. The table is rendered with the list this page was handed,
    // in the order it was handed it.
    await expect(canvas.getAllByRole('row')).toHaveLength(CATALOGUE.length + 1)
    await expect(canvas.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(
      CATALOGUE.map((product) => `${product.name.pt}${product.name.en} · ${product.slug}`),
    )

    // THE LIVE REGION IS MOUNTED AND EMPTY. A region that arrives already holding its message is
    // the version screen readers stay silent about, so the result of a delete can only be
    // announced by a region that was on the page before it happened.
    await expect(canvas.getByRole('status').textContent).toBe('')
  },
}

/**
 * THE SINGULAR THE DESIGN CANNOT EXPRESS. Its template is `n + " cadastrados"` with no branch, so a
 * one-product shop reads `1 cadastrados` — the same defect as its `1 digitais` and its `1 itens`.
 * i18next's plural suffixes are structurally unavailable here (`copy.test.ts` rejects a
 * `_one`/`_other` key, because no literal call site names it), so the branch's idiom is two keys and
 * a condition, and this story is the only place either singular is ever rendered.
 */
export const OneProduct: Story = {
  args: { products: [letter] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/cadastrado/).textContent).toBe('1 cadastrado · 1 ativo')
  },
}

/**
 * NO PRODUCTS, WHICH IS NOT THE SAME SCREEN AS A PANEL THAT COULD NOT LOAD THEM — see the story
 * below. The summary goes with the table: `0 cadastrados · 0 ativos` over "nenhum produto ainda" is
 * arithmetic about nothing, the call `HomePage` already made for the empty catalogue.
 */
export const NoProductsYet: Story = {
  args: { products: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Nenhum produto ainda.')).toBeInTheDocument()
    await expect(canvas.queryByText(/cadastrados/)).toBeNull()
    await expect(canvas.queryAllByRole('row')).toHaveLength(0)
    // The way out stays: this is the one control that changes the state being described.
    await expect(canvas.getByRole('link', { name: 'Novo produto' })).toBeInTheDocument()
  },
}

/**
 * THE FAILURE THE SHOP ALREADY PAID FOR ONCE. Handed `[]` on a failed request, this screen would
 * render "nenhum produto ainda" — a panel that is down and a shop with nothing in it, identical,
 * which is the exact defect `NoticePage` was written for on the storefront.
 *
 * `NoticePage` ITSELF IS NOT REUSED, and that is a decision. Its three kinds are shop facts, its
 * body talks about the catalogue, and its way out is `routes.home()` — the storefront, which for a
 * panel that nothing links back to is a one-way door. So the band stays, the nav stays, and only
 * the body says it failed.
 */
export const CouldNotLoadTheProducts: Story = {
  args: { loadFailed: true, onRetry: fn() },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Algo quebrou do meu lado. Tente de novo em instantes.')
    // The line that makes this a different screen from the one above.
    await expect(canvas.queryByText('Nenhum produto ainda.')).toBeNull()
    await expect(canvas.queryAllByRole('row')).toHaveLength(0)
    await expect(canvas.queryByText(/cadastrados/)).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Tentar de novo' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/**
 * A DELETE LEAVES NOTHING BEHIND TO READ. The row is gone, and with it the button that was focused
 * when it was pressed — the extract lists `aria-live` among the things the design has nowhere at
 * all, and a destructive action whose only feedback is a row that vanished is where it is most
 * missed.
 */
export const AnnouncesADelete: Story = {
  args: { result: 'deleted' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status').textContent).toBe('Produto apagado.')
  },
}

// Same slot, same region. A failure after a delete is not more urgent than the delete itself, and a
// region already on the page announces reliably where an `alert` mounted with its content does not.
export const ADeleteThatFailed: Story = {
  args: { result: 'delete-failed' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status').textContent).toBe(
      'Algo quebrou do meu lado. Tente de novo em instantes.',
    )
    // Still the whole table: nothing was deleted, so nothing is missing.
    await expect(canvas.getAllByRole('row')).toHaveLength(CATALOGUE.length + 1)
  },
}

// One row waiting for its second press, and the other four untouched — the page passes the id
// straight down, and this is the only place the pairing of page and table is checked.
export const ConfirmingOneDelete: Story = {
  args: { table: { ...TABLE, confirmingDeleteId: drawing.id } },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('Apagar de vez?')).toHaveLength(1)
    await expect(canvas.getByRole('button', { name: `Sim, apagar ${drawing.name.pt}` })).toBeInTheDocument()
  },
}

export const InEnglish: Story = {
  globals: { locale: 'en' },
  args: { lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Products')
    await expect(canvas.getByText(/registered/).textContent).toBe('5 registered · 4 active')
    await expect(canvas.getByRole('link', { name: 'New product' })).toBeInTheDocument()
  },
}
