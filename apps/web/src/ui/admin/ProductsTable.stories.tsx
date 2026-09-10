import type { PublicProduct } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { digitalLetter, drawing, inactiveGuide, letter, soldOutDrawing } from '../../fixtures/products'
import { ProductsTable } from './ProductsTable'

/**
 * WCAG relative luminance, the third copy of these formulas on the branch and the second in this
 * folder. `TextInput.stories.tsx` and `AdminHeader.stories.tsx` carry the other two; hoisting them
 * into one place is a file outside this task's scope, so it goes in the report as work rather than
 * being done quietly here. What is NOT duplicated is the reason: everything below has to survive
 * an `opacity`, because this table states its whole hierarchy in opacity and a ratio taken from a
 * declared colour is the ratio of a colour nobody can see.
 *
 * The parser knows the spellings Chromium hands back and throws with the offending string on
 * anything else, rather than defaulting to the token the colour was probably derived from — which
 * would be assuming the answer to the question being asked. Tailwind 4 compiles a `/40`-style
 * opacity modifier to `color-mix(in oklab, …)` and the computed value comes back as `oklab(…)`.
 */
interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

function fromOklab(parts: number[]): Rgba {
  const [L, A, B, alpha = 1] = parts as [number, number, number, number?]
  const long = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const medium = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const short = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const [r, g, b] = [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ].map((c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
  return { r: r!, g: g!, b: b!, a: alpha ?? 1 }
}

function parseColor(value: string): Rgba {
  const legacy = value.match(/^rgba?\(([^)]+)\)$/)
  if (legacy) {
    const parts = legacy[1]!.split(/[\s,/]+/).filter(Boolean).map(Number)
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 }
  }
  const srgb = value.match(/^color\(srgb ([^)]+)\)$/)
  if (srgb) {
    const parts = srgb[1]!.split(/[\s/]+/).filter(Boolean).map(Number)
    return { r: parts[0]! * 255, g: parts[1]! * 255, b: parts[2]! * 255, a: parts[3] ?? 1 }
  }
  const oklab = value.match(/^oklab\(([^)]+)\)$/)
  if (oklab) return fromOklab(oklab[1]!.split(/[\s/]+/).filter(Boolean).map(Number))
  throw new Error(`cannot measure the colour "${value}": the parser knows rgb(), rgba(), color(srgb …) and oklab()`)
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

function over(fg: Rgba, bg: Rgba, alpha: number): Rgba {
  const mix = (f: number, b: number) => f * alpha + b * (1 - alpha)
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 }
}

/** The first opaque thing behind an element — what a reader is actually looking through to. */
function surfaceBehind(element: Element): Rgba {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const background = parseColor(getComputedStyle(node).backgroundColor)
    if (background.a > 0) return background
  }
  throw new Error('nothing opaque behind the element to measure against')
}

/** Every `opacity` between an element and the page, multiplied — the way the compositor sees it. */
function opacityOf(element: Element): number {
  let total = 1
  for (let node: Element | null = element; node; node = node.parentElement) {
    total *= Number(getComputedStyle(node).opacity)
  }
  return total
}

/**
 * The ratio a reader gets: the declared colour flattened through its own alpha AND its opacity.
 *
 * `surfaceOf` IS A PARAMETER BECAUSE A FOCUS RING IS NOT PAINTED ON WHAT ITS TEXT IS PAINTED ON,
 * and this cost a red test to notice. The active chip paints its own `bg-ink`, so a surface walk
 * that starts at the element itself stops there and measures the accent ring against ink: 2.81:1,
 * the same number Task 2 measured inside the dark bar, and a failure. The ring is not on the chip.
 * `outline-offset-2` holds it 2px clear of the border box, so the pixels on both sides of it are
 * the paper behind the chip's PARENT — 5.58:1. Which surface is right depends on the offset being
 * positive, which is asserted immediately before the ratio rather than assumed.
 *
 * `AdminHeader.stories.tsx` measures its ring the other way round and is right to: `Sair` has no
 * background of its own, so starting at the element already walks through to the bar's ink.
 */
function measure(element: Element, property: 'color' | 'outlineColor', surfaceOf: Element = element): number {
  const surface = surfaceBehind(surfaceOf)
  const declared = parseColor(getComputedStyle(element)[property])
  return contrast(over(declared, surface, declared.a * opacityOf(element)), surface)
}

