import { formatOrderNumber, formatPrice } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { adminOrders, expiredOrder, oversoldOrder, pendingOrder, shippedOrder } from '../../fixtures/orders'
import { OrdersList, formatOrderDate } from './OrdersList'
import { type Rgba, contrast, measure, opacityOf, over, parseColor, surfaceBehind } from '../../../.storybook/contrast'

// The contrast arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch
// that has to assert a ratio for itself.

const meta = {
  component: OrdersList,
  title: 'Admin/OrdersList',
  args: { orders: adminOrders, lang: 'pt' },
} satisfies Meta<typeof OrdersList>
export default meta
type Story = StoryObj<typeof meta>

/**
 * THE FIVE LIFECYCLE STATES IN ONE LIST, and the row's whole content in one equality. The design
 * draws four orders and only three statuses — `oversold` and `expired` are never in it — so the
 * fixture list is the wider one on purpose.
 *
 * EVERY ROW IS A REAL `<a href>`, which the prototype's `<div onClick>` is not. Selection lives in
 * `?order=` (spec:195), so a row is a destination: middle-click, open in a new tab and copy-link
 * all work, and the app root upgrades the same-origin click to client-side routing.
 */
export const Orders: Story = {
  play: async ({ canvas }) => {
    // A NAMED list of `<li>`s, neither of which the prototype has: its rows are bare `<div>`s in a
    // column, so a reader gets no count, no position and no way to skip the lot.
    await expect(canvas.getByRole('list', { name: 'Pedidos' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(5)

    const links = canvas.getAllByRole('link')
    await expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/orders?order=o-4',
      '/admin/orders?order=o-3',
      '/admin/orders?order=o-2',
      '/admin/orders?order=o-1',
      '/admin/orders?order=o-5',
    ])

    // The whole row as one string, `toBe` rather than `toHaveTextContent` — that matcher is a
    // SUBSTRING match and would be satisfied by any row that merely contained the code.
    await expect(links[0]!.textContent).toBe(
      `${formatOrderNumber(oversoldOrder.orderNumber)}04 set 2026Bruno Tavares${formatPrice(oversoldOrder.amounts.totalCents, 'pt')}3 itensEstoque insuficiente`,
    )
    // A second row, because one row cannot tell "renders this order" from "renders the first
    // order". The totals are all different now (`fixtures.test.ts` asserts that), so this line
    // fails on any row but its own — which it could not do while three fixtures shared 32600.
    await expect(links[4]!.textContent).toBe(
      `${formatOrderNumber(expiredOrder.orderNumber)}02 set 2026Helena Prado${formatPrice(expiredOrder.amounts.totalCents, 'pt')}2 itensExpirado`,
    )
  },
}

/**
 * THE SINGULAR THE PROTOTYPE GETS WRONG. Its `itemsLabel` is `total + " itens"`, so order #MHP-0411
 * reads `1 itens`. i18next's plural suffixes are structurally unavailable here — `copy.test.ts`
 * rejects a `_one`/`_other` key because no literal call site names it — so the branch's idiom is
 * two keys and a condition, which is also correct in English.
 *
 * IT IS A COUNT OF PIECES, NOT OF LINES. `shippedOrder` holds one line of one drawing and
 * `expiredOrder` one line of two, so a component summing `items.length` instead of the quantities
 * would print `1 item` for both and this story is what says so.
 */
export const CountsPiecesAndNotLines: Story = {
  play: async ({ canvas }) => {
    const rows = canvas.getAllByRole('listitem')
    await expect(within(rows[1]!).getByText('1 item')).toBeInTheDocument()
    await expect(within(rows[4]!).getByText('2 itens')).toBeInTheDocument()
    await expect(within(rows[0]!).getByText('3 itens')).toBeInTheDocument()
    await expect(canvas.queryByText('1 itens')).toBeNull()
  },
}

/**
 * THE STATE THE DESIGN NEVER DRAWS. `o.select` writes `state.order` and nothing in the prototype
 * reads it back: all four rows look identical whether they are showing or not, and on the collapsed
 * one-column layout the detail is below the fold, so the only feedback for a click is content the
 * reader cannot see.
 *
 * ANNOUNCED AND VISIBLE, because either alone is half a state. `aria-current` is the announced
 * half. The visible half is a 3px ink bar drawn as an INSET SHADOW — `ProductGallery` settled that
 * idiom for the selected thumb and the reasons carry: a shadow occupies no space, so nothing shifts
 * by a pixel when the selection moves, where a real border would have to be compensated on every
 * other row; and it leaves `outline` free, which is the focus indicator on every control of this
 * branch.
 *
 * THE BACKGROUND CANNOT CARRY THE STATE ON ITS OWN and the last two lines are the measurement that
 * says so: `paper-3` against `paper` is 1.17:1, nowhere near the 3:1 SC 1.4.11 asks of a graphical
 * object. The bar is the indicator; the tint is what makes the row read as held.
 */
export const SelectedRow: Story = {
  args: { selectedId: shippedOrder.id },
  play: async ({ canvas }) => {
    const links = canvas.getAllByRole('link')
    await expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
      null,
      null,
    ])

    const selected = links[1]!
    const other = links[0]!
    // Read off the computed style and not the class attribute: an arbitrary Tailwind value that
    // fails to compile leaves the class exactly as written and the row completely unmarked.
    const bar = getComputedStyle(selected).boxShadow
    await expect(bar).toContain('inset')
    await expect(getComputedStyle(other).boxShadow).toBe('none')
    await expect(getComputedStyle(selected).backgroundColor).not.toBe(getComputedStyle(other).backgroundColor)

    const surface = surfaceBehind(selected)
    const ink = parseColor(bar.slice(0, bar.indexOf(')') + 1))
    await expect(contrast(ink, surface)).toBeGreaterThanOrEqual(3)
    await expect(contrast(surface, surfaceBehind(other))).toBeLessThan(3)
  },
}

