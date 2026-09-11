import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "auth-controls.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    locale: "en-US",
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
  reporter: "list",
});
