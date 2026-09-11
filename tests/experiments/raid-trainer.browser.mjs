import { spawnSync } from "node:child_process";
// Keep the original experiment entry point; the state checks now live in the E2E suite.
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "playwright",
    "test",
    "tests/e2e/raid-trainer-game.spec.ts",
    "tests/e2e/raid-trainer-setup.spec.ts",
    "--workers=1",
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