/**
 * NO ORDERS AND NO TABLE OF NOTHING, the call `ProductsTable` made for the empty catalogue. There
 * is no call to action with it because there is nothing anyone can do here: orders arrive from the
 * shop. The prototype has no defence at all — its detail panel is bound to `ORDERS[s.order] ||
 * ORDERS[0]` and `renderVals()` dereferences `ord.code` on `undefined`.
 */
export const NoOrdersYet: Story = {
  args: { orders: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('list')).toBeNull()
    await expect(canvas.queryAllByRole('link')).toHaveLength(0)
    await expect(canvas.getByText('Nenhum pedido ainda.')).toBeInTheDocument()
  },
}

/**
 * THE COLUMN DRAWS NO RIGHT EDGE, and that is the fix rather than an omission. The prototype puts
 * `border-right:1px solid #1a1713` on this column unconditionally, over an `auto-fit` grid that
 * collapses to one column at 640px — the same dangling rule both shop heroes had, which PR 3 fixed
 * with the hairline grid rather than a media query, because the design has none and a breakpoint
 * would have to guess the width at which THIS container collapses.
 *
 * So the separator is not this component's to draw: the page that puts the list beside the detail
 * (Task 7) makes them two cells of a `gap-px` grid over `bg-ink`, and each cell paints its own
 * paper. Both halves are asserted here — no right border, and an opaque paper ground — because a
 * cell that forgets the second one shows ink through and a cell that keeps the first one ships the
 * dangling edge back.
 */
export const IsAHairlineGridCellAndNotABorderedColumn: Story = {
  play: async ({ canvas }) => {
    const root = canvas.getByRole('list').parentElement!
    const style = getComputedStyle(root)
    await expect(style.borderRightWidth).toBe('0px')
    await expect(parseColor(style.backgroundColor).a).toBe(1)
    await expect(contrast(parseColor(style.backgroundColor), parseColor('rgb(26, 23, 19)'))).toBeGreaterThan(10)
  },
}

/** In English the keys render themselves and the month abbreviation follows the language. */
export const InEnglish: Story = {
  globals: { locale: 'en' },
  args: { lang: 'en' },
  play: async ({ canvas }) => {
    const rows = canvas.getAllByRole('listitem')
    await expect(within(rows[1]!).getByText('28 Aug 2026')).toBeInTheDocument()
    await expect(within(rows[1]!).getByText('1 item')).toBeInTheDocument()
    await expect(within(rows[0]!).getByText('3 items')).toBeInTheDocument()
    await expect(within(rows[3]!).getByText('Awaiting payment')).toBeInTheDocument()
  },
}

