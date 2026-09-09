import { type ReactNode, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent } from 'storybook/test'

// These stories run the APP's own rule, not a copy of it. `interceptableAnchor` lives in
// `src/app/anchors.ts` and is imported by both `LinkInterceptor` at the app root and the
// `AnchorGuard` decorator in `.storybook/preview.tsx`, so this file is the only place the shipped
// rule meets a real browser — real modifier keys, a real `download` attribute, a real `mailto:` —
// instead of jsdom's approximation of one. `test/app/link-interceptor.test.tsx` pins the same rule
// in jsdom; break `anchors.ts` and the two go red together, which is the whole reason the rule is
// shared. Task 4 came within one review of shipping four differences between the two copies, and
// no test in either project could have seen a single one of them.
//
// The file sits beside the primitives because every real `<a href>` in the UI layer is rendered by
// one, and the trap the decorator exists to defuse — a `userEvent.click` on a live link navigating
// the vitest runner's own page out from under it — is sprung from a story file.
//
// The harness reads `defaultPrevented` in the BUBBLE phase, which is the ground truth of the whole
// feature: the guard runs in the capture phase, so by the time this handler sees the click the
// browser's decision has already been made, and this flag IS whether the page navigates.

type Outcome = 'intercepted' | 'fell through'

function Harness({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<string[]>([])
  return (
    <div
      className="flex flex-col items-start gap-2"
      onClick={(event) => {
        const label = event.target instanceof HTMLElement ? (event.target.textContent ?? '?') : '?'
        const outcome: Outcome = event.nativeEvent.defaultPrevented ? 'intercepted' : 'fell through'
        setLog((entries) => [...entries, `${label}=${outcome}`])
        // The net, and it is deliberate: a fall-through case really would navigate, and under the
        // vitest browser project navigating means the runner loses the page it is testing in — a
        // hang, not a red test. Recording the flag first and cancelling second keeps the failure
        // mode an assertion.
        event.preventDefault()
      }}
    >
      {children}
      <output data-testid="log" className="font-mono text-[11px]">
        {log.join(' | ')}
      </output>
    </div>
  )
}

const meta: Meta = { title: 'Storybook/Anchor guard' }
export default meta
type Story = StoryObj

const HREF = '/exhibit/carta-de-marina?from=story#specs'

export const SameOriginClickIsIntercepted: Story = {
  render: () => (
    <Harness>
      <a href={HREF} className="underline">
        same-origin
      </a>
    </Harness>
  ),
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'same-origin' })
    await userEvent.click(link)

    // The load-bearing half: the guard cancelled the click, which is what stops the navigation.
    await expect(canvas.getByTestId('log')).toHaveTextContent('same-origin=intercepted')
    // And the story is still the thing on screen — nothing replaced it.
    await expect(link).toBeInTheDocument()
  },
}

// Every case the browser owns, in one story. Each of these would be a bug if the guard swallowed
// it: cmd-click and "open in new tab" are how people open a second product, `download` is how a
// file is saved, and `mailto:` is the only way to reach Augusto in the whole design.
export const BrowserOwnedClicksFallThrough: Story = {
  render: () => (
    <Harness>
      <a href={HREF} className="underline">
        modifier
      </a>
      <a href={HREF} target="_blank" rel="noreferrer" className="underline">
        new-tab
      </a>
      <a href="/catalogo.pdf" download className="underline">
        download
      </a>
      <a href="https://example.com/shop" rel="noreferrer" className="underline">
        external
      </a>
      <a href="mailto:contato@augustoamaral.com" className="underline">
        mailto
      </a>
    </Harness>
  ),
  play: async ({ canvas }) => {
    // A session rather than the bare `userEvent.click`: the direct API resets keyboard state
    // between calls, so the held Meta key has to live in one session to reach the click.
    const user = userEvent.setup()
    await user.keyboard('{Meta>}')
    await user.click(canvas.getByRole('link', { name: 'modifier' }))
    await user.keyboard('{/Meta}')

    for (const name of ['new-tab', 'download', 'external', 'mailto']) {
      await user.click(canvas.getByRole('link', { name }))
    }

    await expect(canvas.getByTestId('log')).toHaveTextContent(
      'modifier=fell through | new-tab=fell through | download=fell through | external=fell through | mailto=fell through',
    )
  },
}
