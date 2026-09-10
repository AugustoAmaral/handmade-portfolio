import type { Meta, StoryObj } from '@storybook/react-vite'
import { useTranslation } from 'react-i18next'
import { expect } from 'storybook/test'
import { BackBar, CatalogBackBar } from './BackBar'

const meta = { component: CatalogBackBar, title: 'Shop/BackBar' } satisfies Meta<typeof CatalogBackBar>
export default meta
type Story = StoryObj<typeof meta>

export const Catalogue: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link')

    // A real destination, which the prototype's `<span onClick>` does not have. This is the
    // property the whole navigation design rests on: cmd-click, middle-click and a crawler all
    // work, and `LinkInterceptor` upgrades the plain click at the app root.
    await expect(link).toHaveAttribute('href', '/')
    // The arrow is on screen and OUT of the accessible name. Both halves matter and they fail
    // separately: dropping `aria-hidden` leaves the name as "← Catálogo", and dropping the arrow
    // leaves a back link that does not look like one.
    await expect(link).toHaveAccessibleName('Catálogo')
    await expect(link.textContent).toBe('← Catálogo')

    // Not a landmark. A second unnamed <nav> beside the header's is exactly what makes axe's
    // `landmark-unique` fire, and a strip holding one link has no business in the rotor anyway.
    await expect(canvas.queryByRole('navigation')).toBeNull()
  },
}

// The opacity is on the text, not on the strip. The prototype dims the whole bar, which takes the
// 1px rule under it down to 70% ink immediately above the full-ink rule of the band below —
// element opacity dimming a border, not a decision anyone made.
export const TheRuleIsFullInk: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link')
    const bar = link.parentElement
    if (!bar) throw new Error('the back bar rendered no strip around its link')

    await expect(getComputedStyle(bar).opacity).toBe('1')
    await expect(parseFloat(getComputedStyle(link).opacity)).toBeCloseTo(0.7, 2)
    await expect(getComputedStyle(bar).borderBottomWidth).toBe('1px')
  },
}

// The strip itself, with the checkout's two items in it — the third place the prototype paints
// this bar, and the reason the container and the `← Catálogo` link are two exports rather than
// one. The left item there is a button (it opens the drawer, it does not navigate), so a
// component that hardcoded an anchor could not serve it.
export const WithTwoItems: Story = {
  // The copy goes through `t()` rather than being typed in Portuguese here. `copy.test.ts` scans
  // stories on purpose — a hardcoded pt-BR sentence in a story reads as approved copy on the docs
  // page and gets pasted into a component, with nothing checking it against pt.json.
  render: function TwoItems() {
    const { t } = useTranslation()
    return (
      <BackBar>
        <button type="button" className="opacity-70">
          <span aria-hidden="true">←</span> {t('Back to the bag')}
        </button>
        <span className="opacity-65">{t('Secure payment via Stripe')}</span>
      </BackBar>
    )
  },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole('button').parentElement
    if (!bar) throw new Error('the back bar rendered no strip around its children')
    // Ends apart, which is the whole layout: one item goes left, the other right. With a single
    // child `justify-between` is indistinguishable from `flex-start`, so `Catalogue` above could
    // never have caught this.
    await expect(getComputedStyle(bar).justifyContent).toBe('space-between')
  },
}
