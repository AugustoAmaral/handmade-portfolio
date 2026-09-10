import { ORDER_STATUSES } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { adminOrders, paidOrder, shippedOrder } from '../../fixtures/orders'
import { AdminOrdersPage } from './AdminOrdersPage'
import { inAdminShell } from './AdminShell.stories'
import { contrast, parseColor } from '../../../.storybook/contrast'

// The contrast arithmetic lives in `.storybook/contrast.ts`, shared by every story on the branch
// that has to assert a ratio for itself.

const DISPATCH = {
  trackingCode: '',
  onStartDispatch: fn(),
  onChangeTrackingCode: fn(),
  onConfirmDispatch: fn(),
  onCancelDispatch: fn(),
}

const meta = {
  component: AdminOrdersPage,
  title: 'Pages/AdminOrdersPage',
  decorators: [inAdminShell('orders')],
  args: { orders: adminOrders, lang: 'pt', onFilterChange: fn(), dispatch: DISPATCH },
} satisfies Meta<typeof AdminOrdersPage>
export default meta
type Story = StoryObj<typeof meta>

export const Orders: Story = {
  args: { selectedId: shippedOrder.id },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Pedidos')

    // The design's `4 pedidos · 2 em aberto`, with both singulars its template cannot express and
    // with "em aberto" replaced by what the panel can act on. `canTransition(status, 'shipped')` is
    // the same table `OrderDetail` consults before offering the button, so this count and that
    // affordance cannot drift apart: two of the five fixtures are dispatchable.
    await expect(canvas.getByText(/pedidos/).textContent).toBe('5 pedidos · 2 para despachar')

    // Scoped to the orders list, because the detail pane renders the order's ITEMS as a list too —
    // an unscoped count here reads five orders plus one line and calls it six orders.
    await expect(within(canvas.getByRole('list', { name: 'Pedidos' })).getAllByRole('listitem')).toHaveLength(
      adminOrders.length,
    )
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(shippedOrder.buyer.name)
  },
}

/**
 * THE SINGULARS, WHICH THE DESIGN CANNOT EXPRESS. `ordersSummary` is `n + " pedidos"` and
 * `itemsLabel` is `total + " itens"`, both with no branch, so its own fixture prints `1 itens`.
 * Two keys and a condition per count is the branch's idiom, and this is the only story that renders
 * either singular.
 */
export const OneOrder: Story = {
  args: { orders: [paidOrder] },
  play: async ({ canvas }) => {
    // Anchored: nothing is selected in this story, so the prompt beside it also says "pedido".
    await expect(canvas.getByText(/^1 pedido/).textContent).toBe('1 pedido · 1 para despachar')
  },
}

/**
 * THE STATE THE PROTOTYPE HAS NO DEFENCE FOR AT ALL. It binds the detail to
 * `ORDERS[s.order] || ORDERS[0]` and then dereferences `.code`, so an empty list throws and an
 * unknown index silently shows somebody else's order. Selection lives in `?order=` (spec:195), so
 * an id that matches nothing is the ordinary first-load case and not an error.
 *
 * `OrderDetail` REQUIRES an order and `OrdersList` owns the empty list, so this cell is the page's
 * and nothing below it could have drawn it.
 */
export const NothingSelected: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Escolha um pedido na lista.')).toBeInTheDocument()
    // No detail pane at all, which is also the outline: the customer's `<h2>` is gone with it.
    await expect(canvas.queryByRole('heading', { level: 2 })).toBeNull()
    const list = canvas.getByRole('list', { name: 'Pedidos' })
    // `=== 'true'` and not merely present: the bar's own `Pedidos` link carries
    // `aria-current="page"` on this screen, so a truthy test here reads the nav as a selected row.
    await expect(
      within(list)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'true'),
    ).toHaveLength(0)
    // The list is still the whole list.
    await expect(within(list).getAllByRole('listitem')).toHaveLength(adminOrders.length)

    // The prompt is a CELL of the hairline grid and has to paint its own opaque ground like the
    // two real ones, or the container's ink shows through the half of the screen it occupies.
    const cell = canvas.getByText('Escolha um pedido na lista.').parentElement!
    await expect(parseColor(getComputedStyle(cell).backgroundColor).a).toBe(1)
  },
}

