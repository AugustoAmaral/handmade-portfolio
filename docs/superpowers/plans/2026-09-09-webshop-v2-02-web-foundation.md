# Webshop v2 — PR 2: Web foundation (`feat/v2-web-foundation`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the foundation the v2 frontend is built on — design tokens, a dedicated i18n instance keyed by English sentences, route href builders, typed fixtures, a Storybook that runs its own stories as tests, and the architecture rules that keep the UI layer pure — without disturbing the v1 app that is still serving production.

**Architecture:** Everything new lands in three new folders under `apps/web/src`: `ui/` (pure, props-in/JSX-out), `copy/` (a dedicated i18next instance plus `pt.json`), and `fixtures/` (typed sample data shared by stories and tests). The v1 app (`src/pages`, `src/components`, `src/lib`, `src/i18n`) is left untouched and keeps compiling and passing its tests; it is deleted in PR 3, when the pages that replace it exist. Vitest gains two projects: `unit` (jsdom, the existing tests plus the new architecture tests) and `storybook` (real Chromium via Playwright, running every story as a test).

**Tech Stack:** Storybook 10.6 (`@storybook/react-vite`, `@storybook/addon-vitest`, `@storybook/addon-a11y`), Vitest 3.2.7 with `@vitest/browser` and the Playwright provider, React 18.3, Vite 7, Tailwind 4 (`@theme`), react-i18next 15 / i18next 24 (already installed), TypeScript 5.9.

**Spec:** `docs/superpowers/specs/2026-09-07-webshop-v2-design.md` (sections "Frontend" and "Storybook and testing"). This plan is PR 2 of 5; PR 1 (`feat/v2-api-domain`) is merged into `docs/v2-design`.

## Global Constraints

- Branch `feat/v2-web-foundation` is created from `docs/v2-design` and its PR targets `docs/v2-design`.
- **The v1 app keeps working.** `apps/web/src/{App.tsx,main.tsx,components,i18n,lib,pages}` and `apps/web/test/*` are not deleted or rewritten in this PR. Only two v1 files may be edited, additively: `apps/web/src/index.css` (tokens appended) and `apps/web/index.html` (font links added). `apps/web/test/setup.ts` gains the Node 26 storage fix (Task 3). Everything else new goes in new files.
- **Deviation from the spec, deliberate:** the spec's PR 2 wipes `apps/web/src`. Doing that here would leave the stack without a compilable app between PR 2 and PR 3 and break `npm run build` and the e2e suite on this branch. The wipe moves to PR 3, which brings the pages that replace the v1 ones. The spec's `src/i18n/` for the new instance becomes `src/copy/` to avoid colliding with the v1 `src/i18n/`; `src/copy/` is the permanent home.
- `src/ui/**` is pure: it may import React, `react-i18next`, `@shop/shared`, and other `src/ui` files. It may NOT import `react-router`, `@tanstack/react-query`, anything from `src/app`, `src/lib`, `src/pages`, `src/components`, or touch `window`, `document`, `localStorage`, `sessionStorage`, or `fetch`. Task 8's test enforces this.
- i18n keys ARE the English sentence: `t('Add to bag')`. Only `pt.json` is maintained. `keySeparator: false`, `nsSeparator: false`, `fallbackLng: false`, `returnNull: false`.
- Design tokens (exact values): `--color-paper: #f4f0e6`, `--color-paper-2: #efe9db`, `--color-paper-3: #e6dfcd`, `--color-ink: #1a1713`, `--color-accent: #a63d20`; fonts `--font-display: 'Instrument Serif', Georgia, serif`, `--font-body: Newsreader, Georgia, serif`, `--font-mono: 'IBM Plex Mono', ui-monospace, monospace`.
- Prices are integer BRL cents; formatting always goes through `formatPrice(cents, lang)` from `@shop/shared`.
- Dependency installs ARE allowed in this PR (unlike PR 1). Install with `npm i -D -w @shop/web <pkg>` from the repo root so the workspace lockfile stays consistent. Pin the majors given in Task 1.
- Run vitest with `NODE_OPTIONS=--max-old-space-size=4096`. The machine guardrail (`pool: 'forks'`, `minForks: 1`, `maxForks: 2`) moves from the npm script into the `unit` project's config (Task 4) — do not drop it. After a run, check orphans: `ps ax -o pid,ppid,command | grep -i vitest | grep -v grep`, kill any with ppid 1.
- Commits in English, conventional-commit noun-phrase subjects (repo convention), no trailers (no `Co-Authored-By`, no `Claude-Session`).
- Code, comments, tests and story names in English.

---

## File map

**New — `apps/web/src/copy/`**
- `i18n.ts` — a dedicated i18next instance (`createInstance`), never the global singleton the v1 app initialises.
- `pt.json` — the pt-BR translations, keyed by the English sentence.

**New — `apps/web/src/ui/`**
- `routes.ts` — href builders (`routes.home()`, `routes.product(slug)`, …).
- `primitives/` — `PillButton`, `Eyebrow`, `FieldLabel`, `TextInput`, `TextArea`, `Select`, `RuledList`, `Stepper`, `Price`, `Stat`, `StatusPill`, `ImageFrame`, `LangToggle`, each with a colocated `*.stories.tsx`.

**New — `apps/web/src/fixtures/`**
- `products.ts`, `orders.ts`, `checkout.ts` — typed with `@shop/shared`.

**New — `apps/web/.storybook/`**
- `main.ts`, `preview.tsx`, `vitest.setup.ts`.

**Modified**
- `apps/web/package.json` — devDependencies, `storybook` / `build-storybook` scripts, `test` script simplified.
- `apps/web/vitest.config.ts` — two projects (`unit`, `storybook`).
- `apps/web/src/index.css` — `@theme` block appended.
- `apps/web/index.html` — Google Fonts links.
- `apps/web/test/setup.ts` — Node 26 Web Storage fix.
- `apps/web/tsconfig.json` — include `.storybook`.
- `.github/workflows/ci.yml` — Chromium install and `build-storybook` in the `test` job.

**New tests — `apps/web/test/`**
- `storage.test.ts`, `copy.test.ts`, `routes.test.ts`, `fixtures.test.ts`, `ui-boundaries.test.ts`.

---

### Task 1: Dependencies and Storybook skeleton

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/.storybook/main.ts`, `apps/web/.storybook/preview.tsx`
- Modify: `apps/web/tsconfig.json`

**Interfaces:**
- Produces: `npm run storybook -w @shop/web` (dev server) and `npm run build-storybook -w @shop/web` (static build) both work against an empty story set.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/augustopereira/dev/handmade-portfolio
git switch docs/v2-design && git pull --ff-only
git switch -c feat/v2-web-foundation
```

- [ ] **Step 2: Install the dependencies**

```bash
npm i -D -w @shop/web storybook@^10.6.0 @storybook/react-vite@^10.6.0 @storybook/addon-vitest@^10.6.0 @storybook/addon-a11y@^10.6.0 @vitest/browser@^3.2.7
```

Expected: installs cleanly. `@storybook/addon-vitest@10.6` declares peers `vitest@^3.0.0 || ^4.0.0` and `@vitest/browser@^3.0.0 || ^4.0.0`; the repo is on vitest 3.2.7 and playwright 1.62.1, so no peer warnings should appear about those. If npm reports a peer conflict, STOP and report it — do not resolve it with `--force` or `--legacy-peer-deps`.

- [ ] **Step 3: Add the scripts**

In `apps/web/package.json`, add to `scripts`:

```json
    "storybook": "storybook dev -p 6006 --no-open",
    "build-storybook": "storybook build",
```

Leave the existing `test` script alone for now (Task 4 rewrites it).

- [ ] **Step 4: Write the Storybook config**

Create `apps/web/.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
}

export default config
```

Create `apps/web/.storybook/preview.tsx` (the decorators arrive in Tasks 2 and 5; this is the minimum that builds):

```tsx
import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
  },
}

export default preview
```

- [ ] **Step 5: Let TypeScript see the config folder**

In `apps/web/tsconfig.json`, change `"include": ["src", "test"]` to `"include": ["src", "test", ".storybook"]`.

- [ ] **Step 6: Verify the build**

