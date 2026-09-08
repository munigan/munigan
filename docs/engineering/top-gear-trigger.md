# Trigger.dev setup evidence

Configured on 2026-09-08 following the user's request to set up Trigger using their selected project tab.

- Organization/project: Munigan / WoW Droptmizer.
- Project reference: `proj_tbzzdkaotlbspettqxxh`.
- Environment: Development, default branch, Node 24.
- Task: `top-gear`; shared queue `wotlk-simulation`, concurrency two; local dev runner also capped at two.
- Credentials: existing authenticated CLI profile; project Development key stored only in ignored `.env.local` with mode 0600. No credentials committed or uploaded as cloud environment variables.
- Dashboard: [Tasks](https://cloud.trigger.dev/orgs/munigan-d137/projects/wow-droptmizer-kTSz/env/dev).

## Verified execution

The direct local worker was stopped before the test. The browser imported equipped gear plus a bag helmet, submitted through the web application, and the watched outbox dispatcher sent the job to Trigger. Task `top-gear` run `run_06g84gcrapkvm8qo2teketo301` completed successfully, confirmed both in the dev runner log and through `runs.retrieve` returning `COMPLETED`.

The browser test verified all eight complete sets, all 17 slots, fixed gains versus equipped, readonly sharing and immutable source report after draft reuse. This confirms cloud queue dispatch to a **locally executing Development worker**, not hosted simulation processing.

`pnpm trigger:deploy --dry-run --skip-sync-env-vars --skip-update-check --skip-telemetry` built successfully. Its staged `dist/simulator/wowsimcli` is an executable, statically linked Linux x86-64 ELF and matches the pinned built binary byte-for-byte. No hosted deployment was created by this dry run.

## Running it again

Start `pnpm dev`, `pnpm trigger:dev` and `pnpm jobs:dispatch:watch` in separate terminals. Keep the latter two running while testing. `pnpm jobs:dispatch` is available for a single cycle. Use `pnpm worker` only when deliberately switching back to fully local execution without Trigger.

The existing test command `pnpm exec playwright test tests/e2e/top-gear-run.spec.ts` exercises the real pipeline with whichever worker mode is running. Before hosted deployment, complete the remaining [release gates](top-gear-compatibility.md), including remotely reachable PostgreSQL and explicit hosted environment configuration.
