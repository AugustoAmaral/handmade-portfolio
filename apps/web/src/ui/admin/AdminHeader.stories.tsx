import { SHOP_NAME } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { AdminHeader } from './AdminHeader'
import { type Rgba, measure, parseColor } from '../../../.storybook/contrast'

// Every ratio in this file has to survive an ALPHA, because the bar states its hierarchy in
// `opacity` and its underline in `paper/40` — a ratio taken from the declared colour of a
// 50%-opacity span is the ratio of a colour nobody can see. `measure` handles both.
//
// The surface for `Sair`'s ring resolves to the bar's `bg-ink` either way: the button paints no
// background of its own, so starting the walk at the element already reaches the bar. That is why
// this file was never wrong, and why the correction PR 4 Task 3 had to make to `surfaceBehind`
// does not move a single number here.

// The arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch that has
// to assert a ratio for itself. It was six copies until PR 4 Task 3, and by then they had
// diverged; the note at the top of that file records what the divergence was and what it cost.

const INK: Rgba = { r: 26, g: 23, b: 19, a: 1 }

const meta = {
  component: AdminHeader,
  title: 'Admin/AdminHeader',
  args: { signedIn: true, onSignOut: fn() },
  // Presentation, and MEASURED not to be more than that. The plan said every story here had to
  // paint ink or axe would measure the bar's text against the paper canvas and report both sides
  // inverted; removing this decorator leaves all eight stories green, because the bar paints its
  // own opaque `bg-ink` and axe resolves a background from the element's own ancestor chain — it
  // never reaches the canvas. It stays because the preview's global decorator is cream and a dark
  // strip floating in a cream box is not what this component is.
  //
  // It also cuts the other way, which is why `PaintsItselfOnInk` exists: with ink painted behind,
  // losing `bg-ink` from the bar itself is invisible to axe AND to the contrast helper above, and
  // that background is load-bearing — a sticky bar with a see-through one smears the page
  // scrolling under it. Only the explicit assertion catches it.
  decorators: [
    (Story) => (
      <div className="bg-ink">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminHeader>
export default meta
type Story = StoryObj<typeof meta>

export const SignedIn: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '/admin/products')
    await expect(canvas.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/admin/orders')
    // The arrow is decoration and is kept out of the name, so this is an equality and not a match:
    // `getByRole` with a regex would pass on "Ver a loja ↗" and that is the string being ruled out.
    await expect(canvas.getByRole('link', { name: /ver a loja/i }).textContent).toBe('Ver a loja ↗')
    await expect(canvas.getByRole('link', { name: 'Ver a loja' })).toHaveAttribute('href', '/')
  },
}

// The signed-out bar, which the design has no concept of because it has no concept of a session.
// The two section links would land on the login they were clicked from, and there is nothing to
// sign out of, so both are gone and the way to the shop stays.
export const SignedOut: Story = {
  args: { signedIn: false },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link', { name: 'Produtos' })).toBeNull()
    await expect(canvas.queryByRole('link', { name: 'Pedidos' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Sair' })).toBeNull()
    await expect(canvas.getByRole('link', { name: 'Ver a loja' })).toBeInTheDocument()
  },
}

// Nothing in the prototype says which of the two screens you are on. Both halves of the fix are
// here, and the second one is why the first is not enough: `aria-current` is invisible, and a
// current state carried only by how light the underline is fails anyone who cannot see the
// difference between 100% paper and 40%. The width is the non-colour half.
export const MarksTheCurrentSection: Story = {
  args: { current: 'orders' },
  play: async ({ canvas }) => {
    const products = canvas.getByRole('link', { name: 'Produtos' })
    const orders = canvas.getByRole('link', { name: 'Pedidos' })

    await expect(orders).toHaveAttribute('aria-current', 'page')
    await expect(products).not.toHaveAttribute('aria-current')

    const widthOf = (element: Element) => parseFloat(getComputedStyle(element).borderBottomWidth)
    await expect(widthOf(orders)).toBeGreaterThan(widthOf(products))
  },
}

/**
 * THE SAME BRAND AS THE SHOP'S BAR, from the same constant, and NOT a link — which is the pair of
 * facts this story exists for. The two bars each used to declare their own `SHOP_NAME` and nothing
 * read either one, so a drift between them was invisible; and the panel is unlinked from the shop
 * (spec:11), so a brand that navigated would be a second unlabelled door to the place `Ver a loja`
 * already goes.
 */
export const TheBrandIsNotALink: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(SHOP_NAME)).toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: SHOP_NAME })).toBeNull()
  },
}

export const SignsOut: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Sair' }))
    await expect(args.onSignOut).toHaveBeenCalledOnce()
  },
}

