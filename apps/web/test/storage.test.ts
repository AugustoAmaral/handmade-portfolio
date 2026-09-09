import { describe, expect, it } from 'vitest'

describe('jsdom storage', () => {
  it('exposes a working localStorage on the global object', () => {
    localStorage.setItem('probe', 'value')
    expect(localStorage.getItem('probe')).toBe('value')
    localStorage.clear()
    expect(localStorage.getItem('probe')).toBeNull()
  })

  it('works when reached through window, the way the i18n detector reads it', () => {
    window.localStorage.setItem('shared', '1')
    expect(localStorage.getItem('shared')).toBe('1')
    localStorage.clear()
  })
})
