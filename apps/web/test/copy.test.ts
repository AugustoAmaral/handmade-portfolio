import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { getI18n } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import pt from '../src/copy/pt.json'
import { createCopyInstance } from '../src/copy/i18n'
import { STATUS_LABELS } from '../src/ui/primitives/StatusPill'

describe('copy instance', () => {
  it('renders the key itself in English', async () => {
    const i18n = createCopyInstance('en')
    await i18n.init()
    expect(i18n.t('Add to bag')).toBe('Add to bag')
  })

  it('translates to pt-BR when the language is pt', async () => {
    const i18n = createCopyInstance('pt')
    await i18n.init()
    expect(i18n.t('Add to bag')).toBe('Colocar na sacola')
  })

  it('keeps sentences with dots and colons intact as keys', async () => {
    const i18n = createCopyInstance('en')
    await i18n.init()
    // keySeparator/nsSeparator are off, so these must not be split into namespaces or paths.
    expect(i18n.t('Your bag is empty.')).toBe('Your bag is empty.')
    expect(i18n.t('Ship to: Brazil')).toBe('Ship to: Brazil')
  })

  it('interpolates counts', async () => {
    const i18n = createCopyInstance('en')
    await i18n.init()
    expect(i18n.t('{{count}} in stock', { count: 3 })).toBe('3 in stock')
  })

  it('does not split a colon key that has no spaces', async () => {
    // The two assertions above pass even with the separators left at their defaults, because
    // i18next only auto-detects "natural language" keys when they contain spaces. This is the
    // shape that actually proves nsSeparator is off: without it, i18next reads `checkout` as a
    // namespace and renders `title`.
    const i18n = createCopyInstance('en')
    await i18n.init()
    expect(i18n.t('checkout:title')).toBe('checkout:title')
  })

  it('has both separators disabled in its resolved options', async () => {
    const i18n = createCopyInstance('en')
    await i18n.init()
    expect(i18n.options.keySeparator).toBe(false)
    expect(i18n.options.nsSeparator).toBe(false)
  })

  it("never becomes react-i18next's default instance", async () => {
    // Guards the reason initReactI18next is not wired in: whichever instance inits last would
    // own every bare useTranslation() call in the app, including v1's dotted keys.
    const i18n = createCopyInstance('pt')
    await i18n.init()
    expect(getI18n()).toBeUndefined()
  })

  it('has no empty translations in pt.json', () => {
    for (const [key, value] of Object.entries(pt as Record<string, string>)) {
      expect(value, `empty translation for "${key}"`).not.toBe('')
    }
  })
})

// The test the spec asks for at line 177, and the only thing standing between a Portuguese reader
// and an English sentence. Keys ARE the English copy and `fallbackLng` is false, so a `t()` whose
// key is absent from pt.json renders the key — perfectly formed English, no console warning, no
// failing test, no error anywhere. `src/ui` is as small as it will ever be, which makes this the
// cheapest this scan will ever be to write.
const UI_DIR = path.join(__dirname, '..', 'src', 'ui')

// Stories are scanned too, deliberately. They run as tests against the same i18n instance, they
// are the only executable spec of the UI layer, and PR 3's page stories will carry most of the
// app's copy. A story whose key is missing paints the English sentence in the interactions panel
// and in the docs page, where it reads as approved copy and gets pasted into a component — the
// exact path this test exists to close. Scanning them costs one glob.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

// Comments come out first. Half of these files DISCUSS `t('...')` in prose, and a scanner that
// reads its own documentation reports keys no code ever calls. Whole-line comments only: a
// trailing one would have to contain a `t(` call to matter, and stripping those needs a parser.
function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
    })
    .join('\n')
}

// `\bt\(` and not `t\(`: the word boundary is what keeps `getByText(`, `expect(` and `formatPrice(`
// out of the results.
const LITERAL_CALL = /\bt\(\s*(['"`])([^'"`]*)\1/g
const DYNAMIC_CALL = /\bt\(\s*[^'"`\s)]/g

const sources = walk(UI_DIR).map((file) => ({
  name: path.relative(UI_DIR, file),
  source: stripComments(readFileSync(file, 'utf8')),
}))

const used = sources.flatMap(({ name, source }) =>
  [...source.matchAll(LITERAL_CALL)].map((match) => ({ name, key: match[2]! })),
)

const dynamic = sources.filter(({ source }) => DYNAMIC_CALL.test(source)).map(({ name }) => name)

const ptKeys = Object.keys(pt as Record<string, string>)

// Keys pt.json already carries for the components PR 3 brings. The scan cannot find a caller yet
// and that is expected, not a defect — so the assertion below is a SUBSET check: it stays green as
// PR 3 wires each one up, and goes red the day a key arrives that nothing accounts for.
const PLANNED_FOR_PR3 = [
  'Add to bag', // ProductPage, ProductCard
  'Your bag is empty.', // CartDrawer
  'Ship to: Brazil', // CheckoutShippingSection
  '{{count}} in stock', // ProductPage stock line
  'Made to order', // ProductCard badge
  'Sold out', // ProductCard badge
  // Suspected DEAD rather than planned: ImageFrame takes `alt` as a prop and builds no alt text of
  // its own, so as designed nothing is left to call this. It stays because pt.json is outside this
  // wave's scope; PR 3 either has ImageFrame build its own alt from the product name or deletes it.
  'Photo of {{name}}',
]

describe('copy completeness', () => {
  it('finds ui files and t() calls to check', () => {
    // Without this the whole suite below is vacuously green when the glob or the regex breaks.
    expect(sources.length).toBeGreaterThan(0)
    expect(used.length).toBeGreaterThan(0)
  })

  it.each(used.map(({ name, key }) => [`${name} · ${key}`, key]))('%s is translated in pt.json', (_label, key) => {
    expect(ptKeys).toContain(key)
  })

  it('translates the keys behind the dynamic t() call in StatusPill', () => {
    for (const label of Object.values(STATUS_LABELS)) {
      expect(ptKeys, `StatusPill renders "${label}" and pt.json has no translation for it`).toContain(label)
    }
  })

  it('has no dynamic t() call the scan cannot account for', () => {
    // A key built at runtime is invisible to the regex above. There is exactly one, its keys are
    // checked by the test above it, and this pins that number: a second one fails here and has to
    // be given the same treatment instead of quietly escaping the scan.
    expect(dynamic).toEqual(['primitives/StatusPill.tsx'])
  })

  it('carries no key in pt.json that nothing accounts for', () => {
    const reachable = new Set([...used.map((u) => u.key), ...Object.values(STATUS_LABELS), ...PLANNED_FOR_PR3])
    expect(ptKeys.filter((key) => !reachable.has(key))).toEqual([])
  })
})
