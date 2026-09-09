import '@testing-library/jest-dom/vitest'

// Node 25+ exposes a global Web Storage that shadows jsdom's, and it is inert unless node was
// started with --localstorage-file: the getter returns undefined and every `localStorage.setItem`
// throws. Inside the vitest jsdom environment `globalThis` IS the window, and the property it
// carries is node's accessor, so there is no jsdom Storage left to point the globals back at.
// Install a spec-shaped one instead. On node 22 (CI) the ambient storage works and the guard
// below leaves jsdom's own implementation alone.
class MemoryStorage {
  #entries = new Map<string, string>()

  get length(): number {
    return this.#entries.size
  }

  key(index: number): string | null {
    return Array.from(this.#entries.keys())[index] ?? null
  }

  getItem(key: string): string | null {
    return this.#entries.get(String(key)) ?? null
  }

  setItem(key: string, value: string): void {
    this.#entries.set(String(key), String(value))
  }

  removeItem(key: string): void {
    this.#entries.delete(String(key))
  }

  clear(): void {
    this.#entries.clear()
  }
}

for (const key of ['localStorage', 'sessionStorage'] as const) {
  if (typeof globalThis[key]?.setItem !== 'function') {
    Object.defineProperty(globalThis, key, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    })
  }
}