/**
 * The catalogue as the panel sees it: everything the shop's fixtures hold, INCLUDING the inactive
 * product the storefront never renders. Composed from the fixtures rather than declared as data —
 * `src/fixtures/products.ts` exports a `products` array, and it is the shop's four, which by
 * definition cannot contain an inactive row.
 *
 * Between them the five cover every branch this table has: no limit on a physical piece, no limit
 * on a digital one, a real count, a zero, and `active: false`.
 */
const catalogue: readonly PublicProduct[] = [letter, drawing, soldOutDrawing, digitalLetter, inactiveGuide]

const meta = {
  component: ProductsTable,
  title: 'Admin/ProductsTable',
  args: {
    products: catalogue,
    lang: 'pt',
    onToggleActive: fn(),
    onAskDelete: fn(),
    onCancelDelete: fn(),
    onConfirmDelete: fn(),
  },
} satisfies Meta<typeof ProductsTable>
export default meta
type Story = StoryObj<typeof meta>

/**
 * THE STRUCTURE, WHICH IS THE POINT OF THE COMPONENT. The prototype is a CSS grid of unlabelled
 * `<div>`s: no columns, no rows, no header to move by, and nothing in the a11y gate to say so —
 * axe does not flag a table that was never built. Every line here fails on a `<div>` rebuild.
 *
 * FIVE COLUMN HEADERS AND THE LIST IS AN EQUALITY, so `Idiomas` cannot come back by reflex on
 * seeing it in the design. spec:221 dropped it because both languages are required by the schema
 * and the "missing" state is unreachable; a sixth header would redden this line.
 *
 * The `aria-checked` list does double duty: it proves the rows are in the order they were handed
 * over AND that the inactive one is the fifth. A row order derived from anything but the prop is
 * how a toggle ends up firing on the wrong product.
 */
export const Catalogue: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Produtos' })).toBeInTheDocument()

    const headers = canvas.getAllByRole('columnheader')
    await expect(headers.map((header) => header.textContent)).toEqual([
      'Produto',
      'Preço',
      'Estoque',
      'Tipo',
      'Situação',
    ])

    const rows = canvas.getAllByRole('row')
    await expect(rows).toHaveLength(6)
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(5)

    await expect(canvas.getAllByRole('switch').map((chip) => chip.getAttribute('aria-checked'))).toEqual([
      'true',
      'true',
      'true',
      'true',
      'false',
    ])

    // Sold out is a stock of zero and prints as one. `∞` is reserved for the rows that have no
    // limit at all — the made-to-order letter and the two digital ones — and a table that showed `0`
    // and `∞` the same way would be unreadable.
    await expect(within(rows[3]!).getAllByRole('cell')[1]!.textContent).toBe('0')
    await expect(canvas.getAllByText('∞')).toHaveLength(3)
  },
}

/**
 * THREE UTILITIES THAT FAIL IN SILENCE, which is why they are asserted rather than looked at.
 * `px-gutter-admin` compiles to nothing at all if `--spacing-gutter-admin` leaves `@theme` — no
 * error, no warning, a table whose rows touch the edge of the window. An arbitrary value with a
 * typo in it does the same: `grid-template-columns` comes back `none` and the whole five-column
 * layout silently becomes a stack. And `min-width` is the entire horizontal-scroll strategy for a
 * table that grows, since the design has no responsive treatment and zero media queries.
 *
 * The padding is a RANGE because `4vw` resolves against whatever viewport the runner opened, and
 * the range is what makes it an assertion: 0 fails the floor when the token is gone, and the
 * shop's `--spacing-gutter` fails the ceiling at any width where 5vw is past 40px — which is the
 * mistake worth preventing, because the two utilities differ by one word.
 *
 * 734px is the prototype's 900 minus the `Idiomas` track and its gap (150 + 16), so this number
 * also fails if that column ever comes back.
 */
export const LaysOutFiveTracksOverAScroller: Story = {
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Produtos' })
    await expect(parseFloat(getComputedStyle(table).minWidth)).toBe(734)

    const row = canvas.getAllByRole('row')[1]!
    await expect(getComputedStyle(row).gridTemplateColumns.split(' ')).toHaveLength(5)

    const gutter = parseFloat(getComputedStyle(row).paddingLeft)
    await expect(gutter).toBeGreaterThanOrEqual(16)
    await expect(gutter).toBeLessThanOrEqual(40)
  },
}

// The empty panel, which the design does not draw: it renders the six column headers and then
// nothing at all. A table announcing five columns and no rows reads as a grid that failed to load,
// so there is no table — the same call `CatalogGrid` makes for an empty catalogue.
export const Empty: Story = {
  args: { products: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('table')).toBeNull()
    await expect(canvas.queryAllByRole('row')).toHaveLength(0)
    await expect(canvas.getByText('Nenhum produto ainda.')).toBeInTheDocument()
  },
}

