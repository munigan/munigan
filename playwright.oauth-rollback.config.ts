import { defineConfig } from "@playwright/test";
import base from "./playwright.oauth.config";
export default defineConfig({
  ...base,
  testMatch: "authentication-rollback.spec.ts",
  webServer: {
    ...base.webServer,
    command:
      "OAUTH_E2E_ROLLBACK=1 node --import tsx tests/support/start-oauth-app.ts",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
});
