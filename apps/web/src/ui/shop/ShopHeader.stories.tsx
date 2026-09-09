import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { ShopHeader } from './ShopHeader'

const meta = {
  component: ShopHeader,
  title: 'Shop/ShopHeader',
  args: { cartCount: 0, lang: 'pt', onOpenCart: fn(), onToggleLang: fn() },
} satisfies Meta<typeof ShopHeader>
export default meta
type Story = StoryObj<typeof meta>

export const OpensTheBag: Story = {
  args: { cartCount: 2 },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /sacola/i }))
    await expect(args.onOpenCart).toHaveBeenCalledOnce()
  },
}

// The count is IN the name, so this is the assertion that the bag announces itself as full. The
// query finds the button by a name fragment and the assertion pins the whole string: a `getByRole`
// with the exact name would be its own answer, and `toHaveTextContent` would be satisfied by
// "Sacola" alone, since it matches on substring.
export const BagButtonNamesItsCount: Story = {
  args: { cartCount: 3 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /sacola/i }).textContent).toBe('Sacola (3)')
  },
}

export const AboutIsAnAnchorNotAButton: Story = {
  play: async ({ canvas }) => {
    // The whole navigation design rests on this: real hrefs, upgraded by LinkInterceptor.
    // A <button onClick> here would still "work" in the app and break cmd-click, crawling
    // and the middle-click that AnchorGuard.stories.tsx pins.
    await expect(canvas.getByRole('link', { name: /sobre/i })).toHaveAttribute('href', '/about')
  },
}

// Two things at once, and the query is half of it: with `lang` hardcoded or dropped on the way to
// LangToggle, the button would be named "Mudar para português" and this would not find it. What
// the toggle SHOWS is the target language, so the header passing the current one is the contract.
export const TogglesTheLanguage: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mudar para inglês' }))
    await expect(args.onToggleLang).toHaveBeenCalledOnce()
  },
}

// The only proof the gutter token exists. `px-gutter` compiles to nothing at all when
// `--spacing-gutter` is missing from `@theme` — no build error, no console warning, just a header
// whose content runs into the edge of the window. The floor of the clamp is asserted rather than a
// value, because 5vw resolves against whatever viewport the runner opened.
export const UsesTheGutterToken: Story = {
  play: async ({ canvas }) => {
    const header = canvas.getByRole('banner')
    await expect(parseFloat(getComputedStyle(header).paddingLeft)).toBeGreaterThanOrEqual(20)
  },
}
