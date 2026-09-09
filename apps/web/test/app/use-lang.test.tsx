import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLang } from '../../src/app/state/useLang'
import { copyI18n, createCopyInstance } from '../../src/copy/i18n'

// `copyI18n` is deliberately not react-i18next's global default, so a bare `useTranslation()`
// only reaches it through a provider. Without this wrapper the hook gets react-i18next's fallback
// object, whose `changeLanguage` is undefined.
const wrapper = ({ children }: { children: ReactNode }) => <I18nextProvider i18n={copyI18n}>{children}</I18nextProvider>

// jsdom reports `navigator.language` as 'en-US', so a test that leaves it alone starts the hook in
// English and every toggle assertion reads backwards. Each test states the browser it assumes.
function browserLanguage(value: string) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(value)
}

beforeEach(async () => {
  localStorage.clear()
  // The instance is a module singleton shared by every test in this file: without the reset a test
  // inherits whatever language the previous one left behind.
  await copyI18n.changeLanguage('pt')
})

afterEach(() => vi.restoreAllMocks())

describe('useLang', () => {
  it('defaults to pt when nothing is stored and the browser says pt-BR', () => {
    browserLanguage('pt-BR')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('pt')
  })

  it('uses en when the browser is English and nothing is stored', () => {
    browserLanguage('en-GB')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('en')
  })

  it('prefers the stored language over the browser', () => {
    browserLanguage('en-GB')
    localStorage.setItem('shop_lang', 'pt')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('pt')
  })

  it('ignores a stored value that is not a supported language', () => {
    // The browser says English on purpose. With 'pt-BR' here the expected value would be the one
    // the fallback produces anyway, and the test could not tell a rejected 'klingon' from an
    // `initialLang` that never reads storage at all — that case is the test above, and the two
    // guards have to be separable or neither is proved.
    browserLanguage('en-GB')
    localStorage.setItem('shop_lang', 'klingon')
    const { result } = renderHook(() => useLang(), { wrapper })
    expect(result.current.lang).toBe('en')
  })

  it('writes nothing on mount, so a visitor who never chooses keeps following the browser', () => {
    // The stored value means "the user chose this", never "the browser said this once". Writing a
    // sniffed language on mount would freeze the first visit's browser setting forever, and a
    // visitor who later switches their browser to Portuguese would keep getting English.
    browserLanguage('en-GB')
    renderHook(() => useLang(), { wrapper })
    expect(localStorage.getItem('shop_lang')).toBeNull()
  })

  it('toggles, persists, and actually changes the i18n instance', async () => {
    browserLanguage('pt-BR')
    const { result } = renderHook(() => useLang(), { wrapper })

    await act(async () => result.current.toggle())

    expect(result.current.lang).toBe('en')
    expect(localStorage.getItem('shop_lang')).toBe('en')
    // The two that matter: without the `changeLanguage` call the toggle flips a label and
    // translates nothing. They are not the same claim — an instance switched to a language it
    // does not ship renders English copy by falling back to the key, which passes the first and
    // fails the second — and the copy one comes first so that a mutation reddens it rather than
    // stopping the test one line earlier. `language`, not `resolvedLanguage`: see the hook.
    expect(copyI18n.t('Add to bag')).toBe('Add to bag')
    expect(copyI18n.language).toBe('en')
  })

  it('toggles back, so it is a flip and not a set', async () => {
    browserLanguage('pt-BR')
    const { result } = renderHook(() => useLang(), { wrapper })

    await act(async () => result.current.toggle())
    await act(async () => result.current.toggle())

    expect(result.current.lang).toBe('pt')
    expect(localStorage.getItem('shop_lang')).toBe('pt')
    // A one-way sync is a real failure shape: the user switches back and keeps reading English.
    expect(copyI18n.t('Add to bag')).toBe('Colocar na sacola')
  })

  it('drives the provided instance, not the imported singleton', async () => {
    browserLanguage('pt-BR')
    // Asserting on the same singleton the wrapper provides cannot distinguish a context read from
    // a hard-coded `import { copyI18n }`; a second instance can. Storybook already provides one
    // instance per locale, so this is the shape the hook will actually meet.
    const provided = createCopyInstance('pt')
    void provided.init()
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }: { children: ReactNode }) => <I18nextProvider i18n={provided}>{children}</I18nextProvider>,
    })

    await act(async () => result.current.toggle())

    expect(provided.language).toBe('en')
    expect(copyI18n.language).toBe('pt')
  })
})