Run: `npm run build-storybook -w @shop/web`
Expected: completes and writes `apps/web/storybook-static`. A warning about finding no stories is fine at this point. Then confirm the output folder is ignored by git — `git status --short` must not list `apps/web/storybook-static`. If it does, add `storybook-static/` to the root `.gitignore` in this same commit.

Run: `npm run typecheck -w @shop/web`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/.storybook package-lock.json .gitignore
git commit -m "chore(web): storybook 10 skeleton with vitest and a11y addons"
```

---

### Task 2: Design tokens and fonts

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/index.html`
- Modify: `apps/web/.storybook/preview.tsx`

**Interfaces:**
- Produces: Tailwind utilities `bg-paper`, `bg-paper-2`, `bg-paper-3`, `text-ink`, `text-accent`, `border-ink`, `font-display`, `font-body`, `font-mono`, available to `src/ui` and to Storybook.

- [ ] **Step 1: Add the tokens**

Replace `apps/web/src/index.css` with:

```css
@import 'tailwindcss';

/* v2 design tokens (paper/ink palette from the approved prototype). The v1 app still uses
   Tailwind's stock stone-* utilities; these are additive and do not change it. */
@theme {
  --color-paper: #f4f0e6;
  --color-paper-2: #efe9db;
  --color-paper-3: #e6dfcd;
  --color-ink: #1a1713;
  --color-accent: #a63d20;

  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: Newsreader, Georgia, serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
```

- [ ] **Step 2: Load the fonts**

In `apps/web/index.html`, inside `<head>` and before the existing `<title>`, add:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 3: Load the stylesheet and fonts in Storybook**

Replace `apps/web/.storybook/preview.tsx` with:

```tsx
import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

// Storybook renders stories in its own iframe, so the fonts the app loads from index.html have
// to be requested here as well.
const fonts = document.createElement('link')
fonts.rel = 'stylesheet'
fonts.href =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap'
document.head.appendChild(fonts)

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true },
  },
  decorators: [
    (Story) => (
      <div className="bg-paper text-ink font-body p-6">
        <Story />
      </div>
    ),
  ],
}

export default preview
```

- [ ] **Step 4: Verify**

Run: `npm run build -w @shop/web`
Expected: the v1 app still builds (the tokens are additive).

Run: `npm run build-storybook -w @shop/web`
Expected: builds; the preview compiles with the decorator.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/index.css apps/web/index.html apps/web/.storybook/preview.tsx
git commit -m "feat(web): paper and ink design tokens with the prototype's fonts"
```

---

### Task 3: Node 26 storage fix in the jsdom setup

**Files:**
- Modify: `apps/web/test/setup.ts`
- Test: `apps/web/test/storage.test.ts`

**Interfaces:**
- Produces: `localStorage` and `sessionStorage` work inside jsdom tests on any Node version, so `npm test -w @shop/web` needs no special flags.

Background: Node 25+ ships a global Web Storage. In a jsdom environment that global shadows `window.localStorage`, and because it is inert unless Node was started with `--localstorage-file`, `localStorage.setItem` throws `TypeError: Cannot read properties of undefined`. This machine runs Node 26; CI runs Node 22 and never saw it.

Amended 2026-09-09 after the first implementation attempt disproved this section's original fix. Two things were measured inside the running vitest jsdom environment: `globalThis === window` (so the original guard `globalThis[key] !== window[key]` compared `undefined` with itself and never fired), and the single shared `localStorage` property is Node's own `internal/webstorage` accessor rather than jsdom's — vitest's jsdom environment never got to install its `Storage`, so there is nothing on the window to point the globals back at. The property is `configurable: true`, so redefining it works; only the source value was missing. The fix therefore installs a small spec-shaped `Storage` instead of copying one, and stays behind a capability guard so CI on Node 22 keeps using jsdom's real implementation.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/storage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- test/storage.test.ts`
Expected on Node 25+: FAIL with `Cannot read properties of undefined (reading 'setItem')` or similar. On Node 22 it passes already — if it passes, say so in your report and continue; the fix is still required for this machine.

- [ ] **Step 3: Implement**

Replace `apps/web/test/setup.ts` with:

```ts
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
```

- [ ] **Step 4: Verify**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web`
Expected: PASS, including the v1 suite that was failing on this machine (14 v1 tests + the 2 new ones), with no extra Node flags.

Run: `npm run typecheck -w @shop/web` (or the repo's typecheck script)
Expected: clean — `MemoryStorage` deliberately does not declare `implements Storage`, because the DOM `Storage` interface carries a string index signature a class cannot satisfy.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/setup.ts apps/web/test/storage.test.ts
git commit -m "fix(web): working web storage in jsdom tests on node 25 and later"
```

---

### Task 4: Vitest projects — unit and storybook

**Files:**
- Modify: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/.storybook/vitest.setup.ts`

**Interfaces:**
- Consumes: `.storybook/main.ts`, `.storybook/preview.tsx` (Tasks 1–2).
- Produces: `npm test -w @shop/web` runs both projects; `npm test -w @shop/web -- --project unit` runs the jsdom suite alone. Until the first story lands in Task 9, `--project storybook` alone resolves to zero test files and needs `--passWithNoTests` on the command line; from Task 9 on it works bare.

Amended 2026-09-09, after the first implementation measured two things this section had assumed wrong.

First: vitest's "no test files" check is run-level, not per-project. The full run passes because the `unit` project supplies files, but `--project storybook` on its own exits 1 while no stories exist. `passWithNoTests` is a `NonProjectOptions` entry in vitest 3.2.7, so it cannot be scoped to the storybook project — setting it would apply to the whole run and would silently green-light a vanished unit suite. It is therefore NOT set in the config; the interim selector passes the flag on the command line instead, and the need disappears at Task 9.

Second: Storybook 10.6's vitest addon injects a virtual setup module that supplies the preview annotations of every addon in `main.ts` — but it skips that injection when it finds the literal `setProjectAnnotations` in a user setup file. A setup file that calls it manually with only `./preview` therefore silences `@storybook/addon-a11y` in the test runs, which defeats the accessibility half of the Storybook strategy. The setup file below composes the addon's annotations explicitly. `@storybook/addon-vitest` exports no `/preview` entry point and contributes none, so a11y plus the project preview is the complete set.

- [ ] **Step 1: Write the Storybook test setup**

Create `apps/web/.storybook/vitest.setup.ts`:

```ts
import * as a11yAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react-vite'
import * as previewAnnotations from './preview'

// Gives every story-as-test the decorators, parameters and globals from preview.tsx, plus the
// a11y addon's own annotations. Storybook's vitest addon would inject these itself, but it skips
// that as soon as a setup file calls setProjectAnnotations — so anything listed in main.ts that
// ships a `/preview` entry point has to be composed here by hand. Order matters: the project's
// own preview goes last so it wins.
setProjectAnnotations([a11yAnnotations, previewAnnotations])
```

Storybook prints an info box on every run saying this file is obsolete. That is the same
injection-skip described above, and it is expected as long as the file exists.

If `setProjectAnnotations` is not exported from `@storybook/react-vite` in the installed version, check `node_modules/@storybook/react-vite/dist/index.d.ts` for the right entry point and use that; report what you used.

- [ ] **Step 2: Configure the two projects**

Replace `apps/web/vitest.config.ts` with:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    // Machine guardrail: this Mac has taken itself down with runaway vitest workers. These are
    // root-only options — vitest builds ONE pool per run from the root config (createForksPool
    // reads `vitest.config.poolOptions.forks`), so the same settings nested inside a project are
    // silently ignored. At the root they also cap the browser project, which has no pool of its
    // own and would otherwise open one Chromium context per story file.
    maxWorkers: 2,
    minWorkers: 1,
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          include: ['test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['test/setup.ts'],
          pool: 'forks',
        },
      },
      {
        plugins: [react(), storybookTest({ configDir: path.join(dirname, '.storybook') })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
})
```

No `passWithNoTests` anywhere — see the amendment note above.

