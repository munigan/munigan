# First production release

Published 2026-09-09.

- Website: https://wow-droptmizer.munigan.app
- Repository: https://github.com/diego3g/wow-droptimizer (private), production branch `main`.
- Vercel project: `wow-droptimizer`, personal Hobby workspace `diego-fernandes-projects`, region `iad1`.
- Neon resource: `wow-droptimizer`, existing Neon integration, **Free**, Washington DC (`iad1`), optional Neon Auth disabled. Connected only to Vercel Production.
- Trigger.dev: Munigan / WoW Droptmizer, project `proj_tbzzdkaotlbspettqxxh`, **Free**, Production version `20260909.1`.

The subdomain intentionally uses `wow-droptmizer` (the exact user-specified hostname); the repository and project names use `wow-droptimizer`.

## Runtime

Vercel accepts a durable PostgreSQL job, then dispatches its outbox after the response. Trigger runs the pinned Linux simulator with two concurrent simulation jobs. The `top-gear-recovery` scheduled task reconciles leases, expires abandoned jobs, and retries pending dispatches every ten minutes in Production. Local native execution remains available without Trigger credentials.

Database pools have four connections, five-second idle cleanup, and Vercel pool lifecycle handling. Neon can suspend between recovery sweeps when there is no app traffic. Sweeps still consume the Free plan's compute allowance; free hosting is capacity-limited. Trigger Free stops running tasks after its included credits are exhausted. No paid plan or add-on was enabled.

Production admission: 120 sets per run (`TOP_GEAR_MAX_UNITS=600000`), 500 iterations per set, 900-second job deadline, 2,000,000 global daily work units, and 20 queued jobs maximum. The daily budget is shared by all visitors and is intentionally smaller than the local default for this free release.

`APP_ORIGIN` is the custom HTTPS hostname. Vercel supplies `x-vercel-forwarded-for` for hashed per-source admission limits. Production uses a separate Neon database and fresh capability key. Local reports were not migrated.

## Verification

- Typecheck, ESLint, production build, design/spec checks passed.
- 74 unit/UI tests, 12 database integration tests, and 45 native simulator tests passed.
- Existing local browser simulation test passed after the dispatch change.
- Production recovery task completed against Neon: `run_06g8d45bsoco1bn9ujihccra01`.
- A live browser imported Munigaan's supplied equipment/professions/glyphs and one bag helmet, selected the bag item, and completed four combinations using Original WotLK data.
- Production report: https://wow-droptmizer.munigan.app/reports/LHTrkWZJl7z_aNNndGDStuIBBcIwAULha_t5MPUQ2Uw
- Anonymous report API returned `canManage: false`, complete/exhaustive coverage, and four rows. Mjolnir displayed item level 226.
- Custom domain verified by Vercel and accessed successfully over HTTPS.

The first CLI website build failed because `.vercelignore` excluded fixtures while TypeScript still checked source tests. Including the shared test files fixed the production build.

## Subsequent releases

1. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, and the relevant tests.
2. For simulator/native changes, run `pnpm sim:build` to regenerate the pinned Linux executable. `dist/` is intentionally not committed.
3. For worker changes, run `pnpm trigger:deploy` and confirm the production version succeeds **before** pushing dependent web changes. Trigger secrets are configured in its Production environment; `.env.local` must never be uploaded as hosted configuration.
4. Push to GitHub `main`. Vercel's Git connection deploys the website automatically. An explicit release from this linked checkout is also available with `pnpm dlx vercel@59.14.0 --prod --scope diego-fernandes-projects`.
5. Verify one small simulation at the custom hostname and the corresponding Trigger Production run.

Environment values are held by the providers and the ignored, mode-0600 `.env.production.local`. Do not print or commit them. Retain the production capability key; changing it requires a deliberate migration strategy for existing reports. `.vercelignore` excludes `.env*`, local cache, and worker artifacts from web uploads.

The website and worker deploy separately. Automatic Trigger builds from GitHub are not configured for this first release; follow step 3 when changing worker code. Before introducing the planned paid tools, revisit Vercel Hobby's personal/non-commercial restrictions and the provider plans.
