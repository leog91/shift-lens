import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e-local', workers: 1,
  webServer: { command: 'node scripts/run-review-test-server.mjs', url: 'http://127.0.0.1:3101', reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:3101', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