/**
 * Two things a missing utility breaks in silence. `px-gutter-admin` compiles to nothing at all if
 * `--spacing-gutter-admin` is absent from `@theme` — no error, no warning, a bar whose content
 * touches the edge of the window — and `bg-ink` is what stops the page showing through a bar that
 * is `position: sticky` over it.
 *
 * The padding is asserted as a RANGE and not a value, because `4vw` resolves against whatever
 * viewport the runner opened. The range is what makes it a real assertion: 0 fails the floor when
 * the token is gone, and the shop's `--spacing-gutter` fails the ceiling at any width where 5vw is
 * past 40px — which is the mistake this decision exists to prevent, since the two utilities differ
 * by one word and the wrong one looks fine on its own.
 */
export const PaintsItselfOnInk: Story = {
  play: async ({ canvas }) => {
    const bar = canvas.getByRole('banner')
    await expect(parseColor(getComputedStyle(bar).backgroundColor)).toEqual(INK)

    const padding = parseFloat(getComputedStyle(bar).paddingLeft)
    await expect(padding).toBeGreaterThanOrEqual(16)
    await expect(padding).toBeLessThanOrEqual(40)
  },
}

/**
 * THE MEASUREMENT THIS COMPONENT EXISTS TO GET RIGHT, taken in the browser rather than inherited.
 *
 * Every muted value in the bar is paper over ink, and the branch's rule for muted text — below
 * `opacity-65` it does not clear AA — was measured on ink over PAPER, where it is true. Here it is
 * the wrong way round: 50% measures ~4.8:1 and 60% ~6.3:1 against the same 4.5 floor. So the
 * assertion is two-sided on purpose. The ratio proves the prototype's opacities are legible; the
 * equality proves nobody raised them anyway, which is what applying the paper rule by reflex looks
 * like and which no contrast assertion on its own would ever complain about.
 *
 * The underline is the one value that genuinely failed: `rgba(244,240,230,.35)` is 2.98:1 against
 * ink, two hundredths under the 3:1 SC 1.4.11 asks of a graphical object. axe has no rule for
 * non-text contrast, so this line is the entire gate on it.
 */
export const MeasuresItsMutedTextOnInk: Story = {
  play: async ({ canvas }) => {
    const panel = canvas.getByText('Painel')
    await expect(getComputedStyle(panel).opacity).toBe('0.5')
    await expect(measure(panel, 'color')).toBeGreaterThanOrEqual(4.5)

    const shop = canvas.getByRole('link', { name: 'Ver a loja' })
    await expect(getComputedStyle(shop).opacity).toBe('0.6')
    await expect(measure(shop, 'color')).toBeGreaterThanOrEqual(4.5)

    await expect(measure(canvas.getByRole('link', { name: 'Produtos' }), 'borderBottomColor')).toBeGreaterThanOrEqual(3)
  },
}

/**
 * The other half of the inversion, and it is not in the plan: `TextInput`'s focus ring is accent,
 * which is 5.58:1 on paper and **2.81:1 on ink** — under the 3:1 SC 2.4.11 wants of a focus
 * indicator. Reusing it here would have been the same reflex as lightening `Painel`, in the
 * opposite direction and with a real failure at the end of it.
 *
 * `Sair` is the element measured because it is the worst case: it carries `opacity-60`, and an
 * element's opacity dims its outline along with its text.
 */
export const FocusRingIsPaperNotAccent: Story = {
  play: async ({ canvas }) => {
    const out = canvas.getByRole('button', { name: 'Sair' })

    await expect(getComputedStyle(out).outlineStyle).toBe('none')

    // Tabbed and not focused programmatically: `:focus-visible` is what the ring is hung on, and a
    // scripted focus() is not guaranteed to match it.
    await userEvent.tab()
    while (document.activeElement !== out && canvas.getByRole('banner').contains(document.activeElement)) {
      await userEvent.tab()
    }
    await expect(out).toHaveFocus()

    const focused = getComputedStyle(out)
    await expect(focused.outlineStyle).not.toBe('none')
    await expect(parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2)
    await expect(parseFloat(focused.outlineOffset)).toBeGreaterThan(0)
    await expect(measure(out, 'outlineColor')).toBeGreaterThanOrEqual(3)
  },
}

// Keys are English sentences and `fallbackLng` is false, so a key that drifted from its pt.json
// entry paints flawless English on the Portuguese screen with nothing red anywhere. Five of the
// bar's six strings are new in this task.
export const InEnglish: Story = {
  args: { current: 'products' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Panel')).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('link', { name: 'Orders' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'View the shop' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    await expect(canvas.queryByText('Painel')).toBeNull()
  },
}
