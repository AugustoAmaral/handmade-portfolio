import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { LoadingPage } from './LoadingPage'
import { inShopShell } from './ShopShell.stories'

const meta = {
  component: LoadingPage,
  title: 'Pages/LoadingPage',
  decorators: [inShopShell],
} satisfies Meta<typeof LoadingPage>
export default meta
type Story = StoryObj<typeof meta>

export const Waiting: Story = {
  play: async ({ canvas }) => {
    // The role is the assertion, not the text: a paragraph that reads "Carregando…" and announces
    // itself as nothing is what this component would be without it, and it would look identical.
    const status = canvas.getByRole('status')
    await expect(status.textContent).toBe('Carregando…')

    // No heading, on purpose. The page arriving behind this one owns the outline; a transient
    // `<h1>` here would make the document's shape change under a reader who landed mid-fetch.
    // The shell contributes none either, so an empty list is the whole document's answer.
    await expect(canvas.queryAllByRole('heading')).toHaveLength(0)
  },
}

/**
 * THE PANEL'S GUTTER IS NOT THE SHOP'S, and this component is rendered by both. `--spacing-gutter`
 * reaches 64px and `--spacing-gutter-admin` stops at 40, so a loading line that used the shop's
 * inside the panel started 24px further in than the band replacing it and the page stepped sideways
 * as it loaded.
 *
 * MEASURED, NOT ASSERTED BY CLASS NAME. `px-gutter-admin` compiles to nothing at all if its token
 * is missing from `@theme` — no error, no warning — which is exactly what a `toHaveClass` check
 * cannot see. The two are compared to each other rather than to a magic number: the clamps are
 * viewport-dependent and only their ORDER is a fact about the design.
 */
export const InThePanel: Story = {
  args: { surface: 'admin' },
  play: async ({ canvas, canvasElement }) => {
    const admin = parseFloat(getComputedStyle(canvas.getByRole('status')).paddingLeft)

    // A probe carrying the SHOP's utility, measured at this same viewport, which is what makes the
    // comparison a fact about the two tokens rather than about the window. Relational and not a
    // magic number: both are `clamp()`s, so the only stable truth is that the panel's is narrower.
    const probe = document.createElement('div')
    probe.className = 'px-gutter'
    canvasElement.append(probe)
    const shop = parseFloat(getComputedStyle(probe).paddingLeft)
    probe.remove()

    await expect(admin).toBeGreaterThan(0)
    await expect(admin).toBeLessThan(shop)
  },
}

// Keys ARE the English copy, so a missing pt.json entry hides in reverse: it renders as fluent
// English with nothing to notice. Both languages, so neither direction is assumed.
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status').textContent).toBe('Loading…')
  },
}