Amended again 2026-09-09 (third amendment), after the review measured that the guardrail this plan had moved off the command line was not actually in force. `apps/web/package.json` used to run `vitest --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2`, which applied globally; nesting the same options inside the `unit` project looks equivalent and typechecks, and the resolved project config even echoes the values back — but the pool is built once per run from the ROOT config. Measured with vitest's Node API on this machine: root `poolOptions` resolved to `{"threads":{},"forks":{}}` and root `maxWorkers`/`minWorkers` to `undefined`, so `maxThreads` fell through to `numCpus - 1` = 10 forks. Confirmed in the source: `createForksPool` reads `vitest.config.poolOptions?.forks`, never the project's. `maxWorkers`, `minWorkers` and `fileParallelism` are all `NonProjectOptions`, exactly like `passWithNoTests`. The guardrail therefore lives at the root, where it also covers the browser project.

- [ ] **Step 3: Simplify the test script**

In `apps/web/package.json`, replace the `test` script with:

```json
    "test": "vitest run",
```

The pool flags moved into the `unit` project above; passing them on the CLI would also hit the browser project, which does not use a worker pool.

- [ ] **Step 4: Verify both projects run**

Chromium is already installed on this machine; run `npx playwright install chromium` only if a run reports it missing.

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web`
Expected: exit 0. The `unit` project runs the existing tests and passes; the `storybook` project contributes zero files and, because the run as a whole is not empty, is simply not reported. With no stories it never starts a browser.

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit`
Expected: exit 0, the same jsdom tests.

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project storybook --passWithNoTests`
Expected: exit 0 with `No test files found`. Without the flag this exits 1, which is correct behaviour and not a defect.

Then prove the guardrail is actually in force rather than merely present in the file — this is the check whose absence let it go inert. Drive vitest's Node API and print the RESOLVED ROOT config:

```
node --input-type=module -e "
import { createVitest } from 'vitest/node'
const v = await createVitest('test', { watch: false })
console.log('root maxWorkers', v.config.maxWorkers, 'minWorkers', v.config.minWorkers)
console.log('root poolOptions', JSON.stringify(v.config.poolOptions))
await v.close()
"
```

Expected: `maxWorkers 2`, `minWorkers 1`, and root `poolOptions` carrying `forks: {minForks:1,maxForks:2}` — not the empty `{"threads":{},"forks":{}}` that proved the bug.

- [ ] **Step 5: Prove the browser chain before handing it to Tasks 9–10**

Zero stories means none of the browser path is exercised, so verify it with a throwaway story that is created, run, and deleted — it must NOT be committed, and `git status` must be clean afterwards.

Write a minimal `apps/web/src/probe.stories.tsx` rendering one element, with a `play` function that asserts something about it, then run the storybook project against it and confirm:

1. real headless Chromium starts through the Playwright provider and the story runs;
2. the `preview.tsx` decorator reaches story-tests (assert on the `bg-paper` wrapper);
3. `@storybook/addon-a11y` actually runs — this is what the amended setup file is for, so prove it rather than assume it;
4. which import path works for `expect`/`userEvent` (`storybook/test` vs `@storybook/test`), and report it, because Task 9 depends on the answer.

Then delete the probe file and report all four results.

Check orphans afterwards: `ps ax -o pid,ppid,command | grep -i vitest | grep -v grep`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json apps/web/.storybook/vitest.setup.ts
git commit -m "chore(web): vitest projects for jsdom units and browser stories"
```

---

### Task 5: The copy instance and the i18n decorator

**Files:**
- Create: `apps/web/src/copy/i18n.ts`, `apps/web/src/copy/pt.json`
- Modify: `apps/web/.storybook/preview.tsx`
- Test: `apps/web/test/copy.test.ts`

**Interfaces:**
- Produces: `createCopyInstance()` and the default `copyI18n` export from `src/copy/i18n.ts`; a Storybook toolbar global `locale` (`en` | `pt`) that selects which initialised instance the decorator provides.

Amended 2026-09-09 after review, on three measured findings.

`initReactI18next` is no longer registered. The plugin's `init(instance)` calls react-i18next's `setI18n`, which writes a module-level default; since i18next runs external modules during `init()`, whichever instance initialises LAST owns every bare `useTranslation()` in the app. Proved by probe: react-i18next's default was the v1 singleton before `copyI18n.init()` and this instance after it, and no file under `apps/web/src` uses `I18nextProvider`, so v1 would have rendered raw `nav.about`-style keys. The decorator provides the instance explicitly and `useTranslation` reads props → context → default, so nothing needs the global. Task 8's boundary test also gained `../i18n` to keep `src/ui` from importing the v1 singleton and re-triggering this from inside the Storybook iframe.

The decorator keeps one initialised instance per language instead of calling `changeLanguage` in an effect. The effect version was measured painting the previous language for one commit before switching, which is invisible today only because `initialGlobals.locale` and the instance's own language agree; it would surface the moment a story sets `globals: { locale: 'en' }`, and the story rendering after it would inherit the flip through the shared instance.

Two of the copy assertions were vacuous: i18next 24 only splits keys it does not consider "natural language", so a key with spaces survives even with the separators at their defaults. The test now asserts the resolved options directly and uses a colon key with no spaces, which is the shape that actually fails when `nsSeparator` is on.

