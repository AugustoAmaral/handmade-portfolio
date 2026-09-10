import { computeTotals } from '@shop/shared'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { cartLines } from '../../fixtures/checkout'
import { drawing, letter, products } from '../../fixtures/products'
import { lineOf } from '../shop/CartLine.stories'
import { HomePage } from './HomePage'
import { ShopShell } from './ShopShell'

const LINES = [lineOf(letter, cartLines[0]!.qty), lineOf(drawing, cartLines[1]!.qty)]
const TOTALS = computeTotals(cartLines, 'pac')

// UNITS AND NOT LINES, derived rather than typed. `cartLines` is one letter and two drawings, so a
// hardcoded `2` counted the ROWS — the exact defect `ShopHeader`'s own badge exists to avoid, baked
// into the decorator every page story renders through. Nothing read the badge through this shell
// yet, which is what made it a fixture waiting to be asserted rather than a failure.
const CART_UNITS = cartLines.reduce((units, line) => units + line.qty, 0)

const HEADER = { cartCount: CART_UNITS, lang: 'pt' as const, onToggleLang: fn(), onOpenCart: fn() }
const DRAWER = {
  open: false,
  lines: LINES,
  lang: 'pt' as const,
  itemsCents: TOTALS.itemsCents,
  shippingCents: TOTALS.shippingCents,
  totalCents: TOTALS.totalCents,
  onInc: fn(),
  onDec: fn(),
  onClose: fn(),
}

/**
 * The chrome every page story renders inside, so that each of them is the SCREEN and not the band.
 * Exported here rather than copied into five story files for the reason `lineOf` is exported from
 * `CartLine.stories`: a second copy is a second place for the shell's props to drift.
 *
 * It is also what makes the a11y gate mean anything at this task's scale. axe runs against the
 * story's container, so with the shell in it the rules that need a whole document — a banner
 * beside a main, one heading outline across header, page and drawer — are checked on the markup
 * the browser will really serve, instead of on a band floating on its own.
 *
 * The bag is closed here. A story that wants it open sets `drawer.open` itself; the two states
 * change the document's landmark and heading shape, so they are worth being explicit about.
 */
export const inShopShell: Decorator = (Story) => (
  <ShopShell header={HEADER} drawer={DRAWER}>
    <Story />
  </ShopShell>
)

const meta = {
  component: ShopShell,
  title: 'Pages/ShopShell',
  // Without this the decorator above is indexed as a story, rendered with no args, and blows up on
  // a `Story` that is not a component. Every named export of a *.stories file is a story.
  excludeStories: ['inShopShell'],
  args: {
    header: HEADER,
    drawer: DRAWER,
    children: <p>Um miolo de página</p>,
  },
} satisfies Meta<typeof ShopShell>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    // Exactly one of each. `landmark-unique` fails a document with two unnamed landmarks of the
    // same role, and that is a failure no component story can produce — the shell is the only
    // place on this branch that can put a second `<main>` on the page.
    await expect(canvas.getAllByRole('main')).toHaveLength(1)
    await expect(canvas.getAllByRole('banner')).toHaveLength(1)

    // The page goes INSIDE the main and the header stays outside it. Both directions, because a
    // shell that wrapped everything in `<main>` satisfies the first and a shell that wrapped
    // nothing satisfies the second.
    await expect(canvas.getByText('Um miolo de página').closest('main')).not.toBeNull()
    await expect(canvas.getByRole('banner').closest('main')).toBeNull()

    // A closed drawer is not in the document at all, not merely invisible: anything still in the
    // tree is still in the tab order, and that would be a live checkout link reachable through a
    // bag nobody opened.
    await expect(canvas.queryByRole('dialog')).toBeNull()
  },
}

/**
 * THE BADGE AND THE BAG UNDER IT COUNT THE SAME THING, and this shell is the only place they meet.
 * `ShopHeader.stories` pins that the count reaches the name and `CartDrawer.stories` pins the lines;
 * neither can see that the two DISAGREE, and the decorator every page story renders through said
 * `cartCount: 2` over a bag holding three pieces in two rows — a hardcoded fixture reproducing the
 * exact "counts rows, not units" defect the badge exists to avoid, waiting for the first story that
 * read it.
 *
 * The expected number is summed from the drawer's own lines rather than typed, so a fixture that
 * changes cannot make this agree by accident.
 */
export const TheBadgeCountsWhatIsInTheBag: Story = {
  play: async ({ canvas }) => {
    const units = DRAWER.lines.reduce((sum, line) => sum + line.qty, 0)
    // The fixture has to be able to tell the two apart, or the assertion below is satisfied by
    // either reading. Three pieces in two rows is the smallest bag that can.
    await expect(units).toBeGreaterThan(DRAWER.lines.length)
    // Scoped to the bar: an open drawer puts a second control with `sacola` in its name on the page.
    const bar = within(canvas.getByRole('banner'))
    await expect(bar.getByRole('button', { name: /sacola/i }).textContent).toBe(`Sacola (${units})`)
  },
}

export const WithTheBagOpen: Story = {
  args: { drawer: { ...DRAWER, open: true } },
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole('dialog')
    // The bag belongs to the shell, not to the page under it. Nesting it inside `<main>` would say
    // the drawer is part of the article being read, and it is fixed to the viewport across every
    // route.
    await expect(dialog.closest('main')).toBeNull()
    await expect(canvas.getAllByRole('main')).toHaveLength(1)
  },
}

// The composition this whole task exists for, and the only place the drawer's own heading meets a
// page's. `Sua sacola` is an `<h2>` and it lands AFTER the page's `<h1>` and its two section
// headings, so the outline is h1 → h2 → h2 → h2 and `heading-order` — which needs three headings
// before it can fire at all — has something real to check.
export const TheBagOverTheHomePage: Story = {
  args: {
    drawer: { ...DRAWER, open: true },
    children: <HomePage products={products} featured={letter} lang="pt" contactEmail="contato@augustoamaral.com" />,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H1', 'H2', 'H2', 'H2'])
    await expect(canvas.getAllByRole('main')).toHaveLength(1)
    // The drawer's heading is the last of the four, and it is the one that is not in the page.
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Sua sacola')
  },
}
