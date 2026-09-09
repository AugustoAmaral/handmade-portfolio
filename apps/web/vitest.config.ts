import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          include: ['test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['test/setup.ts'],
          // Machine guardrail: this Mac has taken itself down with runaway vitest workers.
          pool: 'forks',
          poolOptions: { forks: { minForks: 1, maxForks: 2 } },
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
