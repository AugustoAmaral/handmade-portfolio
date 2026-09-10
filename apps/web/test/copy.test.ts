import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { getI18n } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { SHOP_NAME } from '@shop/shared'
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
// NO `g` FLAG, AND THAT IS A FIX RATHER THAN A STYLE. `RegExp.test` on a GLOBAL regex advances
// `lastIndex` and resumes from it on the next call, so a shared global pattern driving a `filter`
// starts each file's scan wherever the previous file's match ended. With one runtime call site on
// the branch it happened to answer correctly; with two it can skip one, which is precisely the
// case this check exists for.
const DYNAMIC_CALL = /\bt\(\s*[^'"`\s)]/

/**
 * EVERY KEY A RUNTIME-BUILT `t()` CAN PRODUCE, by the file that builds it.
 *
 * A key assembled at runtime is invisible to `LITERAL_CALL`, so it is the one part of the UI's copy
 * nothing would check against `pt.json`. The old rule was to allow exactly ONE such file and check
 * its map by hand — which worked, and cost a real duplication: `AdminOrdersPage` needed the same
 * five sentences for its filter and could not call `t(STATUS_LABELS[status])` without reddening the
 * count, so it spelled them out again in a switch. Two copies of five sentences, kept apart by a
 * test rather than by a reason.
 *
 * Registering the key SET instead gives up nothing. A file with a runtime call still has to appear
 * here — an unregistered one fails below exactly as a second file used to — and every key it can
 * produce is checked against `pt.json` and counted as reachable, which is the guarantee the whole
 * scan is for. What it stops enforcing is the number of call sites, which was never the property
 * anybody wanted.
 */
const RUNTIME_KEYS: Record<string, readonly string[]> = {
  'pages/AdminOrdersPage.tsx': Object.values(STATUS_LABELS),
  'primitives/StatusPill.tsx': Object.values(STATUS_LABELS),
}

const sources = walk(UI_DIR).map((file) => ({
  name: path.relative(UI_DIR, file),
  source: stripComments(readFileSync(file, 'utf8')),
}))

const used = sources.flatMap(({ name, source }) =>
  [...source.matchAll(LITERAL_CALL)].map((match) => ({ name, key: match[2]! })),
)

const dynamic = sources.filter(({ source }) => DYNAMIC_CALL.test(source)).map(({ name }) => name)
const registered = Object.entries(RUNTIME_KEYS).flatMap(([name, keys]) => keys.map((key) => [name, key] as const))

const ptKeys = Object.keys(pt as Record<string, string>)

/**
 * THE ONE STRING ON SCREEN THAT IS NOT TRANSLATED AND NOT A CONSTANT EVERYWHERE. `SHOP_NAME` is a
 * proper noun, so it has no `pt.json` entry and the scan above cannot see it — and `index.html`
 * carries a THIRD copy of it in the `<title>`, which is static HTML and can import nothing.
 *
 * That title is what a browser tab, a bookmark and a search result say, so it drifting away from
 * the bar under it is a real difference nobody would notice. Reading the file is the only way to
 * hold the two together, and it is also the only thing that pins the value itself: the two header
 * stories assert that each bar renders THE constant, which is what they should assert and which is
 * satisfied by any value at all.
 */
describe("the shop's name", () => {
  const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

  it('is the same in the document title as in the two headers', () => {
    expect(html).toContain(`<title>${SHOP_NAME}</title>`)
  })

  it('is not a translated key', () => {
    // A brand mark reads the same in both languages. A `pt.json` entry for it would be an invitation
    // to translate a name, and `t(SHOP_NAME)` would render the key either way — silently correct
    // today and silently wrong the moment somebody adds the entry.
    expect(ptKeys).not.toContain(SHOP_NAME)
  })
})

describe('copy completeness', () => {
  it('finds ui files and t() calls to check', () => {
    // Without this the whole suite below is vacuously green when the glob or the regex breaks.
    expect(sources.length).toBeGreaterThan(0)
    expect(used.length).toBeGreaterThan(0)
  })

  it.each(used.map(({ name, key }) => [`${name} · ${key}`, key]))('%s is translated in pt.json', (_label, key) => {
    expect(ptKeys).toContain(key)
  })

  it.each(registered.map(([name, key]) => [`${name} · ${key}`, key]))(
    '%s is translated in pt.json',
    (_label, key) => {
      expect(ptKeys).toContain(key)
    },
  )

  it('has no dynamic t() call the scan cannot account for', () => {
    // Every file that builds a key at runtime has to declare which keys, above. A new one fails
    // here until it does, which is the same gate as before — it just names a key set instead of
    // rationing call sites.
    expect([...dynamic].sort()).toEqual(Object.keys(RUNTIME_KEYS).sort())
  })

  it('registers no runtime key set for a file that has no runtime call', () => {
    // The other direction, and the one an exemption list always ends up needing: a registration
    // that outlives its call site is a set of keys the orphan check below is told to forgive
    // forever. PR 3 deleted a whitelist for exactly this reason.
    expect(Object.keys(RUNTIME_KEYS).filter((name) => !dynamic.includes(name))).toEqual([])
  })

  it('carries no key in pt.json that nothing accounts for', () => {
    // This was a SUBSET check until PR 3 finished: PR 2 planted seven keys for components that did
    // not exist yet, and a whitelist kept them from reading as orphans while they waited. All seven
    // now have real call sites — `Add to bag` in ProductPage, `Your bag is empty.` in CartDrawer and
    // OrderSummaryPanel, `Ship to: Brazil` in CheckoutShippingSection, the three availability labels
    // in shop/availability.ts, `Photo of {{name}}` in Hero and ProductGallery — so the whitelist
    // stopped protecting anything and started HIDING: every name on it was a key the scan was told
    // to forgive forever, including one whose comment still credited a caller (`ProductCard`) that
    // was never written. An exemption that outlives its reason is indistinguishable from a bug.
    const reachable = new Set([...used.map((u) => u.key), ...registered.map(([, key]) => key)])
    expect(ptKeys.filter((key) => !reachable.has(key))).toEqual([])
  })
})
