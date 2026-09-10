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

// Keys ARE the English copy, so a missing pt.json entry hides in reverse: it renders as fluent
// English with nothing to notice. Both languages, so neither direction is assumed.
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status').textContent).toBe('Loading…')
  },
}
