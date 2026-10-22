import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  outputDir: 'test-results',
  use: { trace: 'retain-on-failure' },
})
