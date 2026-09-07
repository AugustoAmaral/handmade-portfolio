import { describe, expect, it } from 'vitest'
import en from '../src/i18n/en.json'
import pt from '../src/i18n/pt.json'

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('i18n congruence', () => {
  it('pt and en have exactly the same keys', () => {
    expect(flatKeys(pt as Record<string, unknown>).sort()).toEqual(flatKeys(en as Record<string, unknown>).sort())
  })
})
