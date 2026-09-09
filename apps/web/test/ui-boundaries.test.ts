import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const UI_DIR = path.join(__dirname, '..', 'src', 'ui')

const FORBIDDEN_IMPORTS = [
  'react-router',
  '@tanstack/react-query',
  '../app',
  '../../app',
  '../lib',
  '../../lib',
  '../pages',
  '../../pages',
  '../components',
  '../../components',
  '../i18n',
  '../../i18n',
]

// Browser globals: the UI layer is rendered by the app layer and by Storybook, and must not
// reach for state that only exists in one of them.
const FORBIDDEN_GLOBALS = [/\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bsessionStorage\b/, /\bfetch\(/]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) && !/\.stories\.tsx?$/.test(entry) ? [full] : []
  })
}

describe('ui layer boundaries', () => {
  const files = walk(UI_DIR)

  it('finds the ui files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files.map((f) => [path.relative(UI_DIR, f), f]))('%s imports nothing stateful', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!)
    for (const specifier of imports) {
      expect(
        FORBIDDEN_IMPORTS.some((f) => specifier === f || specifier.startsWith(`${f}/`)),
        `${specifier} is not allowed in src/ui`,
      ).toBe(false)
    }
  })

  it.each(files.map((f) => [path.relative(UI_DIR, f), f]))('%s touches no browser globals', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_GLOBALS) {
      expect(pattern.test(source), `${pattern} is not allowed in src/ui`).toBe(false)
    }
  })
})
