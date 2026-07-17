import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: { command: "SHIFT_LENS_DATA_MODE=demo bun run dev:web", url: "http://127.0.0.1:3000", reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
