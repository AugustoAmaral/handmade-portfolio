import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { LangToggle } from './LangToggle'

const meta = {
  component: LangToggle,
  title: 'Primitives/LangToggle',
  args: { lang: 'pt', onToggle: fn() },
} satisfies Meta<typeof LangToggle>
export default meta
type Story = StoryObj<typeof meta>

// Queried by the TRANSLATED accessible name, which is the assertion that matters: the name used
// to be a hardcoded "Switch to EN" and a Portuguese reader heard English. Finding the button by
// its pt-BR name fails if the translation regresses or the key is dropped from pt.json.
export const FromPortuguese: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mudar para inglês' }))
    await expect(args.onToggle).toHaveBeenCalledTimes(1)
  },
}

// The visible affordance stays the bare two-letter code even though the accessible name is a
// full sentence — the code is the target language, not a word to translate.
export const FromEnglish: Story = {
  args: { lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Mudar para português' })).toHaveTextContent('pt')
  },
}
