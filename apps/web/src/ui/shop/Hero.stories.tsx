import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { drawing, letter } from '../../fixtures/products'
import { Hero } from './Hero'

const meta = {
  component: Hero,
  title: 'Shop/Hero',
  args: { featured: letter, lang: 'pt' },
} satisfies Meta<typeof Hero>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 })

    // One sentence cut into three keys because the middle one is italic. There is no space between
    // the first two fragments: the <br> between them contributes no text. Pinning the whole string
    // is what proves all three are present, in order, with the cuts where they were designed.
    await expect(heading.textContent).toBe('Coisas que eufaço com as mãos, à venda de verdade.')
    // And this is what proves the <em> wraps exactly the middle fragment. The comma after it sits
    // outside — the extract is explicit about that, and it is the detail that moves silently the
    // first time someone re-cuts the sentence.
    await expect(heading.querySelector('em')?.textContent).toBe('faço com as mãos')

    await expect(canvas.getByRole('link', { name: 'Ver a peça em destaque' })).toHaveAttribute(
      'href',
      `/exhibit/${letter.slug}`,
    )

    // The photo's own alt, from the catalogue entry. The other half of this guard is
    // FeaturedPhotoWithoutAltText below: a hero that ALWAYS builds its own alt from the product
    // name passes that story and fails this one, and that is the version that would otherwise ship.
    await expect(canvas.getByRole('img')).toHaveAccessibleName(letter.photos[0]!.alt.pt)

    // The dangling edge, pinned. The rule between the two cells is the grid's own 1px gap showing
    // `bg-ink` through, NOT a border on the left cell: at this width the two look identical, and
    // only one of them stops existing when `auto-fit` collapses the band to a single column. Both
    // halves are asserted, because "no border here" is also true of a hero with no rule at all.
    const band = canvas.getByRole('heading', { level: 1 }).closest('section')
    if (!band?.firstElementChild) throw new Error('the hero rendered no cell around its heading')
    await expect(getComputedStyle(band).columnGap).toBe('1px')
    await expect(getComputedStyle(band.firstElementChild).borderRightWidth).toBe('0px')
  },
}

// The state the shop is in until someone flags a product: the API has no featured piece to send.
export const WithoutAFeaturedProduct: Story = {
  args: { featured: null },
  play: async ({ canvas }) => {
    // Nothing to point a call to action at. The only other destination on offer is the catalogue,
    // which is the next band of the same page — a link that scrolls the reader 600px down is not a
    // substitute for "go and look at this piece".
    await expect(canvas.queryByRole('link')).toBeNull()
    // The band keeps its two cells rather than growing a second layout for a state that lasts
    // until a checkbox is ticked: the photo cell holds the paper placeholder from spec:219.
    await expect(canvas.getByText('Ainda sem foto')).toBeInTheDocument()
  },
}

// `drawing` carries `alt: { pt: '', en: '' }` — the schema allows an empty string and the admin
// form does not force one, so this is a real catalogue state and not a contrived fixture. The hero
// photo is not inside a link and has no caption of its own, so an empty alt here would leave the
// largest thing on the page undescribed. `ProductCard` decides the opposite way, for the opposite
// reason, and says so.
export const FeaturedPhotoWithoutAltText: Story = {
  args: { featured: drawing },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img')).toHaveAccessibleName(`Foto de ${drawing.name.pt}`)
  },
}
