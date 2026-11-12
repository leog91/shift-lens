import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: { command: "SHIFT_LENS_DATA_MODE=demo SHIFT_LENS_NEXT_DIST_DIR=.next/e2e ./node_modules/.bin/next dev --webpack -p 3100", url: "http://127.0.0.1:3100", reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:3100", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
