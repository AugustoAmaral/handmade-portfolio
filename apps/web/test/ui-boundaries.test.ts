import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const UI_DIR = path.join(__dirname, '..', 'src', 'ui')

// The UI layer declares what it MAY import rather than what it may not. A blacklist of relative
// prefixes only reaches as deep as the prefixes someone remembered to write: a file two levels
// down under src/ui escapes `../lib` and `../../lib` with `../../../lib`. Resolving the path and
// asking whether it stayed inside src/ui has no such hole.
const ALLOWED_PACKAGES = ['react', 'react-dom', 'react-i18next', '@shop/shared']

// Four ways into the module graph. A check that only sees `from '...'` leaves the other three
// doors open — side-effect imports, dynamic imports and require all reach the same modules.
const SPECIFIER_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

// The layer is stateless by design — state and effects live in `src/app`. The import allowlist
// does not catch this on its own, because `react` is legitimately allowed: a primitive could
// import `useState` from it and pass every other check.
const FORBIDDEN_HOOKS = [/\buseState\b/, /\buseReducer\b/, /\buseEffect\b/, /\buseLayoutEffect\b/, /\buseRef\b/]

const FORBIDDEN_GLOBALS = [/\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bsessionStorage\b/, /\bfetch\(/]

// Stories are exempt on purpose: they import the storybook packages by necessity, and they are
// already executed as tests by the browser project, so a broken one fails there.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) && !/\.stories\.tsx?$/.test(entry) ? [full] : []
  })
}

function specifiersOf(source: string): string[] {
  return SPECIFIER_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1]!))
}

function isAllowed(specifier: string, file: string): boolean {
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(file), specifier)
    return resolved === UI_DIR || resolved.startsWith(`${UI_DIR}${path.sep}`)
  }
  return ALLOWED_PACKAGES.some((p) => specifier === p || specifier.startsWith(`${p}/`))
}

describe('ui layer boundaries', () => {
  const files = walk(UI_DIR)

  it('finds the ui files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files.map((f) => [path.relative(UI_DIR, f), f]))('%s imports nothing stateful', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    for (const specifier of specifiersOf(source)) {
      expect(isAllowed(specifier, file), `${specifier} is not allowed in src/ui`).toBe(true)
    }
  })

  it.each(files.map((f) => [path.relative(UI_DIR, f), f]))('%s holds no state', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_HOOKS) {
      expect(pattern.test(source), `${pattern} is not allowed in src/ui`).toBe(false)
    }
  })

  it.each(files.map((f) => [path.relative(UI_DIR, f), f]))('%s touches no browser globals', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_GLOBALS) {
      expect(pattern.test(source), `${pattern} is not allowed in src/ui`).toBe(false)
    }
  })
})