Note for PR 3: the app root must wrap the tree in `I18nextProvider` with an initialised instance, exactly as this decorator does. There is no global default to fall back on any more, and that is deliberate — a missing provider fails loudly instead of silently resolving against whatever initialised last.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/copy.test.ts`:

```ts
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

  it('never becomes react-i18next\'s default instance', async () => {
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit test/copy.test.ts`
Expected: FAIL — cannot find module `../src/copy/i18n`.

- [ ] **Step 3: Implement**

Create `apps/web/src/copy/pt.json`:

```json
{
  "Add to bag": "Colocar na sacola",
  "Your bag is empty.": "A sacola está vazia.",
  "Ship to: Brazil": "Enviar para: Brasil",
  "{{count}} in stock": "{{count}} em estoque",
  "Decrease quantity": "Diminuir quantidade",
  "Increase quantity": "Aumentar quantidade",
  "Awaiting payment": "Aguardando pagamento",
  "In production": "Em produção",
  "Shipped": "Enviado",
  "Insufficient stock": "Estoque insuficiente",
  "Expired": "Expirado",
  "Made to order": "Sob encomenda",
  "Sold out": "Esgotado",
  "Photo of {{name}}": "Foto de {{name}}",
  "No photo yet": "Ainda sem foto"
}
```

Create `apps/web/src/copy/i18n.ts`:

```ts
import i18next, { type i18n as I18n } from 'i18next'
import pt from './pt.json'

export type Lang = 'pt' | 'en'
export const LANGS: readonly Lang[] = ['pt', 'en']

/**
 * A dedicated instance rather than the i18next singleton: the v1 app still initialises the
 * global one with its own (dotted-key) resources, and the two must not fight. Keys here are
 * the English sentence itself, so English needs no resource bundle — a missing key renders
 * as the key.
 *
 * Deliberately NOT wired with `initReactI18next`: that plugin makes whichever instance calls
 * `init()` last react-i18next's module-level default, which would hand this instance every bare
 * `useTranslation()` in the app — including v1's, whose dotted keys it cannot resolve. Consumers
 * get it through `I18nextProvider` instead, which `useTranslation` reads before the default.
 */
export function createCopyInstance(lang: Lang = 'pt'): I18n {
  return i18next.createInstance({
    lng: lang,
    resources: { pt: { translation: pt } },
    supportedLngs: [...LANGS],
    fallbackLng: false,
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  })
}

export const copyI18n = createCopyInstance('pt')

// Initialised on creation: an exported-but-uninitialised instance is a trap, because `t()` on it
// returns undefined silently rather than throwing. Synchronous here — inline resources, no
// backend, no async detector.
void copyI18n.init()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit test/copy.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Wire the decorator and the toolbar**

In `apps/web/.storybook/preview.tsx`, add the imports and replace the `preview` object:

```tsx
import { I18nextProvider } from 'react-i18next'
import { type Lang, createCopyInstance } from '../src/copy/i18n'
```

```tsx
const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true },
    // The a11y addon ships `test: 'todo'`, which reports violations in the panel but never fails
    // a run. Wiring the addon into the vitest project is only half the job; this is the half that
    // makes an axe violation a red test.
    a11y: { test: 'error' },
  },
  globalTypes: {
    locale: {
      description: 'Copy language',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'pt', title: 'Português' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'pt' },
  decorators: [
    (Story, context) => {
      const locale = (context.globals.locale as Lang) ?? 'pt'
      return (
        <I18nextProvider i18n={copyFor(locale)} defaultNS="translation">
          <div className="bg-paper text-ink font-body p-6">
            <Story />
          </div>
        </I18nextProvider>
      )
    },
  ],
}
```

An instance is created but not initialised, and until `init()` runs `t()` returns undefined and
`changeLanguage()` throws. Rather than initialising one shared instance and mutating its language,
keep one initialised instance per language and swap which one the provider gets — add right after
the imports:

```tsx
// One initialised instance per language, created on first use. Swapping instances instead of
// mutating a shared one means a story paints in the right language on its FIRST frame (an effect
// would only fix it on the second) and no story can leak a language into the story after it.
// `init()` completes synchronously here because the resources are inline and there is no backend
// or async detector; if either is ever added, this has to be awaited before the first render.
const instances = new Map<Lang, ReturnType<typeof createCopyInstance>>()

function copyFor(locale: Lang) {
  let instance = instances.get(locale)
  if (!instance) {
    instance = createCopyInstance(locale)
    void instance.init()
    instances.set(locale, instance)
  }
  return instance
}
```

If `initialGlobals` is not supported by the installed Storybook version, use `globalTypes.locale.defaultValue = 'pt'` instead and note it in your report.

- [ ] **Step 6: Verify**

Run: `npm run build-storybook -w @shop/web` — expected: builds.
Run: `npm run typecheck -w @shop/web` — expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/copy apps/web/.storybook/preview.tsx apps/web/test/copy.test.ts
git commit -m "feat(web): dedicated copy instance keyed by english sentences"
```

---

### Task 6: Route href builders

**Files:**
- Create: `apps/web/src/ui/routes.ts`
- Test: `apps/web/test/routes.test.ts`

**Interfaces:**
- Produces: `routes` with `home()`, `product(slug)`, `about()`, `checkout()`, `thanks(orderNumber, sessionId)`, `admin()`, `adminProducts()`, `adminNewProduct()`, `adminProduct(id)`, `adminOrders(selectedId?)`, and `mailto(to, subject, body?)`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { routes } from '../src/ui/routes'

describe('routes', () => {
  it('builds the shop paths', () => {
    expect(routes.home()).toBe('/')
    expect(routes.about()).toBe('/about')
    expect(routes.checkout()).toBe('/checkout')
    expect(routes.product('carta-escrita')).toBe('/exhibit/carta-escrita')
  })

  it('encodes slugs and ids that need it', () => {
    expect(routes.product('a b/c')).toBe('/exhibit/a%20b%2Fc')
    expect(routes.adminProduct('id/1')).toBe('/admin/products/id%2F1')
  })

  it('builds the thank-you url with order and session', () => {
    expect(routes.thanks(413, 'cs_test_1')).toBe('/thanks?order=413&session_id=cs_test_1')
    expect(routes.thanks(413, 'cs+test/1')).toBe('/thanks?order=413&session_id=cs%2Btest%2F1')
  })

  it('builds the admin paths, with an optional selected order', () => {
    expect(routes.admin()).toBe('/admin')
    expect(routes.adminProducts()).toBe('/admin/products')
    expect(routes.adminNewProduct()).toBe('/admin/products/new')
    expect(routes.adminOrders()).toBe('/admin/orders')
    expect(routes.adminOrders('abc')).toBe('/admin/orders?order=abc')
  })

  it('builds a mailto with an encoded subject and body', () => {
    expect(routes.mailto('a@b.com', 'Pedido #MHP-0413')).toBe('mailto:a@b.com?subject=Pedido%20%23MHP-0413')
    expect(routes.mailto('a@b.com', 'S', 'line one')).toBe('mailto:a@b.com?subject=S&body=line%20one')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit test/routes.test.ts`
Expected: FAIL — cannot find module `../src/ui/routes`.

- [ ] **Step 3: Implement**

Create `apps/web/src/ui/routes.ts`:

```ts
/**
 * Every link in the UI layer is a real <a href>; these builders are the only place paths are
 * spelled out. A single click handler at the app root upgrades same-origin anchors to
 * client-side navigation, so UI components never import the router.
 */
const q = encodeURIComponent

export const routes = {
  home: () => '/',
  about: () => '/about',
  checkout: () => '/checkout',
  product: (slug: string) => `/exhibit/${q(slug)}`,
  thanks: (orderNumber: number, sessionId: string) => `/thanks?order=${orderNumber}&session_id=${q(sessionId)}`,
  admin: () => '/admin',
  adminProducts: () => '/admin/products',
  adminNewProduct: () => '/admin/products/new',
  adminProduct: (id: string) => `/admin/products/${q(id)}`,
  adminOrders: (selectedId?: string) => (selectedId ? `/admin/orders?order=${q(selectedId)}` : '/admin/orders'),
  mailto: (to: string, subject: string, body?: string) =>
    `mailto:${to}?subject=${q(subject)}${body ? `&body=${q(body)}` : ''}`,
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit test/routes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/routes.ts apps/web/test/routes.test.ts
git commit -m "feat(web): route href builders for the ui layer"
```

---

### Task 7: Typed fixtures

**Files:**
- Create: `apps/web/src/fixtures/products.ts`, `apps/web/src/fixtures/orders.ts`, `apps/web/src/fixtures/checkout.ts`
- Test: `apps/web/test/fixtures.test.ts`

**Interfaces:**
- Consumes: `PublicProduct`, `AdminOrder`, `PublicOrder`, `CheckoutRequest`, `checkoutRequestSchema`, `checkoutRules`, `computeTotals` from `@shop/shared`.
- Produces: `letter`, `drawing`, `soldOutDrawing`, `digitalLetter`, `inactiveGuide`, `products` (the active four), `productWithoutPhotos` from `products.ts`; `pendingOrder`, `paidOrder`, `shippedOrder`, `oversoldOrder`, `expiredOrder`, `adminOrders` (all five states), `publicPaidOrder` from `orders.ts`; `emptyCheckout`, `brCheckout`, `intlCheckout`, `digitalCheckout`, `incompleteBrCheckout`, `brCheckoutErrors`, `cartLines` from `checkout.ts`.

Amended 2026-09-09 after the first implementation, on three defects it surfaced in its own report rather than hiding.

`brCheckoutErrors` was hand-written and did not match what the app will actually receive. `apps/api/src/routes/checkout.ts:36-37` feeds `checkoutRules(...)` straight into the 400 response, so that object is exactly the function's output: the fixture's `buyer.name` key can never appear in it (zod rejects the buyer earlier, separately), and `shippingAddress.district` and `shippingAddress.state` — which the rules DO emit for an incomplete BR address — were missing. PR 3 would have built its error UI against a shape the API never sends. It is now derived from the real function, with the input kept beside it.

`productWithoutPhotos` was an alias of `soldOutDrawing` — the same object, also a member of `products`. Two names for one object is a mutation trap for stories, and it welded together two unrelated scenarios. It is now its own product.

`adminOrders` covered four of the five lifecycle states; `expired` had no fixture at all, so a status pill would have gone unrendered by every story.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/fixtures.test.ts`:

```ts
import { checkoutRequestSchema, checkoutRules, computeTotals } from '@shop/shared'
import { describe, expect, it } from 'vitest'
import { brCheckout, cartLines, digitalCheckout, intlCheckout } from '../src/fixtures/checkout'
import { adminOrders } from '../src/fixtures/orders'
import { products } from '../src/fixtures/products'

describe('fixtures', () => {
  it('ships four active products, one of them featured and one sold out', () => {
    expect(products).toHaveLength(4)
    expect(products.every((p) => p.active)).toBe(true)
    expect(products.filter((p) => p.featured)).toHaveLength(1)
    expect(products.some((p) => p.stock === 0)).toBe(true)
  })

  it('offers checkout values the real schema and rules accept', () => {
    for (const values of [brCheckout, intlCheckout, digitalCheckout]) {
      const parsed = checkoutRequestSchema.parse(values)
      const hasPhysical = values !== digitalCheckout
      expect(checkoutRules(parsed, hasPhysical)).toBeNull()
    }
  })

  it('has cart lines whose totals add up', () => {
    const totals = computeTotals(cartLines, 'sedex')
    expect(totals.itemsCents).toBeGreaterThan(0)
    expect(totals.totalCents).toBe(totals.itemsCents + totals.shippingCents)
  })

  it('covers every admin order status', () => {
    expect(new Set(adminOrders.map((o) => o.status))).toEqual(new Set(['pending', 'paid', 'shipped', 'oversold']))
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit test/fixtures.test.ts`
Expected: FAIL — cannot find the fixture modules.

- [ ] **Step 3: Implement the product fixtures**

Create `apps/web/src/fixtures/products.ts`:

```ts
import type { PublicProduct } from '@shop/shared'

// Sample data for stories and tests. Content mirrors the approved prototype's catalogue.
export const letter: PublicProduct = {
  id: 'p-letter',
  slug: 'carta-escrita',
  name: { pt: 'Carta escrita à mão', en: 'Handwritten letter' },
  subtitle: { pt: 'Papel algodão · 2 folhas', en: 'Cotton paper · 2 sheets' },
  description: {
    pt: 'Você me diz o assunto e para quem é. Eu escrevo à mão, em tinta preta, e mando pelo correio.',
    en: 'You tell me the subject and who it is for. I write it by hand in black ink and post it.',
  },
  priceCents: 4500,
  type: 'physical',
  stock: null,
  specs: [
    { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5, 2 folhas', en: 'A5, 2 sheets' } },
    { key: { pt: 'Papel', en: 'Paper' }, value: { pt: 'Algodão 180g', en: '180gsm cotton' } },
    { key: { pt: 'Prazo', en: 'Lead time' }, value: { pt: '5 dias úteis', en: '5 business days' } },
  ],
  photos: [
    { key: 'products/letter/1.webp', url: 'https://img.example.com/products/letter/1.webp', alt: { pt: 'Carta sobre a mesa', en: 'Letter on a table' } },
    { key: 'products/letter/2.webp', url: 'https://img.example.com/products/letter/2.webp', alt: { pt: 'Detalhe da tinta', en: 'Ink detail' } },
  ],
  featured: true,
  active: true,
}

export const drawing: PublicProduct = {
  id: 'p-drawing',
  slug: 'desenho-nanquim',
  name: { pt: 'Desenho a nanquim', en: 'India ink drawing' },
  subtitle: { pt: 'A5 · original', en: 'A5 · original' },
  description: {
    pt: 'Desenho original em nanquim sobre papel de algodão. Não é impressão.',
    en: 'An original India ink drawing on cotton paper. Not a print.',
  },
  priceCents: 12000,
  type: 'physical',
  stock: 4,
  specs: [{ key: { pt: 'Peça', en: 'Edition' }, value: { pt: 'Original, única', en: 'One of one' } }],
  photos: [
    { key: 'products/drawing/1.webp', url: 'https://img.example.com/products/drawing/1.webp', alt: { pt: '', en: '' } },
  ],
  featured: false,
  active: true,
}

export const soldOutDrawing: PublicProduct = {
  ...drawing,
  id: 'p-portrait',
  slug: 'retrato-lapis',
  name: { pt: 'Retrato a lápis', en: 'Pencil portrait' },
  subtitle: { pt: 'A4 · sob encomenda', en: 'A4 · made to order' },
  priceCents: 18000,
  stock: 0,
  photos: [],
}

export const digitalLetter: PublicProduct = {
  id: 'p-digital',
  slug: 'carta-digital',
  name: { pt: 'Carta digital', en: 'Digital letter' },
  subtitle: { pt: 'Escaneada · por e-mail', en: 'Scanned · by e-mail' },
  description: {
    pt: 'A mesma carta à mão, escaneada e enviada por e-mail.',
    en: 'The same handwritten letter, scanned and emailed to you.',
  },
  priceCents: 2000,
  type: 'digital',
  stock: null,
  specs: [],
  photos: [],
  featured: false,
  active: true,
}

export const inactiveGuide: PublicProduct = {
  ...digitalLetter,
  id: 'p-guide',
  slug: 'guia-nanquim-pdf',
  name: { pt: 'Guia de nanquim (PDF)', en: 'India ink guide (PDF)' },
  subtitle: { pt: 'Download · 24 páginas', en: 'Download · 24 pages' },
  priceCents: 1800,
  active: false,
}

// Its own object, deliberately not an alias of `soldOutDrawing`: two named fixtures pointing at
// one object let a story that mutates one corrupt the other, and it also conflates two separate
// scenarios — a story about the missing-photo placeholder should not silently also be testing
// the sold-out state.
export const productWithoutPhotos: PublicProduct = {
  ...letter,
  id: 'p-no-photo',
  slug: 'caderno-costurado',
  name: { pt: 'Caderno costurado', en: 'Hand-sewn notebook' },
  subtitle: { pt: 'A5 · 80 páginas', en: 'A5 · 80 pages' },
  photos: [],
}
export const products: PublicProduct[] = [letter, drawing, soldOutDrawing, digitalLetter]
```

- [ ] **Step 4: Implement the order fixtures**

Create `apps/web/src/fixtures/orders.ts`:

```ts
import type { AdminOrder, PublicOrder } from '@shop/shared'

const items: AdminOrder['items'] = [
  { productId: 'p-letter', slug: 'carta-escrita', name: { pt: 'Carta escrita à mão', en: 'Handwritten letter' }, qty: 1, unitAmountCents: 4500 },
  { productId: 'p-drawing', slug: 'desenho-nanquim', name: { pt: 'Desenho a nanquim', en: 'India ink drawing' }, qty: 2, unitAmountCents: 12000 },
]

export const pendingOrder: AdminOrder = {
  id: 'o-1',
  orderNumber: 410,
  status: 'pending',
  createdAt: '2026-09-01T12:00:00.000Z',
  buyer: { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' },
  shippingAddress: {
    country: 'BR',
    postalCode: '30150-904',
    street: 'Rua Sapucaí',
    number: '388',
    complement: 'ap. 51',
    district: 'Floresta',
    city: 'Belo Horizonte',
    state: 'MG',
  },
  shippingMethod: 'pac',
  notes: 'A carta é para minha avó, aniversário de 80 anos.',
  locale: 'pt',
  items: [items[0]!],
  amounts: { itemsCents: 4500, shippingCents: 2200, totalCents: 6700, currency: 'brl' },
}

export const paidOrder: AdminOrder = {
  ...pendingOrder,
  id: 'o-2',
  orderNumber: 411,
  status: 'paid',
  createdAt: '2026-09-03T09:30:00.000Z',
  paidAt: '2026-09-03T09:31:00.000Z',
  shippingMethod: 'sedex',
  items,
  amounts: { itemsCents: 28500, shippingCents: 4100, totalCents: 32600, currency: 'brl' },
  stripeSessionId: 'cs_test_411',
}

export const shippedOrder: AdminOrder = {
  ...paidOrder,
  id: 'o-3',
  orderNumber: 412,
  status: 'shipped',
  createdAt: '2026-08-28T15:00:00.000Z',
  shippedAt: '2026-08-30T10:00:00.000Z',
  trackingCode: 'BR8841200SC',
  buyer: { name: 'Júlia Ferreira', email: 'julia@example.com' },
}

export const oversoldOrder: AdminOrder = {
  ...paidOrder,
  id: 'o-4',
  orderNumber: 413,
  status: 'oversold',
  createdAt: '2026-09-04T18:45:00.000Z',
  buyer: { name: 'Bruno Tavares', email: 'bruno@example.com' },
  notes: undefined,
}

export const expiredOrder: AdminOrder = {
  ...pendingOrder,
  id: 'o-5',
  orderNumber: 409,
  status: 'expired',
  createdAt: '2026-09-02T09:10:00.000Z',
  buyer: { name: 'Helena Prado', email: 'helena@example.com' },
  notes: undefined,
}

// All five lifecycle states, newest first — the admin table renders this list, so a missing state
// means a status pill nobody ever sees in a story.
export const adminOrders: AdminOrder[] = [
  oversoldOrder,
  shippedOrder,
  paidOrder,
  pendingOrder,
  expiredOrder,
]

export const publicPaidOrder: PublicOrder = {
  orderNumber: 411,
  status: 'paid',
  items: items.map((i) => ({ name: i.name, qty: i.qty })),
  totalCents: 32600,
  currency: 'brl',
  shippingMethod: 'sedex',
  eta: { pt: '3 a 5 dias úteis', en: '3–5 business days' },
}
```

- [ ] **Step 5: Implement the checkout fixtures**

Create `apps/web/src/fixtures/checkout.ts`:

```ts
import { type CheckoutRequest, type FieldErrors, type TotalsLine, checkoutRules } from '@shop/shared'
import { drawing, letter } from './products'

const buyer: CheckoutRequest['buyer'] = {
  name: 'Marina Bicalho',
  email: 'marina@example.com',
  phone: '+55 31 98812-4407',
}

export const emptyCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }],
  locale: 'pt',
  buyer: { name: '', email: '' },
}

export const brCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }, { slug: drawing.slug, qty: 2 }],
  locale: 'pt',
  buyer,
  shippingAddress: {
    country: 'BR',
    postalCode: '30150-904',
    street: 'Rua Sapucaí',
    number: '388',
    complement: 'ap. 51',
    district: 'Floresta',
    city: 'Belo Horizonte',
    state: 'MG',
  },
  shippingMethod: 'sedex',
  notes: 'É presente, capricha no embrulho.',
}

export const intlCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }],
  locale: 'en',
  buyer: { name: 'Sam Reyes', email: 'sam@example.com' },
  shippingAddress: {
    country: 'US',
    postalCode: '10001',
    street: '350 5th Ave',
    city: 'New York',
    state: 'NY',
  },
  shippingMethod: 'intl',
}

