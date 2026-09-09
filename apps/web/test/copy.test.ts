import { getI18n } from 'react-i18next'
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
