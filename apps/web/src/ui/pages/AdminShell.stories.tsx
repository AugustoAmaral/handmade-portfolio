import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { adminOrders, shippedOrder } from '../../fixtures/orders'
import type { AdminSection } from '../admin'
import { AdminOrdersPage } from './AdminOrdersPage'
import { AdminShell } from './AdminShell'
import { parseColor } from '../../../.storybook/contrast'

/**
 * The chrome every panel story renders inside, so each of them is the SCREEN and not the band —
 * `inShopShell`'s twin, exported for the same reason: a second copy of the shell's props is a
 * second place for them to drift.
 *
 * A FACTORY WHERE THE SHOP'S IS A CONSTANT, because the admin bar has a current section and the
 * shop's has none. Which section is showing is the container's answer (Task 8) and not the page's,
 * so a page story states it here rather than the page growing a prop for it.
 */
export function inAdminShell(current?: AdminSection, signedIn = true): Decorator {
  return (Story) => (
    <AdminShell header={{ current, signedIn, onSignOut: fn() }}>
      <Story />
    </AdminShell>
  )
}

const DISPATCH = {
  trackingCode: '',
  onStartDispatch: fn(),
  onChangeTrackingCode: fn(),
  onConfirmDispatch: fn(),
  onCancelDispatch: fn(),
}

const meta = {
  component: AdminShell,
  title: 'Pages/AdminShell',
  // Without this the factory above is indexed as a story, rendered with no args, and hands React a
  // decorator where it wants an element. Every named export of a *.stories file is a story.
  excludeStories: ['inAdminShell'],
  args: {
    header: { current: 'products', signedIn: true, onSignOut: fn() },
    children: <p>Um miolo de painel</p>,
  },
} satisfies Meta<typeof AdminShell>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    // Exactly one of each, which is the whole job of a shell and the one failure no component
    // story can produce. `landmark-no-duplicate-main` is the rule that catches a SECOND `<main>`;
    // `landmark-one-main` never fires here at all, so a MISSING one is caught by this line and by
    // nothing else in the repo.
    await expect(canvas.getAllByRole('main')).toHaveLength(1)
    await expect(canvas.getAllByRole('banner')).toHaveLength(1)

    // Both directions: a shell that wrapped everything in `<main>` satisfies the first line and a
    // shell that wrapped nothing satisfies the second.
    await expect(canvas.getByText('Um miolo de painel').closest('main')).not.toBeNull()
    await expect(canvas.getByRole('banner').closest('main')).toBeNull()

    // NO LANGUAGE TOGGLE, AND IT IS A DECISION. The panel uses the same copy instance and the same
    // English-sentence keys as the shop, and renders in whatever language the shop was left in. A
    // second toggle for a single-user screen is surface nobody asked for, and this is what turns
    // the note in the component into something that reddens if anyone adds one by reflex.
    await expect(canvas.queryByRole('button', { name: 'Mudar para inglês' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Mudar para português' })).toBeNull()

    // THE ROOT PAINTS ITS OWN GROUND, and losing it is invisible to the gate: the preview canvas
    // behind it is paper too, so every contrast ratio stays exactly where it was and axe never
    // reaches the story's own wrapper anyway. Only this line notices.
    //
    // Its `font-body` is NOT asserted beside it, and deliberately: the preview decorator sets the
    // same family on the wrapper, so a root that lost it inherits an identical computed value and
    // no assertion here could ever fail. That is a gap in the evidence rather than a passing test.
    const root = canvas.getByRole('main').parentElement!
    await expect(parseColor(getComputedStyle(root).backgroundColor).a).toBe(1)
  },
}

/**
 * THE SHELL IS THE FIRST SUPPLIER OF `signedIn`, `current` AND `onSignOut`. Task 2 shipped all
 * three with no consumer and named that itself as the shape PR 3's hook layer failed in; these
 * three assertions are the wiring test, and they belong here because nothing below the shell has
 * ever filled them.
 */
export const ForwardsEveryHeaderProp: Story = {
  args: { header: { current: 'orders', signedIn: true, onSignOut: fn() } },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('link', { name: 'Produtos' })).not.toHaveAttribute('aria-current')

    await userEvent.click(canvas.getByRole('button', { name: 'Sair' }))
    await expect(args.header.onSignOut).toHaveBeenCalledOnce()
  },
}

// The shell the login renders in: the bar keeps the way out to the shop and loses everything a
// session pays for. `signedIn` reaches the bar from here and from nowhere else.
export const SignedOut: Story = {
  args: { header: { signedIn: false, onSignOut: fn() } },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link', { name: 'Produtos' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Sair' })).toBeNull()
    await expect(canvas.getByRole('link', { name: 'Ver a loja' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('main')).toHaveLength(1)
  },
}

/**
 * A WHOLE SCREEN IN THE SHELL, and the only composition on this branch where the panel's outline
 * runs three levels deep. axe's `heading-order` returns true at index 0 and needs three headings
 * before a jump is expressible at all — the orders screen brings five, so this is the story that
 * makes the rule capable of firing on the admin. The levels are asserted anyway: a clean axe run
 * says nothing about an outline, and on a story with fewer headings it cannot even look.
 */
export const TheOrdersScreenInTheShell: Story = {
  args: {
    header: { current: 'orders', signedIn: true, onSignOut: fn() },
    children: (
      <AdminOrdersPage
        orders={adminOrders}
        selectedId={shippedOrder.id}
        lang="pt"
        onFilterChange={fn()}
        dispatch={DISPATCH}
      />
    ),
  },
  play: async ({ canvas }) => {
    // Pedidos, then the customer, then the three blocks of that customer's order.
    await expect(canvas.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H1', 'H2', 'H3', 'H3', 'H3'])
    await expect(canvas.getAllByRole('main')).toHaveLength(1)
    // The page went INSIDE the one `<main>` the shell owns, rather than beside it.
    await expect(canvas.getByRole('heading', { level: 1 }).closest('main')).not.toBeNull()
  },
}