/**
 * THE DATE IS THE SHOP'S DAY, NOT THE READER'S. `createdAt` is an ISO instant, so a browser in
 * Lisbon would show a different calendar day for the same order than one in Belo Horizonte, and
 * "05 set" would mean two things. Pinning the zone also makes this assertion deterministic in any
 * CI timezone, which is what makes it worth writing at all.
 *
 * The shape is the design's `DD mmm YYYY` in both languages — composed part by part rather than
 * handed to `toLocaleDateString`, which puts the month first in en-US and appends `de` twice in
 * pt-BR. The only thing the language chooses is the abbreviation, and pt-BR's arrives with a
 * trailing period the design does not have.
 */
export const FormatsTheDateInTheShopsTimeZone: Story = {
  play: async () => {
    // 12:00Z is 09:00 in São Paulo, and 21:15Z is 18:15 — both still the day the order was made.
    await expect(formatOrderDate(pendingOrder.createdAt, 'pt')).toBe('01 set 2026')
    await expect(formatOrderDate(pendingOrder.createdAt, 'en')).toBe('01 Sep 2026')
    await expect(formatOrderDate(shippedOrder.createdAt, 'pt')).toBe('28 ago 2026')
    // The line that fails if the zone is dropped or set to UTC: 01:30Z on the 7th is 22:30 on the
    // 6th in São Paulo, so the two answers are different days and only one of them is the day the
    // order was placed.
    await expect(formatOrderDate('2026-09-07T01:30:00.000Z', 'pt')).toBe('06 set 2026')
  },
}

/**
 * Reads back the colour a utility class actually paints, by painting it. The alternative is a hex
 * literal copied out of `index.css`, which is a second copy of a token and stops being a
 * measurement the moment the token moves.
 */
function surfaceOfClass(className: string, host: Element): Rgba {
  const probe = document.createElement('div')
  probe.className = className
  host.appendChild(probe)
  const colour = parseColor(getComputedStyle(probe).backgroundColor)
  probe.remove()
  return colour
}

/**
 * THE MUTED LINE THE EXTRACT MEASURED AS FAILING, AGAINST BOTH SURFACES IT IS SEEN ON. The
 * code/date row is drawn at `opacity:.6` — 4.47:1 on paper, AA by 0.03 — and the row tints to
 * `paper-2` on hover, where the same value is 4.38:1 and the audit calls it "worse on hover". The
 * branch's floor is `opacity-65`: 5.26:1 and 5.13:1.
 *
 * THE OPACITY IS ON THE WORDS AND NOT ON THE ROW. That is Task 5's rule, and this row is exactly
 * where it bites: the whole row is a LINK now, so dimming it would composite the customer's name,
 * the total and the status pill through the same 0.65 — `opacity` groups a subtree and a child's
 * `opacity:1` cancels nothing. The full-strength line on the link itself is what fails if the muted
 * class ever migrates up one element.
 *
 * THE RELATIONAL LINE IS WHAT HOLDS THE ARITHMETIC. Every ratio here is a `>=`, so a measurement
 * bug that errs HIGH passes all of them; deleting the alpha compositing from the shared helper once
 * left the whole suite green, because an uncomposited muted colour reads as MORE legible.
 *
 * THE HOVER SURFACE IS PAINTED RATHER THAN ENTERED, and that is a limitation worth stating: a
 * synthetic pointer event does not put Chromium into `:hover`, so no story on this branch can read
 * a hover style off `getComputedStyle`. What is measured here is the real declared colour and the
 * real composited opacity against the real `paper-2`; what is NOT measured is that the row still
 * carries the rule that reaches it.
 */
export const MeasuresItsMutedLineAgainstBothSurfaces: Story = {
  play: async ({ canvas }) => {
    const row = canvas.getAllByRole('link')[0]!
    const code = within(row).getByText(formatOrderNumber(oversoldOrder.orderNumber))
    const name = within(row).getByText('Bruno Tavares')

    await expect(opacityOf(row)).toBe(1)
    await expect(opacityOf(code)).toBeCloseTo(0.65, 5)
    await expect(measure(code, 'color')).toBeGreaterThanOrEqual(4.5)
    await expect(measure(code, 'color')).toBeLessThan(measure(name, 'color'))

    const hovered = surfaceOfClass('bg-paper-2', row.parentElement!)
    const muted = parseColor(getComputedStyle(code).color)
    const painted = over(muted, hovered, muted.a * opacityOf(code))
    await expect(contrast(painted, hovered)).toBeGreaterThanOrEqual(4.5)
    // The hover tint really is darker than the ground, so the line above is the harder of the two
    // and not an easier one wearing the same number.
    await expect(contrast(painted, hovered)).toBeLessThan(measure(code, 'color'))
  },
}
