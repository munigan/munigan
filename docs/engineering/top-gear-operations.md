# Worker and report operations

## Local execution

`pnpm setup:local` initializes only the ignored project-local PostgreSQL cluster, loopback port 55435, and a mode-0600 `.env.local`. Start `pnpm dev` and `pnpm worker` separately. The two worker loops call the same `executeTopGear` function used by Trigger. The web handlers never call the native evaluator.

The engine binary is pinned and built with `pnpm sim:build`. Regeneration is explicit: `pnpm data:generate` for simulator data and `pnpm data:limits` for supplemental restrictions. If source versions change, bump their version in the normalized snapshot contract and invalidate older drafts. Finished reports keep their frozen source versions.

## Durable state

PostgreSQL stores the frozen request, policy, hashed anonymous owner/read capabilities, encrypted read-token replay, canonical work, attempts/results, budget reservation and outbox. Admission serializes the global budget/backlog reservation with a transaction-scoped advisory lock. Matching idempotency retries return the same report; conflicting requests under one key fail.

The work claim uses a shared global cap of two, a 30-second lease, a random fencing token and a one-second heartbeat. The direct local worker defaults to one CLI subprocess per job. The Trigger task uses `medium-2x` (two vCPUs) and up to two subprocesses per job, capped by the actual machine CPU allocation if a run overrides the preset. Thus normal hosted capacity is two jobs and four native processes. The equipped reference persists first; candidate processes refill as each finishes. Native execution uses a private temporary directory, bounded input/output, deadlines and process-group termination. Cancellation, a lost lease, or a fatal orchestration failure aborts all children, and the worker drains them before finalization. Stale publishers cannot write results using a superseded lease.

Each claimed Trigger job emits a `Top Gear performance` summary with its actual machine, process concurrency, planned count, native attempts and newly persisted successes, iteration count, total elapsed time, and accumulated phase times for claim, planning, admission, evaluation, persistence, and finalization. Phase times overlap across concurrent processes and must not be added to estimate elapsed time. Resumed completed sets are excluded from the new attempts/successes counters. No gear payloads or report capabilities are logged. See [the performance investigation](top-gear-performance.md) for measurements and scope.

Each admitted set receives equal sampling and a distinct deterministic seed interval. The equipped mechanical key is evaluated once. Work results persist before moving on. Transient resource/I/O errors retry only inside the frozen attempt cap; input errors do not. Reservations cover the upper-bound work count times the attempt cap, then settle to recorded attempts. A retry creates a new report, preserving the old report; compatible completed results are copied without new attempted-work charges.

`reconcileJobs` settles canceled/expired queued jobs without consuming CPU capacity, releasing their reservations. It resets expired running leases for resumption and increments an outbox dispatch generation. Reports return 410 after seven days and can be removed after a further 30-day grace period when no retained retry references them. Deletion is limited to settled rows. Rotate capability encryption keys only with a migration/re-encryption strategy; an unplanned key change breaks idempotent read-token replay.

## Production admission budget

Vercel Production sets `GLOBAL_DAILY_UNITS=200000000` as of 2026-09-11, a 100× increase from 2,000,000. This is the shared site budget, equivalent to 40,000 combination attempts per UTC day. Each new job reserves its estimated combination count × 5,000 work units × two allowed attempts; settlement charges actual attempts and releases the remaining reservation. Existing daily usage remains counted when the limit increases.

Daily admission runs in the website's job and retry APIs. Updating the Vercel environment variable requires a new Production deployment; this budget change does not require a Trigger worker redeployment. The per-run limit remains 120 sets at 500 iterations each. Browser limits remain two active jobs and 20 admissions per day; IP limits remain four active jobs and 40 admissions per day. Global worker concurrency remains two jobs, and the queue limit remains 20 jobs.

## Trigger.dev Development configuration

The SDK, build package and CLI are pinned to 4.5.16. `trigger.config.ts` uses Node 24, the supported additional-files extension to package `dist/simulator/wowsimcli`, and one shared queue (`wotlk-simulation`, concurrency 2). No per-user queue key and no nested task fan-out is used. Provider abort signals propagate into the native process adapter.

The project is now `proj_tbzzdkaotlbspettqxxh` (WoW Droptmizer, Munigan). The development key is configured only in ignored mode-0600 `.env.local`; the CLI uses the existing user login. Run `pnpm trigger:dev` and `pnpm jobs:dispatch:watch` alongside `pnpm dev`. The first two replace `pnpm worker`. Trigger Development executes on this computer and can reach its loopback database.

For hosted execution, configure a remotely reachable `DATABASE_URL`, `CAPABILITY_KEY`, `APP_ORIGIN`, explicit policy limits and `TRUSTED_IP_HEADER`, plus the corresponding environment's `TRIGGER_SECRET_KEY` for the web/dispatcher process. Never upload the local loopback database settings as hosted credentials. The proxy must overwrite the trusted-IP header. Point `SIM_BINARY` at the shipped executable if the deployment working directory differs.

`pnpm jobs:dispatch` performs one reconciliation/dispatch cycle; `pnpm jobs:dispatch:watch` repeats every two seconds and shuts down on SIGINT/SIGTERM. In hosted environments, operate this process continuously or arrange an equivalent provider-managed recurring task. It leases pending outbox records and sends job IDs only. Dispatch uses a stable job/generation idempotency key, retries lost acknowledgments without changing generations, and reschedules a queued job if its provider attempt cannot acquire DB capacity. Do not run the direct local worker against the same database while operating Trigger workers.

The installed package exposes the `trigger` executable; the pnpm scripts invoke it. Development execution and a deployment dry run have passed; no hosted deployment was performed. Dry-run bundling is not evidence of a successful Linux container execution or provider cancellation. Complete the checks in `top-gear-compatibility.md` before enabling public admission.

Primary implementation references: [Trigger configuration](https://trigger.dev/docs/config/config-file), [additional files](https://trigger.dev/docs/config/extensions/additionalFiles), [shared queue concurrency](https://trigger.dev/docs/queue-concurrency), and the installed SDK's task `signal`/lifecycle type declarations.