export const digitalCheckout: CheckoutRequest = {
  items: [{ slug: 'carta-digital', qty: 1 }],
  locale: 'pt',
  buyer,
}

/** What the checkout page shows after submitting an incomplete Brazilian address. */
/**
 * An incomplete Brazilian address, kept next to the errors it produces so the two cannot drift.
 */
export const incompleteBrCheckout: CheckoutRequest = {
  ...brCheckout,
  shippingAddress: {
    country: 'BR',
    postalCode: '3015',
    street: 'Rua Sapucaí',
    number: '',
    city: 'Belo Horizonte',
    state: '',
  },
  shippingMethod: undefined,
}

/**
 * What the checkout page actually receives from the API after submitting that address. DERIVED
 * from the real rules rather than written by hand: `apps/api/src/routes/checkout.ts:36-37` passes
 * `checkoutRules(...)` straight into the 400 response, so this object's shape is that function's
 * output and nothing else — in particular it never carries `buyer.*` keys, which zod rejects
 * earlier and separately.
 */
export const brCheckoutErrors: FieldErrors = checkoutRules(incompleteBrCheckout, true) as FieldErrors

export const cartLines: TotalsLine[] = [
  { priceCents: letter.priceCents, qty: 1, type: 'physical' },
  { priceCents: drawing.priceCents, qty: 2, type: 'physical' },
]
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit test/fixtures.test.ts`
Expected: PASS (4 tests). If `TotalsLine` or `FieldErrors` are not exported from `@shop/shared`, check `packages/shared/dist/index.d.ts` and use the exported names; report any mismatch.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/fixtures apps/web/test/fixtures.test.ts
git commit -m "feat(web): typed fixtures for stories and tests"
```

