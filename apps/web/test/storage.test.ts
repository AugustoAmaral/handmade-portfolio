import { describe, expect, it } from 'vitest'

describe('jsdom storage', () => {
  it('exposes a working localStorage on the global object', () => {
    localStorage.setItem('probe', 'value')
    expect(localStorage.getItem('probe')).toBe('value')
    localStorage.clear()
    expect(localStorage.getItem('probe')).toBeNull()
  })

  it('shares one storage between globalThis and window', () => {
    window.localStorage.setItem('shared', '1')
    expect(localStorage.getItem('shared')).toBe('1')
    localStorage.clear()
  })
})
