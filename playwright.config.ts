import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: [
    "authentication.spec.ts",
    "authentication-rollback.spec.ts",
    "auth-controls.spec.ts",
    "auth-return-controls.spec.ts",
    "library-controls.spec.ts",
    "pro-launch.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  use: {
    locale: "en-US",
    viewport: { width: 1440, height: 900 },
    baseURL: "http://127.0.0.1:3100",
    trace: "off",
  },
  webServer: {
    command:
      "OAUTH_E2E_ANONYMOUS=1 node --import tsx tests/support/start-oauth-app.ts",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 30000 },
  },
  reporter: "list",
});
