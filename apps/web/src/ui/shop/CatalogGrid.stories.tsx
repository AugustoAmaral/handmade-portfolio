import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { letter, products } from '../../fixtures/products'
import { CatalogGrid } from './CatalogGrid'

const meta = {
  component: CatalogGrid,
  title: 'Shop/CatalogGrid',
  args: { products, lang: 'pt' },
} satisfies Meta<typeof CatalogGrid>
export default meta
type Story = StoryObj<typeof meta>

export const FullCatalogue: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(products.length)
    await expect(canvas.getByText(`${products.length} peças`)).toBeInTheDocument()
  },
}

// The catalogue this shop opens with. "1 peças" is what the prototype prints, and what a single
// `{{count}}` key would print here — i18next's plural suffixes are not available, because
// `copy.test.ts` fails any pt.json key that no literal `t('…')` call site accounts for and a
// suffixed key is only ever reached through its base. Two keys and a condition instead.
export const OnePiece: Story = {
  args: { products: [letter] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('1 peça')).toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1)
  },
}

// A state the design does not have. It follows the empty drawer from Task 5: the message, and
// nothing that would be arithmetic about nothing.
export const Empty: Story = {
  args: { products: [] },
  play: async ({ canvas }) => {
    // getByText throws when the message is missing, which IS the assertion — an `expect` after it
    // could only ever pass.
    canvas.getByText('Nenhuma peça no catálogo ainda.')
    // Not an empty grid: a list that announces "list, 0 items" is a catalogue that failed to load.
    await expect(canvas.queryByRole('list')).toBeNull()
    // ...and no count over it.
    await expect(canvas.queryByText('0 peças')).toBeNull()
    // The section keeps its name, because that is the page's outline and not a decoration.
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe('O catálogo inteiro')
  },
}