// An id in the URL that no longer matches an order — deleted, filtered out, mistyped, or simply an
// old link. The same screen as no id at all, because it is the same fact.
export const AnUnknownOrderIsNotAnError: Story = {
  args: { selectedId: 'o-does-not-exist' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Escolha um pedido na lista.')).toBeInTheDocument()
    await expect(canvas.queryByRole('heading', { level: 2 })).toBeNull()
  },
}

/**
 * THE LIST AND THE DETAIL SHOW THE SAME ORDER, which is one lookup rather than two. The prototype's
 * `ORDERS[s.order] || ORDERS[0]` is the shape being avoided: a fallback there marks one row and
 * renders another, and this is the assertion that would catch it. (Passing the raw `selectedId` to
 * the list instead of the id that was FOUND happens to be the same value today — an id that matches
 * nothing marks nothing either way — so the single lookup is a statement of intent, not a fix.)
 */
export const TheListAndTheDetailAgree: Story = {
  args: { selectedId: paidOrder.id },
  play: async ({ canvas }) => {
    const current = within(canvas.getByRole('list', { name: 'Pedidos' }))
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'true')
    await expect(current).toHaveLength(1)
    await expect(current[0]!).toHaveAttribute('href', `/admin/orders?order=${paidOrder.id}`)
    await expect(within(current[0]!).getByText(paidOrder.buyer.name)).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(paidOrder.buyer.name)
  },
}

/**
 * THE DISPATCH BAG REALLY REACHES THE PANE, and its three OPTIONAL members are the half a spread
 * quietly loses. A mutation that replaced `{...dispatch}` with the five required props by name
 * survived every other story on this page, because none of them set `trackingEditing`,
 * `dispatching` or `dispatchError` — the props existed, the pane rendered them, and nothing here
 * carried them across. `TrackingInlineForm.stories` proves the form; this proves the delivery.
 */
