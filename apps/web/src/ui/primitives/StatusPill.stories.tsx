import { ORDER_STATUSES } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { StatusPill } from './StatusPill'

// `status` is a required prop, so `StoryObj<typeof meta>` demands `args` on EVERY story —
// including a gallery story that renders its own tree and never reads them. Declaring the
// default here is what makes story-level `args` optional, so `EveryStatus` can be render-only.
const meta = {
  component: StatusPill,
  title: 'Primitives/StatusPill',
  args: { status: 'pending' },
} satisfies Meta<typeof StatusPill>
export default meta
type Story = StoryObj<typeof meta>

export const Paid: Story = {
  args: { status: 'paid' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Em produção')).toBeInTheDocument()
  },
}

export const EveryStatus: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUSES.map((status) => (
        <StatusPill key={status} status={status} />
      ))}
    </div>
  ),
}

// The only story in the suite that runs the preview's SECOND i18n instance. `preview.tsx` ships a
// pt/en toolbar and `initialGlobals: { locale: 'pt' }`, and every play assertion on the branch pins
// a pt-BR literal — so without this the English path (a per-language memoised instance, not a
// `changeLanguage` call) is executed by nothing in CI, and the first developer to flip the toolbar
// is the one who finds out. StatusPill is where it belongs: its labels are the whole component.
//
// In English the key IS the copy: `pt.json` is never consulted and `t('In production')` returns
// the key itself. One assertion, and it is the whole contract — the same query on the pt default
// finds 'Em produção' and throws, which is what makes it about the locale rather than about the
// label. A second, negative "and 'Em produção' is gone" line would read well and could never fail:
// the query above it has already decided it.
export const PaidInEnglish: Story = {
  args: { status: 'paid' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('In production')).toBeInTheDocument()
  },
}
