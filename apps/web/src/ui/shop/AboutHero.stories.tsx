import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { letter } from '../../fixtures/products'
import { AboutHero } from './AboutHero'

// The portrait is not catalogue data and has no fixture of its own — spec:219 makes it a static
// file that does not exist yet. Borrowing a real catalogue photo is closer to the truth than an
// invented url: it is a url and an alt string that some part of this app really produces.
const PORTRAIT = { url: letter.photos[0]!.url, alt: 'Augusto na bancada, escrevendo' }

const meta = { component: AboutHero, title: 'Shop/AboutHero' } satisfies Meta<typeof AboutHero>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 })

    // One sentence cut into three keys because the middle clause is italic. Pinning the whole
    // string proves all three are present, in order, with the spaces the cuts need — a fragment
    // rendered without the space around the `<em>` reads `peças,escrita à mão` and no
    // per-fragment assertion would see it.
    await expect(heading.textContent).toBe('Uma loja de quatro peças, escrita à mão nos dois sentidos.')
    // And this is what proves the `<em>` wraps exactly the middle fragment. The comma is OUTSIDE
    // it and BEFORE it, which is the mirror image of the home hero's cut.
    await expect(heading.querySelector('em')?.textContent).toBe('escrita à mão')

    // The dangling edge, pinned exactly as `Hero`'s story pins it: the rule between the two cells
    // is the grid's own 1px gap showing `bg-ink` through, NOT a border on the left cell. At this
    // width the two are indistinguishable, and only one of them stops existing when `auto-fit`
    // collapses the band to a single column. Both halves are asserted, because "no border here" is
    // also true of a band with no rule at all.
    const band = heading.closest('section')
    if (!band?.firstElementChild) throw new Error('the about hero rendered no cell around its heading')
    await expect(getComputedStyle(band).columnGap).toBe('1px')
    await expect(getComputedStyle(band.firstElementChild).borderRightWidth).toBe('0px')

    // No photograph yet, so the paper placeholder from spec:219 — and no `<img>` to describe.
    await expect(canvas.getByText('Ainda sem foto')).toBeInTheDocument()
    await expect(canvas.queryByRole('img')).toBeNull()
  },
}

// The five measured differences from `Hero`, in one place, because the risk this component exists
// to avoid is someone later noticing the two look alike and merging them behind a flag. Read off
// the computed style rather than the class string: a Tailwind arbitrary value that never made it
// into the stylesheet leaves the class attribute looking perfect.
export const DiffersFromTheHomeHero: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 })
    const band = heading.closest('section')
    if (!band) throw new Error('the about hero rendered no band around its heading')
    const copy = band.firstElementChild
    const photo = band.lastElementChild
    if (!copy || !photo || copy === photo) throw new Error('the about hero rendered fewer than two cells')

    // Track floor 300px, not the home hero's 320. This one is read off the class string and not
    // off the computed grid on purpose: `auto-fit` resolves both floors to the same two equal
    // tracks at every width except the 40px band between them, so the computed value cannot tell
    // them apart. The `gap-px` assertion in `Default` is what proves this class string is live.
    await expect(band.className).toContain('minmax(300px,1fr)')
    // justify-center at 22px, not justify-between at 40px.
    await expect(getComputedStyle(copy).justifyContent).toBe('center')
    await expect(getComputedStyle(copy).rowGap).toBe('22px')
    // line-height exactly 1, not the home hero's 0.98. Computed, because a `leading-none` that
    // never reached the stylesheet leaves the class attribute looking perfect.
    const { fontSize, lineHeight } = getComputedStyle(heading)
    await expect(lineHeight).toBe(fontSize)
    // min(56vh,460px), not min(66vh,540px). Resolved against the runner's own viewport rather than
    // against a literal, which is the only way this discriminates at every window size.
    await expect(parseFloat(getComputedStyle(photo).minHeight)).toBeCloseTo(
      Math.min(0.56 * window.innerHeight, 460),
      0,
    )
    // And the fifth difference: no card over the photograph. That one belongs to the home hero.
    await expect(canvas.queryByText('Em destaque')).toBeNull()
  },
}

export const WithAPortrait: Story = {
  args: { portrait: PORTRAIT },
  play: async ({ canvas }) => {
    // The alt travels with the url, so the photograph is described by whoever supplied it. A
    // component that built its own alt from a constant would pass a `toBeInTheDocument` here and
    // describe every future portrait as the same thing.
    await expect(canvas.getByRole('img')).toHaveAccessibleName(PORTRAIT.alt)
    await expect(canvas.queryByText('Ainda sem foto')).toBeNull()
  },
}

// Nine keys' worth of copy, and English is where a missing pt.json entry hides: with
// `fallbackLng: false` and the key as the English sentence, an untranslated key renders as
// perfectly formed English with no warning anywhere. `Default` catches that going one way; this
// catches a call site whose key text drifted from the entry it was added with.
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe(
      'A shop of four pieces, written by hand in both senses.',
    )
    await expect(canvas.getByText('About')).toBeInTheDocument()
  },
}