export const DispatchingAnOrder: Story = {
  args: {
    selectedId: paidOrder.id,
    dispatch: { ...DISPATCH, trackingEditing: true, trackingCode: 'BR8841200SC', dispatching: true },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Código de rastreio (opcional)')).toHaveValue('BR8841200SC')
    await expect(canvas.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    await expect(canvas.getByRole('status').textContent).toBe('Marcando como despachado…')
  },
}

export const ADispatchThatFailed: Story = {
  args: {
    selectedId: paidOrder.id,
    dispatch: { ...DISPATCH, trackingEditing: true, dispatchError: 'invalid-transition' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Este pedido já mudou de situação. Recarregue o painel.')
  },
}

/**
 * THE TWO-COLUMN HAIRLINE, WHICH IS THIS PAGE'S AND NOTHING ELSE'S. The prototype puts
 * `border-right:1px solid #1a1713` on the list column unconditionally, over an `auto-fit` grid that
 * collapses to one column at 640px — the dangling edge both shop heroes had, which PR 3 fixed with
 * a hairline grid rather than a media query, because the design has no breakpoints and the width at
 * which THIS container collapses is not the viewport's.
 *
 * So Task 6 shipped a column that paints paper and no edge, and said the separator belongs here.
 * Nothing proved the pairing until this story: the rule is the grid's own ink showing through a 1px
 * gap between two opaque cells, and it needs all three of those to be true at once. A cell that
 * forgot its background shows ink across its whole face; a gap that is not 1px is not a hairline;
 * an ink container behind two opaque cells with no gap draws nothing at all.
 */
export const TheSeparatorIsTheGridAndNotABorder: Story = {
  args: { selectedId: shippedOrder.id },
  play: async ({ canvas }) => {
    const list = canvas.getByRole('list', { name: 'Pedidos' }).parentElement!
    const detail = canvas.getByRole('region', { name: shippedOrder.buyer.name })
    const grid = list.parentElement!
    const style = getComputedStyle(grid)

    await expect(style.display).toBe('grid')
    await expect(style.columnGap).toBe('1px')
    await expect(style.rowGap).toBe('1px')
    // Two tracks at the runner's width, which is what makes the gap a vertical rule rather than a
    // horizontal one. `auto-fit` collapses the tracks it does not fill to 0px and still reports
    // them, so the zero-width ones are dropped before counting.
    const tracks = style.gridTemplateColumns.split(' ').map(Number.parseFloat).filter((width) => width > 0)
    await expect(tracks).toHaveLength(2)

    const ink = parseColor(style.backgroundColor)
    await expect(ink.a).toBe(1)
    for (const cell of [list, detail]) {
      const paper = parseColor(getComputedStyle(cell).backgroundColor)
      await expect(paper.a).toBe(1)
      await expect(contrast(paper, ink)).toBeGreaterThan(10)
    }
  },
}

/**
 * THE FILTER THE DESIGN DOES NOT DRAW, and the API's three modes rather than the two a control
 * naturally offers. `GET /api/admin/orders` reads `all` as no filter, a named status as that
 * status, and NOTHING as everything except `expired` — its own default, which is not a synonym for
 * `all` and which cannot be sent as `?status=` because the parser is `.optional()` and an empty
 * value is a 400. So the control has to be able to express absence, and `undefined` is what it
 * hands back for it.
 *
 * A `<select>` AND NOT LINKS, unlike the row selection beside it. Putting the filter in the URL
 * would mean every row link carrying the current filter forward — otherwise opening an order
 * resets it — and a second query parameter in `routes.adminOrders`. The trade is that the filter
 * is not shareable and not in the history; the selected order, which is the thing worth linking
 * to, still is.
 */
export const FiltersByStatus: Story = {
  play: async ({ args, canvas }) => {
    const select = canvas.getByLabelText('Situação')
    await expect(select).toHaveValue('default')

    await userEvent.selectOptions(select, 'paid')
    await userEvent.selectOptions(select, 'all')
    await expect(args.onFilterChange.mock.calls).toEqual([['paid'], ['all']])
  },
}

/**
 * ABSENT IS NOT `all`. Its own story because a controlled `<select>` snaps back to its prop after
 * every pick, so the default option can only fire a change from a story that starts somewhere else.
 * This is the mode that hides the orders that never became sales, and the one a filter with two
 * options would have quietly lost.
 */
export const TheDefaultIsNotEverything: Story = {
  args: { filter: 'all' },
  play: async ({ args, canvas }) => {
    const select = canvas.getByLabelText('Situação')
    await expect(select).toHaveValue('all')

    await userEvent.selectOptions(select, 'default')
    await expect(args.onFilterChange.mock.calls).toEqual([[undefined]])
  },
}

/**
 * THE OPTION LABELS ARE THE PILLS' LABELS. `STATUS_LABELS` is reached through the one runtime-built
 * `t()` call `copy.test.ts` allows anywhere in `src/ui`, so this page cannot index it and has to
 * spell the five sentences out in a switch — a second copy of that table, in a repo that has
 * already paid for duplicated rules twice.
 *
 * This is what checks it: every fixture status is in the list, so every option label must also be
 * on a pill. A switch that drifted — `Enviado` where the pill says something else — fails here
 * rather than shipping a filter naming statuses the panel does not use.
 */
export const TheFilterNamesEveryStatusThePillsDo: Story = {
  play: async ({ canvas }) => {
    const select = canvas.getByLabelText('Situação')
    const options = [...select.querySelectorAll('option')].map((option) => option.textContent!)
    await expect(options).toHaveLength(ORDER_STATUSES.length + 2)
    await expect(options.slice(0, 2)).toEqual(['Tudo menos os expirados', 'Tudo'])

    // Distinct, and then matched ROW BY ROW rather than as a set: two labels swapped between two
    // statuses stays a set of five distinct sentences that all appear in the list, and only asking
    // each row for the label of ITS OWN status catches it. The fixture carries all five states in
    // the order the list renders them.
    await expect(new Set(options).size).toBe(options.length)
    const labelOf = new Map(ORDER_STATUSES.map((status, index) => [status, options[index + 2]!]))
    const rows = within(canvas.getByRole('list', { name: 'Pedidos' })).getAllByRole('listitem')
    for (const [index, order] of adminOrders.entries()) {
      await expect(within(rows[index]!).getByText(labelOf.get(order.status)!)).toBeInTheDocument()
    }
  },
}

/**
 * NO ORDERS AND A FILTER ON, WHICH IS NOT "NENHUM PEDIDO AINDA". `OrdersList` owns the empty list
 * and cannot know why it is empty; the page does. Saying "nenhum pedido ainda" to somebody who has
 * just asked for the expired ones is telling them the shop has never sold anything.
 */
export const NoOrdersWithThisStatus: Story = {
  args: { orders: [], filter: 'expired' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Nenhum pedido com essa situação.')).toBeInTheDocument()
    await expect(canvas.queryByText('Nenhum pedido ainda.')).toBeNull()
    // No detail cell either: there is nothing to pick, so there is nothing to prompt for.
    await expect(canvas.queryByText('Escolha um pedido na lista.')).toBeNull()
  },
}

// No orders under the API's own default, or under `all`, which is as close to "none at all" as this
// screen can honestly get. That sentence is `OrdersList`'s and the page leaves it there.
export const NoOrdersYet: Story = {
  args: { orders: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Nenhum pedido ainda.')).toBeInTheDocument()
    await expect(canvas.queryByRole('list')).toBeNull()
    // No summary either: `0 pedidos · 0 para despachar` over "nenhum pedido ainda" is arithmetic
    // about nothing, the call `HomePage` already made for the empty catalogue.
    await expect(canvas.queryByText(/pedidos/)).toBeNull()
    // The filter stays: it is how you get back to a list that has something in it.
    await expect(canvas.getByLabelText('Situação')).toBeInTheDocument()
  },
}

/**
 * A panel that could not reach the API, which handed `[]` would otherwise read as a shop that has
 * never sold anything — the same collapse `NoticePage` was written to fix on the storefront. The
 * band and the bar stay, because in a panel nothing links back to they are the way out.
 */
export const CouldNotLoadTheOrders: Story = {
  args: { loadFailed: true, onRetry: fn() },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Algo quebrou do meu lado. Tente de novo em instantes.')
    await expect(canvas.queryByText('Nenhum pedido ainda.')).toBeNull()
    await expect(canvas.queryByRole('list')).toBeNull()
    await expect(canvas.queryByText(/pedidos/)).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Tentar de novo' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const InEnglish: Story = {
  globals: { locale: 'en' },
  args: { lang: 'en', selectedId: shippedOrder.id },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Orders')
    await expect(canvas.getByText(/orders/).textContent).toBe('5 orders · 2 to dispatch')
    await expect(canvas.getByLabelText('Status')).toBeInTheDocument()
    await expect(canvas.getByText('Everything except expired')).toBeInTheDocument()

    // `lang` IS A SEPARATE PROP FROM THE COPY INSTANCE and the page hands it to both children. Two
    // mutations that pinned it to `'pt'` on the way down survived every assertion above, because
    // all of them are page copy resolved by the provider: what the prop actually decides is the
    // month abbreviation in the list and the catalogue names in the pane. Neither is a `t()` key.
    await expect(
      within(canvas.getByRole('list', { name: 'Orders' })).getByText('28 Aug 2026'),
    ).toBeInTheDocument()
    await expect(
      within(canvas.getByRole('region', { name: shippedOrder.buyer.name })).getByText(
        shippedOrder.items[0]!.name.en,
      ),
    ).toBeInTheDocument()
  },
}
