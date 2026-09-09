import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `build.target` is pinned, not defaulted. Vite 6 defaulted to `"modules"`, which expands to
// exactly this list; Vite 7 defaults to `"baseline-widely-available"` — chrome107, edge107,
// firefox104, safari16 — so taking Vite 7 without this line would have quietly raised the shop's
// browser floor, dropping Chrome 87-106, Edge 88-106, Firefox 78-103 and Safari 14-15 (iOS 14 and
// iOS 15). Which browsers the shop runs in is a product decision; a dependency bump is not the
// place to make it. Raising this list is fine — deliberately, and on its own.
//
// Written out rather than as the `'modules'` alias so it says what it means and cannot shift under
// us the next time a bundler default moves.
//
// This pins the APP build only. Storybook and the story tests run on Vite 7's own defaults, so
// they compile for a slightly newer target than the app ships; harmless, since both execute in
// current Chromium either way.
const BROWSER_TARGET = ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: BROWSER_TARGET },
})