/**
 * The confirmation belongs to ONE row, and this is the assertion that says so. The container holds
 * a single id rather than a set, and if that id ever reached every row — the shape a boolean prop
 * would have — five products would be one keystroke from gone.
 */
export const ConfirmingOneRowLeavesTheOthersAlone: Story = {
  args: { confirmingDeleteId: soldOutDrawing.id },
  play: async ({ args, canvas }) => {
    await expect(canvas.getAllByRole('button', { name: /^apagar/i })).toHaveLength(4)
    await expect(canvas.getAllByText('Apagar de vez?')).toHaveLength(1)

    const asking = canvas.getByRole('button', { name: 'Sim, apagar Retrato a lápis' })
    await expect(asking).toHaveFocus()

    await userEvent.click(asking)
    await expect(args.onConfirmDelete).toHaveBeenCalledOnce()
    await expect(args.onConfirmDelete).toHaveBeenCalledWith(soldOutDrawing)
  },
}

/**
 * THE MEASUREMENT, taken in the browser rather than inherited from the extract. Three of its paper
 * numbers governed this table and two of them failed AA: the column headers at `opacity:.5`
 * (3.29:1 measured here, the extract said 3.28) and the name's sub-line at the same value. Both
 * are `opacity-65` now, which is 5.25:1 — the correction `CatalogGrid` already made for the same
 * `.55` meta line, applied to the two sites in this table rather than re-derived.
 *
 * TWO-SIDED ON PURPOSE. The ratio proves the text is legible; the opacity equality proves nobody
 * lifted it further "to be safe" and flattened a hierarchy the design states in exactly this
 * value. `typeLabel` stays at the prototype's `.7` because `.7` measures 6.20:1 and passes — the
 * rule is to check the design, not to raise everything that looks faint.
 *
 * THE FOCUS RING IS THE LAST LINE AND IT IS THE ONLY GATE ON ITSELF. Task 2 measured that axe has
 * no rule for non-text contrast at all, so an indicator on this branch is guarded by an assertion
 * or by nothing. Accent on paper is 5.58:1, over SC 2.4.11's 3:1 — the opposite of the dark bar,
 * where the same ring measures 2.81:1 and had to become paper.
 */
export const MeasuresItsMutedText: Story = {
  play: async ({ canvas }) => {
    const header = canvas.getByRole('columnheader', { name: 'Produto' })
    await expect(opacityOf(header)).toBeCloseTo(0.65, 5)
    await expect(measure(header, 'color')).toBeGreaterThanOrEqual(4.5)

    const subLine = canvas.getByText('Handwritten letter · carta-escrita')
    await expect(opacityOf(subLine)).toBeCloseTo(0.65, 5)
    await expect(measure(subLine, 'color')).toBeGreaterThanOrEqual(4.5)

    const type = canvas.getAllByText('físico')[0]!
    await expect(opacityOf(type)).toBeCloseTo(0.7, 5)
    await expect(measure(type, 'color')).toBeGreaterThanOrEqual(4.5)

    const toggle = canvas.getAllByRole('switch')[0]!
    await expect(getComputedStyle(toggle).outlineStyle).toBe('none')

    // Tabbed and not focused programmatically: the ring hangs on `:focus-visible`, which a
    // scripted focus() is not guaranteed to match.
    for (let i = 0; i < 10 && document.activeElement !== toggle; i += 1) await userEvent.tab()
    await expect(toggle).toHaveFocus()

    const focused = getComputedStyle(toggle)
    await expect(focused.outlineStyle).not.toBe('none')
    await expect(parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2)
    await expect(parseFloat(focused.outlineOffset)).toBeGreaterThan(0)
    // Measured against what the ring is painted on, which is the paper behind the chip and not the
    // chip's own ink — the offset asserted on the line above is what makes that true. Against the
    // ink this reads 2.81:1 and fails, which is how the distinction was found.
    await expect(measure(toggle, 'outlineColor', toggle.parentElement!)).toBeGreaterThanOrEqual(3)
  },
}

// Six of this table's strings are new in this task, and a key that drifted from its pt.json entry
// paints flawless English on the Portuguese screen with nothing red anywhere.
export const InEnglish: Story = {
  args: { lang: 'en' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table', { name: 'Products' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Product',
      'Price',
      'Stock',
      'Type',
      'Status',
    ])
    await expect(canvas.queryByText('Produto')).toBeNull()
  },
}
