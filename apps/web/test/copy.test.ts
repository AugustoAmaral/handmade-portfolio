import { describe, expect, it } from 'vitest'
import pt from '../src/copy/pt.json'
import { createCopyInstance } from '../src/copy/i18n'

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

  it('has no empty translations in pt.json', () => {
    for (const [key, value] of Object.entries(pt as Record<string, string>)) {
      expect(value, `empty translation for "${key}"`).not.toBe('')
    }
  })
})
