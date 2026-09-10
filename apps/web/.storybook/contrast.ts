/**
 * WCAG contrast, measured in the browser, for the stories that have to assert a ratio themselves.
 *
 * WHY THIS FILE EXISTS AT ALL. `color-contrast` is the only contrast rule axe ships, it covers TEXT
 * and nothing else, and `@storybook/addon-a11y` runs it with `test: 'error'`. Every non-text
 * indicator on this project — focus rings, the checkout's radio dot and selected row, the admin
 * bar's nav underline, the products table's chips — is guarded by an explicit measured assertion
 * or by nothing at all. These are the arithmetic those assertions are made of.
 *
 * WHY IT IS SHARED, AFTER SIX COPIES. PR 3 wrote the string-based version four times
 * (`TextInput`, `TextArea`, `Select`, `CheckoutShippingSection`) with a note saying the helpers
 * were duplicated "because a CSF file cannot export a non-story without Storybook trying to render
 * it". That is true of a CSF file and it is the wrong conclusion: a module that is not a CSF file
 * has no such problem, and `main.ts` globs `../src/**` for stories, so nothing here can ever be
 * indexed as one. PR 4 then wrote a richer version twice more, and by Task 3 the copies had
 * DIVERGED — which is the failure the shared-constraints document opens with, arriving on schedule.
 *
 * WHY IT LIVES IN `.storybook/` RATHER THAN IN `src/`. `test/ui-boundaries.test.ts` and
 * `test/copy.test.ts` both walk `src/ui` recursively and exempt only `*.stories.tsx`, so a
 * test-support `.ts` dropped in there would be scanned as production UI: its prose would be read
 * for `t()` calls and its imports checked against the purity allowlist. Out here it is out of both
 * walks by construction rather than by luck, and it sits next to `preview.tsx`, where the axe gate
 * it complements is configured.
 *
 * THE DIVERGENCE, AND THE CORRECTION IT FORCED. PR 4 Task 3 measured the products table's focus
 * ring at 2.81:1 — the dark bar's failing number, in the middle of a paper screen — and the ring
 * was fine. `surfaceBehind` starts its walk at the element itself, so for the active status chip,
 * which paints its own `bg-ink`, it returned ink. An `outline` with a POSITIVE offset is not
 * painted on the element; it is painted on whatever surrounds it. Hence `surfaceOf`. A helper that
 * reports a passing ring as failing will, on a different day, report a failing one as passing.
 *
 * The sign of `outline-offset` is what decides the answer, so it is worth stating: positive offset
 * puts the ring outside the border box (measure against the parent), zero or negative puts it on
 * top of the element's own background (measure against the element). `CheckoutShippingSection`'s
 * row uses `-outline-offset-2` and is therefore correct to measure against itself.
 */

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/**
 * Oklab → sRGB, so a colour is measured as PAINTED instead of as declared. Tailwind 4 compiles
 * every `/40`-style opacity modifier to `color-mix(in oklab, …)` and Chromium hands the computed
 * value back as `oklab(0.955 0.0004 0.014 / 0.4)` rather than resolved to sRGB. Task 2 found this
 * by writing the throw below first and reading what it caught.
 */
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

/**
 * The three spellings Chromium hands back, and A LOUD THROW FOR EVERYTHING ELSE. The alternative —
 * defaulting to the token the colour was probably derived from — is assuming the answer to the
 * question being asked, and the offending string is in the message because that is what turned an
 * unexplained number into the oklab discovery above.
 *
 * The string-scraping version this replaces (`color.match(/\d+/g)` and take the first three) did
 * the opposite of throwing: it read `oklab(0.955 0.0004 0.014 / 0.4)` as `rgb(0, 955, 0)` without
 * a word, and it dropped the alpha of every `rgba()` it was ever handed.
 */
export function parseColor(value: string): Rgba {
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

export function luminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** A colour flattened onto a surface at a given alpha — the compositor's arithmetic. */
export function over(fg: Rgba, bg: Rgba, alpha: number): Rgba {
  const mix = (f: number, b: number) => f * alpha + b * (1 - alpha)
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 }
}

/**
 * The first opaque thing behind an element — what a reader is actually looking through to. The walk
 * STARTS AT THE ELEMENT, so an element that paints its own background is its own surface; pass the
 * parent when what is being measured is painted outside the border box.
 *
 * It throws rather than defaulting, and that is deliberate: a white fallback would quietly hand
 * every assertion the highest-contrast background there is and pass no matter what was drawn.
 */
export function surfaceBehind(element: Element): Rgba {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const background = parseColor(getComputedStyle(node).backgroundColor)
    if (background.a > 0) return background
  }
  throw new Error('nothing opaque behind the element to measure against')
}

/** Every `opacity` between an element and the page, multiplied — the way the compositor sees it. */
export function opacityOf(element: Element): number {
  let total = 1
  for (let node: Element | null = element; node; node = node.parentElement) {
    total *= Number(getComputedStyle(node).opacity)
  }
  return total
}

/** The colour properties any story on this branch measures. */
export type ColorProperty = 'color' | 'backgroundColor' | 'borderBottomColor' | 'outlineColor' | 'accentColor'

/**
 * The ratio a reader gets: the declared colour flattened through its own alpha AND every `opacity`
 * above it, against the surface it is painted on.
 *
 * `surfaceOf` defaults to the element, which is right for text and for any indicator drawn inside
 * the border box. Pass the parent for an `outline` with a positive offset — see the note at the top
 * of this file for the measurement that made the distinction necessary.
 */
export function measure(element: Element, property: ColorProperty, surfaceOf: Element = element): number {
  const surface = surfaceBehind(surfaceOf)
  const declared = parseColor(getComputedStyle(element)[property])
  return contrast(over(declared, surface, declared.a * opacityOf(element)), surface)
}
