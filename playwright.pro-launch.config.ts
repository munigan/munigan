import { defineConfig } from "@playwright/test";
import base from "./playwright.oauth.config";

export default defineConfig({
  ...base,
  testMatch: "pro-launch.spec.ts",
});
