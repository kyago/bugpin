import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    headless: false,
  },
  webServer: {
    command: 'npx tsx scripts/mock-github-server.ts',
    port: 4870,
    reuseExistingServer: true,
  },
});
