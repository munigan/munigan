# First Production Launch Implementation Plan

> **For agentic workers:** Execute the user-approved deployment in this workspace; retain all current application work for the first release.

**Goal:** Publish Top Gear at https://wow-droptmizer.munigan.app using Vercel Hobby, Neon Free, and the existing Trigger.dev project's Free production environment.

**Architecture:** Vercel serves Next.js and persists submissions in PostgreSQL. It attempts an immediate outbox dispatch after accepting a submission/retry. Trigger.dev runs the native Linux simulator and a periodic recovery task. A ten-minute recovery schedule avoids continuous polling; database connections close after that task so Neon can suspend.

**Tech Stack:** Next.js 16, PostgreSQL/Neon, Trigger.dev 4, GitHub, Vercel Hobby.

**Spec:** User approved personal accounts, private diego3g/wow-droptimizer repository, Neon Free, the exact custom domain above, and free tiers only.

## Constraints

- No paid plans, billing upgrades, or paid resources.
- Production data is separate from local reports/database. Generate fresh production capability key.
- Secrets stay in ignored private files or provider environment settings; never commit or print them.
- Preserve equipped-only defaults, 120-set cap, simulation semantics and current UI work.
- Reuse existing Trigger project proj_tbzzdkaotlbspettqxxh, production environment; keep concurrency two.

## 1. Production job dispatch

- [x] Add a best-effort dispatch hook to submission and retry after the durable DB write using Next.js `after`; gate on configured Trigger credentials so local native-worker tests keep working.
- [x] Add a production-only scheduled Trigger recovery task, calling reconciliation then outbox dispatch. Use ten-minute interval and concurrency one. Close idle DB connections after each sweep using a low idle timeout rather than ending the module pool permanently.
- [x] Verify dispatch failures leave accepted jobs durable and recoverable; run integration and browser simulation tests.

## 2. Provision and configure

- [x] Create private GitHub repository and Vercel project in the personal Hobby workspace.
- [x] Create Neon Free database in a region close to the worker, install schema, set pooled production connection URL on both providers.
- [x] Configure explicit app origin, production capability key, trusted Vercel IP header and admission limits. Keep local .env.local unchanged.
- [x] Package the existing pinned Linux simulator executable for Trigger; validate production container execution.

## 3. Release and verify

- [x] Run unit/UI, integration/native simulation, typecheck/lint/build, and secret/ignored-file checks before committing the first release.
- [x] Deploy Trigger production and Vercel, attach exact custom hostname with verified DNS/TLS.
- [x] Run a real browser import -> select -> submit -> completed report against the production hostname. Verify public read-only report and owner controls.
- [x] Record deployment IDs, URLs, provider plans, limits, and future deployment commands; identify any actual blockers.

Release evidence and future deployment steps: `docs/engineering/production-launch.md`.