---

### Task 8: The UI purity rule, enforced


Amended 2026-09-09 after the first implementation reported four ways the guard could be walked
past — it found them by probing its own test rather than by declaring victory when it went green.
Two are closed here.

The forbidden-prefix list only reached `../../`, so any file nested two levels under `src/ui`
escaped every relative rule with `../../../lib`. PR 3 fills this directory, so that hole would
have opened exactly when it started to matter. The rule is now an allowlist: a bare specifier must
be one of the four packages the layer is allowed to know about, and a relative specifier must
resolve to a path inside `src/ui`.

The scan also only matched `from '...'`, leaving side-effect imports, dynamic `import()` and
`require()` invisible. All four forms are now matched.

Two gaps are accepted rather than closed, and recorded so nobody rediscovers them as bugs:
`*.stories.tsx` files are deliberately exempt (they must import the storybook packages, and they
already run as tests in the browser project), and the globals check is a raw-source scan, so
`document.` inside a comment is a false positive — loud, harmless and easy to fix when it happens.

**Files:**
- Test: `apps/web/test/ui-boundaries.test.ts`

**Interfaces:**
- Produces: a test that fails when any file under `src/ui/` imports the router, the query client, the app layer, or touches browser globals.

- [ ] **Step 1: Write the test**

Create `apps/web/test/ui-boundaries.test.ts`:

```ts
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

  it.each(files.map((f) => [path.relative(UI_DIR, f), f]))('%s touches no browser globals', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_GLOBALS) {
      expect(pattern.test(source), `${pattern} is not allowed in src/ui`).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run it**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit test/ui-boundaries.test.ts`
Expected: PASS — `src/ui/routes.ts` from Task 6 is the only file so far and it is clean. (`__dirname` works because the unit project runs in jsdom/CJS interop; if it is undefined, use `path.dirname(fileURLToPath(import.meta.url))`.)

- [ ] **Step 3: Prove the test can fail**

Temporarily add `import { useNavigate } from 'react-router'` to `src/ui/routes.ts`, re-run the test, confirm it FAILS naming that import, then remove the line and re-run to confirm it passes again. Record both outputs in your report.

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/ui-boundaries.test.ts
git commit -m "test(web): enforce the ui layer's purity boundary"
```

---

### Task 9: Text and layout primitives

**Files:**
- Create: `apps/web/src/ui/primitives/Eyebrow.tsx`, `Price.tsx`, `Stat.tsx`, `StatusPill.tsx`, `RuledList.tsx`, plus a `*.stories.tsx` beside each
- Create: `apps/web/src/ui/primitives/index.ts`

**Interfaces:**
- Consumes: `formatPrice`, `OrderStatus` from `@shop/shared`; `useTranslation` from `react-i18next`.
- Produces:
  - `Eyebrow({ children, className? })` — mono, uppercase, letter-spaced label.
  - `Price({ cents, lang, className? })` — `formatPrice` output in mono.
  - `Stat({ value, label })` — display-size number over a mono label.
  - `StatusPill({ status })` — translated status label in a pill; `paid` is solid ink, `oversold` accent, the rest outlined.
  - `RuledList({ children, className? })` — the prototype's 1px ink-gapped list container.
  - `index.ts` re-exports every primitive.

- [ ] **Step 1: Write the components**

Create `apps/web/src/ui/primitives/Eyebrow.tsx`:

```tsx
import type { ReactNode } from 'react'

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[11px] uppercase tracking-[0.18em] opacity-60 ${className}`}>{children}</div>
  )
}
```

Create `apps/web/src/ui/primitives/Price.tsx`:

```tsx
import { formatPrice } from '@shop/shared'

export function Price({ cents, lang, className = '' }: { cents: number; lang: 'pt' | 'en'; className?: string }) {
  return <span className={`font-mono whitespace-nowrap ${className}`}>{formatPrice(cents, lang)}</span>
}
```

Create `apps/web/src/ui/primitives/Stat.tsx`:

```tsx
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[clamp(30px,3.4vw,42px)] leading-none">{value}</div>
      <div className="font-mono mt-2.5 text-[11px] uppercase tracking-[0.14em] opacity-55">{label}</div>
    </div>
  )
}
```

Create `apps/web/src/ui/primitives/StatusPill.tsx`:

```tsx
import type { OrderStatus } from '@shop/shared'
import { useTranslation } from 'react-i18next'

const LABEL: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'In production',
  shipped: 'Shipped',
  oversold: 'Insufficient stock',
  expired: 'Expired',
}

const TONE: Record<OrderStatus, string> = {
  pending: 'border border-ink/40 opacity-70',
  paid: 'bg-ink text-paper',
  shipped: 'border border-ink',
  oversold: 'bg-accent text-paper',
  expired: 'border border-ink/30 opacity-50',
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`font-mono inline-flex px-3 py-1 text-[10px] uppercase tracking-[0.12em] ${TONE[status]}`}>
      {t(LABEL[status])}
    </span>
  )
}
```

