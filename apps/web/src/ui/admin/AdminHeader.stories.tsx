import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { AdminHeader } from './AdminHeader'

/**
 * WCAG relative luminance again, and deliberately not imported from `TextInput.stories.tsx`: these
 * are the same formulas with a different job. Everything here has to survive an ALPHA, because the
 * bar states its hierarchy in `opacity` and its underline in `paper/40`, and a ratio taken from the
 * declared colour of a 50%-opacity span is the ratio of a colour nobody can see.
 *
 * The parser knows the three spellings Chromium hands back, one of which was found by writing the
 * throw first and reading what it caught: Tailwind 4 compiles every `/40`-style opacity modifier to
 * `color-mix(in oklab, …)`, and the computed value comes back as `oklab(0.955 0.0004 0.014 / 0.4)`
 * rather than resolved to sRGB. An unknown spelling still throws with the string in the message,
 * because the alternative — defaulting to the token the colour was probably derived from — is
 * assuming the answer to the question being asked.
 */
interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Oklab → sRGB, so the underline is measured as painted instead of as declared. */
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

/** The ratio a reader gets: the declared colour flattened through its own alpha AND its opacity. */
function measure(element: Element, property: 'color' | 'borderBottomColor' | 'outlineColor'): number {
  const surface = surfaceBehind(element)
  const declared = parseColor(getComputedStyle(element)[property])
  return contrast(over(declared, surface, declared.a * opacityOf(element)), surface)
}

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
