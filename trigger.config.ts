import { defineConfig } from "@trigger.dev/sdk";
import { additionalFiles } from "@trigger.dev/build/extensions/core";
export default defineConfig({
  project:
    process.env.TRIGGER_PROJECT_REF ?? "configure-after-local-validation",
  runtime: "node-24",
  dirs: ["./src/trigger"],
  maxDuration: 960,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, minTimeoutInMs: 35000, maxTimeoutInMs: 40000 },
  },
  build: {
    extensions: [additionalFiles({ files: ["./dist/simulator/wowsimcli"] })],
  },
});
