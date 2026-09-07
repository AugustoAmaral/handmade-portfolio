import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    {
      command: 'npx tsx apps/api/src/dev-e2e.ts',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'npm run dev -w @shop/web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
})