Create `apps/web/src/ui/primitives/RuledList.tsx`:

```tsx
import type { ReactNode } from 'react'

/** The prototype's hairline list: a 1px ink grid gap showing through between paper rows. */
export function RuledList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-ink border-ink flex flex-col gap-px border ${className}`}>{children}</div>
}

export function RuledRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-paper px-4 py-3.5 ${className}`}>{children}</div>
}
```

Create `apps/web/src/ui/primitives/index.ts` re-exporting all of the above (add the Task 10 primitives to it in that task):

```ts
export * from './Eyebrow'
export * from './Price'
export * from './RuledList'
export * from './Stat'
export * from './StatusPill'
```

- [ ] **Step 2: Write the stories**

Create `apps/web/src/ui/primitives/Eyebrow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Eyebrow } from './Eyebrow'

const meta = { component: Eyebrow, title: 'Primitives/Eyebrow' } satisfies Meta<typeof Eyebrow>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: 'O catálogo inteiro' } }
```

Create `apps/web/src/ui/primitives/Price.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Price } from './Price'

const meta = { component: Price, title: 'Primitives/Price' } satisfies Meta<typeof Price>
export default meta
type Story = StoryObj<typeof meta>

export const Brazilian: Story = {
  args: { cents: 4500, lang: 'pt' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/45,00/)).toBeInTheDocument()
  },
}

export const English: Story = {
  args: { cents: 12000, lang: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/120\.00/)).toBeInTheDocument()
  },
}
```

Create `apps/web/src/ui/primitives/Stat.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stat } from './Stat'

const meta = { component: Stat, title: 'Primitives/Stat' } satisfies Meta<typeof Stat>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { value: '4', label: 'peças no catálogo' } }
```

Create `apps/web/src/ui/primitives/StatusPill.stories.tsx`:

```tsx
import { ORDER_STATUSES } from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { StatusPill } from './StatusPill'

const meta = { component: StatusPill, title: 'Primitives/StatusPill' } satisfies Meta<typeof StatusPill>
export default meta
type Story = StoryObj<typeof meta>

export const Paid: Story = {
  args: { status: 'paid' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Em produção')).toBeInTheDocument()
  },
}

export const EveryStatus: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUSES.map((status) => (
        <StatusPill key={status} status={status} />
      ))}
    </div>
  ),
}
```

Create `apps/web/src/ui/primitives/RuledList.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RuledList, RuledRow } from './RuledList'

const meta = { component: RuledList, title: 'Primitives/RuledList' } satisfies Meta<typeof RuledList>
export default meta
type Story = StoryObj<typeof meta>

export const ThreeRows: Story = {
  render: () => (
    <RuledList>
      <RuledRow>Subtotal</RuledRow>
      <RuledRow>Frete</RuledRow>
      <RuledRow>Total</RuledRow>
    </RuledList>
  ),
}
```

If `storybook/test` does not resolve, try `@storybook/test`; report which one the installed version provides.

- [ ] **Step 3: Run the stories as tests**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project storybook`
Expected: PASS — every story renders, and the three `play` functions assert. The `StatusPill` assertion proves the i18n decorator is wired (default locale `pt`).

Two things to know before reading a failure here:

- Accessibility is gating from Task 5 on (`a11y: { test: 'error' }` in `preview.tsx`), so an axe violation in a primitive is a red test. That is intended: fix the component, do not weaken the gate. If a rule genuinely cannot apply to an isolated primitive, disable that ONE rule at story level with a comment saying why, and report it.
- If the FIRST storybook run fails with Vite's `unexpectedly reloaded a test` error, it is a stale optimizer cache, not your code: a cache warmed before the a11y annotations were composed. Re-run, or clear `apps/web/node_modules/.cache/storybook/`. CI is unaffected — `npm ci` wipes `node_modules`, so its cache is always cold.

- [ ] **Step 4: Verify the boundary test still passes**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web -- --project unit`
Expected: PASS, including `ui-boundaries` over the new files.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/primitives
git commit -m "feat(web): text and layout primitives with stories"
```

---

### Task 10: Interactive primitives

**Files:**
- Create: `apps/web/src/ui/primitives/PillButton.tsx`, `FieldLabel.tsx`, `TextInput.tsx`, `TextArea.tsx`, `Select.tsx`, `Stepper.tsx`, `ImageFrame.tsx`, `LangToggle.tsx`, plus a `*.stories.tsx` beside each
- Modify: `apps/web/src/ui/primitives/index.ts`

**Interfaces:**
- Produces:
  - `PillButton({ children, href?, onClick?, type?, variant?, disabled?, className? })` — renders `<a href>` when `href` is set, `<button>` otherwise. `variant`: `'solid' | 'outline'`.
  - `FieldLabel({ htmlFor, children, hint? })`.
  - `TextInput({ id, value, onChange, type?, placeholder?, error?, disabled? })` — `onChange(value: string)`.
  - `TextArea({ id, value, onChange, rows?, placeholder?, error? })`.
  - `Select({ id, value, onChange, options })` — `options: { value: string; label: string }[]`.
  - `Stepper({ qty, onDecrement, onIncrement, disabled? })` — uses translated aria-labels.
  - `ImageFrame({ src?, alt, ratio?, placeholder? })` — `ratio`: `'4/5' | '1/1' | '16/9'`.
  - `LangToggle({ lang, onToggle })`.

- [ ] **Step 1: Write the components**

Create `apps/web/src/ui/primitives/PillButton.tsx`:

```tsx
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'solid' | 'outline'
  disabled?: boolean
  className?: string
}

const BASE =
  'font-mono inline-flex items-center justify-center rounded-full px-7 py-3.5 text-xs uppercase tracking-[0.1em] transition-colors'
const VARIANT = {
  solid: 'bg-ink text-paper hover:bg-accent',
  outline: 'border border-ink hover:bg-paper-3',
}

/**
 * Links are real anchors so the browser's own affordances (middle-click, open in new tab,
 * copy link) keep working; the app root upgrades same-origin clicks to client-side routing.
 */
export function PillButton({ children, href, onClick, type = 'button', variant = 'solid', disabled, className = '' }: Props) {
  const classes = `${BASE} ${VARIANT[variant]} ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`
  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
```

Create `apps/web/src/ui/primitives/FieldLabel.tsx`:

```tsx
import type { ReactNode } from 'react'

export function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="font-mono flex flex-col gap-2 text-[10px] uppercase tracking-[0.16em] opacity-75">
      <span>
        {children}
        {hint && <span className="ml-2 normal-case tracking-normal opacity-70">{hint}</span>}
      </span>
    </label>
  )
}
```

Create `apps/web/src/ui/primitives/TextInput.tsx`:

```tsx
interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'tel' | 'number'
  placeholder?: string
  error?: string
  disabled?: boolean
}

const FIELD =
  'font-mono border-ink bg-transparent w-full border px-3 py-3 text-[13px] outline-none focus:border-accent'

export function TextInput({ id, value, onChange, type = 'text', placeholder, error, disabled }: Props) {
  return (
    <>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        className={`${FIELD} ${error ? 'border-accent' : ''}`}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="font-mono text-accent mt-1 text-[11px]">
          {error}
        </p>
      )}
    </>
  )
}
```

Create `apps/web/src/ui/primitives/TextArea.tsx`:

```tsx
interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  error?: string
}

