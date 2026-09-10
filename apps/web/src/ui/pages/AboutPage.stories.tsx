import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { letter } from '../../fixtures/products'
import { AboutPage } from './AboutPage'
import { inShopShell } from './ShopShell.stories'

const CONTACT = 'contato@augustoamaral.com'
// The portrait has no fixture — spec:219 makes it a static file that does not exist yet — so the
// story borrows a real catalogue photo rather than inventing a url.
const PORTRAIT = { url: letter.photos[0]!.url, alt: 'Augusto na bancada, escrevendo' }

const meta = {
  component: AboutPage,
  title: 'Pages/AboutPage',
  decorators: [inShopShell],
  args: { contactEmail: CONTACT },
} satisfies Meta<typeof AboutPage>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    // FIVE headings, all at h2 under one h1 — the deepest outline on this branch and the one Task 8
    // was protecting when it refused to promote the blocks' numbered tags. Promoting them puts
    // eight headings here, and `heading-order` reddens on this page while every component story
    // it is built from stays green.
    await expect(canvas.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H1', 'H2', 'H2', 'H2', 'H2'])
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe(
      'Uma loja de quatro peças, escrita à mão nos dois sentidos.',
    )

    // The facts band contributes no heading: a number over a label is a value, not a section. Four
    // of them, as `<dt>`/`<dd>` pairs.
    await expect(canvas.getAllByRole('definition')).toHaveLength(4)

    // Both ways out, and both real. The prototype has `href="#"` on one and a `<span onClick>` on
    // the other, so neither can be middle-clicked, copied or reached by Tab.
    await expect(canvas.getByRole('link', { name: 'Falar comigo' }).getAttribute('href')).toContain(
      `mailto:${CONTACT}`,
    )
    await expect(canvas.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
    await expect(canvas.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/')

    // No photograph yet.
    await expect(canvas.getByText('Ainda sem foto')).toBeInTheDocument()
  },
}

export const WithAPortrait: Story = {
  args: { portrait: PORTRAIT },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img')).toHaveAccessibleName(PORTRAIT.alt)
    await expect(canvas.queryByText('Ainda sem foto')).toBeNull()
    // The rest of the page is unchanged by it — a portrait is not a layout.
    await expect(canvas.getAllByRole('heading')).toHaveLength(5)
  },
}
