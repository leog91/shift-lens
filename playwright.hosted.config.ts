import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";

process.env.SHIFT_LENS_HOSTED_E2E_DIR ??= mkdtempSync("/tmp/opencode/shiftlens-hosted-e2e-");

export default defineConfig({
  testDir: "./tests/e2e-hosted", workers: 1,
  webServer: { command: "node scripts/run-hosted-test-server.mjs", url: "http://127.0.0.1:3102/login", reuseExistingServer: false, timeout: 120_000 },
  use: { baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