export function TextArea({ id, value, onChange, rows = 4, placeholder, error }: Props) {
  return (
    <>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`font-mono border-ink w-full resize-y border bg-transparent px-3 py-3 text-[13px] leading-relaxed outline-none focus:border-accent ${error ? 'border-accent' : ''}`}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="font-mono text-accent mt-1 text-[11px]">{error}</p>}
    </>
  )
}
```

Create `apps/web/src/ui/primitives/Select.tsx`:

```tsx
interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function Select({ id, value, onChange, options }: Props) {
  return (
    <select
      id={id}
      value={value}
      className="font-mono border-ink w-full border bg-transparent px-3 py-3 text-[13px] outline-none focus:border-accent"
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
```

Create `apps/web/src/ui/primitives/Stepper.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

interface Props {
  qty: number
  onDecrement: () => void
  onIncrement: () => void
  disabled?: boolean
}

export function Stepper({ qty, onDecrement, onIncrement, disabled }: Props) {
  const { t } = useTranslation()
  return (
    <div className="font-mono border-ink flex w-max items-center border text-[13px]">
      <button
        type="button"
        aria-label={t('Decrease quantity')}
        disabled={disabled}
        className="px-3 py-1.5 hover:bg-paper-3 disabled:opacity-40"
        onClick={onDecrement}
      >
        −
      </button>
      <span className="border-ink min-w-8 border-x px-2 py-1.5 text-center">{qty}</span>
      <button
        type="button"
        aria-label={t('Increase quantity')}
        disabled={disabled}
        className="px-3 py-1.5 hover:bg-paper-3 disabled:opacity-40"
        onClick={onIncrement}
      >
        +
      </button>
    </div>
  )
}
```

Create `apps/web/src/ui/primitives/ImageFrame.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

interface Props {
  src?: string
  alt: string
  ratio?: '4/5' | '1/1' | '16/9'
  placeholder?: string
}

/** Product photography slot: keeps the prototype's aspect ratios and degrades to paper. */
export function ImageFrame({ src, alt, ratio = '4/5', placeholder }: Props) {
  const { t } = useTranslation()
  return (
    <div className="bg-paper-2 relative w-full overflow-hidden" style={{ aspectRatio: ratio }}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="font-mono absolute inset-0 flex items-center justify-center px-4 text-center text-[11px] uppercase tracking-[0.14em] opacity-40">
          {placeholder ?? t('No photo yet')}
        </div>
      )}
    </div>
  )
}
```

Create `apps/web/src/ui/primitives/LangToggle.tsx`:

```tsx
export function LangToggle({ lang, onToggle }: { lang: 'pt' | 'en'; onToggle: () => void }) {
  const next = lang === 'pt' ? 'en' : 'pt'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${next.toUpperCase()}`}
      className="font-mono text-[12px] uppercase tracking-[0.1em] underline underline-offset-4"
    >
      {next}
    </button>
  )
}
```

Add all of them to `apps/web/src/ui/primitives/index.ts`.

- [ ] **Step 2: Write the stories with interaction tests**

Create `apps/web/src/ui/primitives/PillButton.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { PillButton } from './PillButton'

const meta = { component: PillButton, title: 'Primitives/PillButton', args: { onClick: fn() } } satisfies Meta<typeof PillButton>
export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {
  args: { children: 'Colocar na sacola' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Colocar na sacola' }))
    await expect(args.onClick).toHaveBeenCalledTimes(1)
  },
}

export const Outline: Story = { args: { children: 'Cancelar', variant: 'outline' } }

export const AsLink: Story = {
  args: { children: 'Ver o catálogo', href: '/' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
  },
}

export const Disabled: Story = {
  args: { children: 'Esgotado', disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Esgotado' })).toBeDisabled()
  },
}
```

Create `apps/web/src/ui/primitives/Stepper.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { Stepper } from './Stepper'

const meta = {
  component: Stepper,
  title: 'Primitives/Stepper',
  args: { qty: 2, onDecrement: fn(), onIncrement: fn() },
} satisfies Meta<typeof Stepper>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Aumentar quantidade' }))
    await expect(args.onIncrement).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Diminuir quantidade' }))
    await expect(args.onDecrement).toHaveBeenCalledTimes(1)
  },
}

export const Disabled: Story = { args: { disabled: true } }
```

Create `apps/web/src/ui/primitives/TextInput.stories.tsx` (controlled through `useArgs` so typing works):

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { expect, userEvent } from 'storybook/test'
import { TextInput } from './TextInput'

const meta = {
  component: TextInput,
  title: 'Primitives/TextInput',
  args: { id: 'email', value: '' },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs()
    return <TextInput {...args} value={value} onChange={(v) => updateArgs({ value: v })} />
  },
} satisfies Meta<typeof TextInput>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { placeholder: 'E-mail' },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('E-mail')
    await userEvent.type(input, 'marina@example.com')
    await expect(input).toHaveValue('marina@example.com')
  },
}

export const WithError: Story = {
  args: { value: 'nope', error: 'E-mail inválido' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('E-mail inválido')).toBeInTheDocument()
  },
}
```

Create stories for `FieldLabel`, `TextArea`, `Select`, `ImageFrame` and `LangToggle` in the same shape: a `Default` story for each, plus `Select` asserting `onChange` fires with the chosen value via `userEvent.selectOptions`, `ImageFrame` with a `NoPhoto` story asserting the placeholder text renders, and `LangToggle` asserting `onToggle` fires. Keep every `play` to one behaviour.

- [ ] **Step 3: Run both projects**

Run: `NODE_OPTIONS=--max-old-space-size=4096 npm test -w @shop/web`
Expected: PASS — unit project (v1 tests + storage, copy, routes, fixtures, ui-boundaries) and storybook project (every story, with the `play` assertions).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/ui/primitives
git commit -m "feat(web): interactive primitives with storybook interaction tests"
```

---

### Task 11: CI and final verification

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: CI installs Chromium before `npm test` (the storybook project needs a real browser) and builds Storybook as part of the `test` job.

- [ ] **Step 1: Update the workflow**

In `.github/workflows/ci.yml`, in the `test` job, insert a Chromium install step after `npm run build -w @shop/shared` and before `npm run typecheck`:

```yaml
      - run: npx playwright install --with-deps chromium
```

And after the existing `npm run build` step, add:

```yaml
      - run: npm run build-storybook -w @shop/web
        env: { NODE_OPTIONS: --max-old-space-size=4096 }
```

Leave the `e2e` job untouched.

- [ ] **Step 2: Full local verification**

Run, from the repo root:

```bash
npm run build -w @shop/shared
npm run typecheck
NODE_OPTIONS=--max-old-space-size=4096 npm test
npm run build
npm run build-storybook -w @shop/web
npm run e2e
```

Expected: typecheck clean across the three workspaces; shared 34, api 82, web unit + storybook projects all green with no extra Node flags; builds succeed; e2e reports 2 passed, 1 skipped (the v1 app is untouched, so its e2e behaviour is unchanged).

Then check for stray processes:

```bash
ps ax -o pid,ppid,command | grep -iE 'vitest|storybook|dev-e2e' | grep -v grep
```

Kill anything left with ppid 1.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install chromium and build storybook in the test job"
```

---

## Self-review notes

- **Spec coverage:** tokens and fonts (T2), i18n with English-sentence keys (T5), Storybook 10 + addon-vitest + a11y + decorators (T1, T4, T5), vitest projects with the browser project (T4), `routes.ts` (T6), fixtures (T7), architecture test (T8), copy test (T5, which also covers the "no empty translations" rule; the scan of `t()` literals against `pt.json` lands in PR 3, when pages introduce most of the copy), primitives with stories and `play` tests (T9, T10), CI (T11).
- **Deliberate deviations, both ledgered in the plan's Global Constraints:** the v1 wipe moves to PR 3 so every PR in the stack stays green and deployable; the new i18n instance lives in `src/copy/` to avoid colliding with the v1 `src/i18n/`.
- **Deferred to PR 3:** `LinkInterceptor`, the `app/` layer (containers, `useCart`, `useLang`, query hooks), shop and admin compound components, pages, and the `t()`-literal completeness scan.
- **Type consistency:** `PublicProduct`, `AdminOrder`, `PublicOrder`, `CheckoutRequest`, `FieldErrors`, `TotalsLine`, `OrderStatus`, `formatPrice`, `ORDER_STATUSES` are used with the names `@shop/shared` actually exports (verified against `packages/shared/dist/index.d.ts`); `Lang` is `'pt' | 'en'` everywhere, matching `formatPrice`'s signature.
- **Known risk, called out in the tasks:** three Storybook 10 API details (`setProjectAnnotations` entry point, `storybook/test` vs `@storybook/test`, `initialGlobals` vs `globalTypes.defaultValue`) have a stated fallback and a "report what you used" instruction rather than a silent guess.
