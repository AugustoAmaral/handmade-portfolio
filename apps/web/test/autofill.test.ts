import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * WCAG 2.2 SC 1.3.5 (Identify Input Purpose) asks every field that collects information about the
 * person filling it in to declare WHICH information, using a token from the HTML autofill list.
 *
 * A WRONG TOKEN IS WORSE THAN NO TOKEN, which is why this test exists at all. An invented or
 * misspelled one — `postal_code`, `addressline1`, `zip` — is inert: the browser ignores what it
 * does not recognise, nothing throws, nothing renders differently, and the field quietly stops
 * declaring its purpose while looking like it declares one. A token that IS recognised but names
 * the wrong thing is worse still: it makes a password manager fill the city into the street box.
 * The story files assert which field carries which token; this asserts that the tokens are real.
 *
 * It scans `src/ui` the way `copy.test.ts` and `ui-boundaries.test.ts` do, so it covers the admin
 * login's pair and every field added after this, not only the ones a story happens to name.
 */
const UI_DIR = path.join(__dirname, '..', 'src', 'ui')

// The HTML Living Standard's autofill field names, verbatim and complete. Not a subset of "the
// ones we use": a subset would redden on the first legitimate new field and get widened by
// whoever is in a hurry, which is how a list like this stops meaning anything.
const AUTOFILL_FIELD_NAMES = new Set([
  'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name', 'honorific-suffix',
  'nickname', 'username', 'new-password', 'current-password', 'one-time-code',
  'organization-title', 'organization',
  'street-address', 'address-line1', 'address-line2', 'address-line3',
  'address-level4', 'address-level3', 'address-level2', 'address-level1',
  'country', 'country-name', 'postal-code',
  'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name', 'cc-number',
  'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type',
  'transaction-currency', 'transaction-amount', 'language',
  'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'url', 'photo',
  'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local',
  'tel-local-prefix', 'tel-local-suffix', 'tel-extension', 'email', 'impp',
])

// A field name may be preceded by an optional `section-*` group and an optional address/payment
// modifier. This shop has one address and one card page, so nothing uses them — but a form that
// ever grows a billing address should not have to fight this test to spell itself correctly.
const MODIFIERS = new Set(['shipping', 'billing', 'home', 'work', 'mobile', 'fax', 'pager'])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const LITERAL = /\bautoComplete=\{?\s*(['"`])([^'"`]*)\1/g
// `autoComplete={anything that is not a string literal}` — a token assembled at runtime is
// invisible to the scan above, so it is the one shape that could smuggle an invented value past
// this test. The two files below are plumbing: they forward the caller's prop and decide nothing.
const DYNAMIC = /\bautoComplete=\{(?!\s*['"`])/
const PASS_THROUGH = ['primitives/TextInput.tsx', 'shop/CheckoutSection.tsx']

const sources = walk(UI_DIR).map((file) => ({
  name: path.relative(UI_DIR, file),
  source: readFileSync(file, 'utf8'),
}))

const tokens = sources.flatMap(({ name, source }) =>
  [...source.matchAll(LITERAL)].map((match) => ({ name, value: match[2]! })),
)

describe('autofill tokens', () => {
  it('finds tokens to check', () => {
    // Without this the whole suite below is vacuously green the moment the glob or the regex breaks
    // — and every assertion here is of the form "everything found is valid".
    expect(tokens.length).toBeGreaterThan(0)
  })

  it.each(tokens.map(({ name, value }) => [`${name} · ${value}`, value]))(
    '%s is a field name from the HTML autofill list',
    (_label, value) => {
      const parts = value.split(/\s+/).filter(Boolean)
      const field = parts.pop()
      expect(AUTOFILL_FIELD_NAMES.has(field ?? '')).toBe(true)
      for (const modifier of parts) {
        expect(MODIFIERS.has(modifier) || modifier.startsWith('section-')).toBe(true)
      }
    },
  )

  it('builds no token at runtime outside the two pass-through components', () => {
    const dynamic = sources.filter(({ source }) => DYNAMIC.test(source)).map(({ name }) => name)
    expect(dynamic.sort()).toEqual([...PASS_THROUGH].sort())
  })
})
