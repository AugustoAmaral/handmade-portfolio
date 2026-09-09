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
