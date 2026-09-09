import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { letter, products } from '../../fixtures/products'
import { HomePage } from './HomePage'
import { inShopShell } from './ShopShell.stories'

const CONTACT = 'contato@augustoamaral.com'

const meta = {
  component: HomePage,
  title: 'Pages/HomePage',
  // Every page story is the whole screen: header, page, drawer. See the note on `inShopShell`.
  decorators: [inShopShell],
  args: { products, featured: letter, lang: 'pt', contactEmail: CONTACT },
} satisfies Meta<typeof HomePage>
export default meta
type Story = StoryObj<typeof meta>

export const FullCatalogue: Story = {
  play: async ({ canvas }) => {
    // The outline the whole page composes to, in one assertion, and the first three-heading
    // document on this branch — which is what makes `heading-order` capable of firing here at all.
    // Levels rather than text: the text belongs to the three component stories, the ORDER belongs
    // to this file, and it is the only thing composition can get wrong.
    await expect(canvas.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H1', 'H2', 'H2'])
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe(
      'Coisas que eufaço com as mãos, à venda de verdade.',
    )

    // Four fixtures, four cards. `products` is the catalogue in catalogue order, so a page that
    // dropped one or reordered them would be visible here rather than in the grid's own story,
    // which renders whatever list it is handed.
    await expect(canvas.getAllByRole('listitem')).toHaveLength(products.length)
    await expect(canvas.getByText('4 peças')).toBeInTheDocument()

    // The hero's call to action points at the featured piece, and the closing band's mail link is
    // built from the address this page was given — two props whose only job is to reach a href.
    await expect(canvas.getByRole('link', { name: 'Ver a peça em destaque' })).toHaveAttribute(
      'href',
      `/exhibit/${letter.slug}`,
    )
    await expect(canvas.getByRole('link', { name: 'me manda uma mensagem' }).getAttribute('href')).toContain(
      `mailto:${CONTACT}`,
    )
  },
}

// A shop with nothing in it: no products and nothing flagged featured. Both bands designed the
// state rather than transcribing it (the prototype has neither), and the page is where the two
// meet — a hero with no destination over a catalogue with no grid.
export const EmptyCatalogue: Story = {
  args: { products: [], featured: null },
  play: async ({ canvas }) => {
    canvas.getByText('Nenhuma peça no catálogo ainda.')

    // No grid at all rather than an empty one: a list that announces "list, 0 items" describes a
    // grid that failed to load, not a shop with nothing in it.
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0)
    await expect(canvas.queryByRole('list')).toBeNull()
    // The count goes with the grid — "0 peças" over "nothing here yet" is arithmetic about nothing.
    await expect(canvas.queryByText('0 peças')).toBeNull()
    // And the hero loses its call to action, because the only destination left is this same page.
    await expect(canvas.queryByRole('link', { name: 'Ver a peça em destaque' })).toBeNull()

    // The outline does NOT lose a heading: the catalogue section keeps its name even with nothing
    // under it, so the page's shape is the same when it is empty as when it is full.
    await expect(canvas.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H1', 'H2', 'H2'])
  },
}

// The whole screen in English, which is where a missing pt.json entry hides in reverse: keys ARE
// the English copy, so an untranslated key renders as fluent English with no warning anywhere.
export const InEnglish: Story = {
  args: { lang: 'en' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe(
      'Things Imake with my hands, actually for sale.',
    )
    await expect(canvas.getByText('4 pieces')).toBeInTheDocument()
    // The catalogue data follows `lang`, not the copy instance: the two are separate props on
    // purpose, and a page that passed one and not the other renders English chrome over Portuguese
    // product names.
    // Twice: once on the card over the hero photo and once in the catalogue grid. The count is the
    // assertion — the featured piece is also a piece, and a hero that stopped rendering its card
    // would still leave one of these behind.
    await expect(canvas.getAllByText(letter.name.en)).toHaveLength(2)
  },
}
