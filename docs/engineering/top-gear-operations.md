# Worker and report operations

## Local execution

`pnpm setup:local` initializes only the ignored project-local PostgreSQL cluster, loopback port 55435, and a mode-0600 `.env.local`. Start `pnpm dev` and `pnpm worker` separately. The two worker loops call the same `executeTopGear` function used by Trigger. The web handlers never call the native evaluator.

The engine binary is pinned and built with `pnpm sim:build`. Regeneration is explicit: `pnpm data:generate` for simulator data and `pnpm data:limits` for supplemental restrictions. If source versions change, bump their version in the normalized snapshot contract and invalidate older drafts. Finished reports keep their frozen source versions.

## Durable state

PostgreSQL stores the frozen request, policy, hashed anonymous owner/read capabilities, encrypted read-token replay, canonical work, attempts/results, budget reservation and outbox. Admission serializes the global budget/backlog reservation with a transaction-scoped advisory lock. Matching idempotency retries return the same report; conflicting requests under one key fail.

The work claim uses a shared global cap of two, a 30-second lease, a random fencing token and a one-second heartbeat. There is one CLI subprocess per claimed job. Native execution uses a private temporary directory, bounded input/output, deadlines and process-group termination. A lost heartbeat aborts the child; stale publishers cannot write results using a superseded lease.

Each admitted set receives equal sampling and a distinct deterministic seed interval. The equipped mechanical key is evaluated once. Work results persist before moving on. Transient resource/I/O errors retry only inside the frozen attempt cap; input errors do not. Reservations cover the upper-bound work count times the attempt cap, then settle to recorded attempts. A retry creates a new report, preserving the old report; compatible completed results are copied without new attempted-work charges.

`reconcileJobs` settles canceled/expired queued jobs without consuming CPU capacity, releasing their reservations. It resets expired running leases for resumption and increments an outbox dispatch generation. Reports return 410 after seven days and can be removed after a further 30-day grace period when no retained retry references them. Deletion is limited to settled rows. Rotate capability encryption keys only with a migration/re-encryption strategy; an unplanned key change breaks idempotent read-token replay.

## Trigger.dev configuration — intentionally deferred

The SDK, build package and CLI are pinned to 4.5.16. `trigger.config.ts` uses Node 24, the supported additional-files extension to package `dist/simulator/wowsimcli`, and one shared queue (`wotlk-simulation`, concurrency 2). No per-user queue key and no nested task fan-out is used. Provider abort signals propagate into the native process adapter.

After the user configures the project, set `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`, a remotely reachable `DATABASE_URL`, `CAPABILITY_KEY`, `APP_ORIGIN`, explicit policy limits and `TRUSTED_IP_HEADER`. The proxy must overwrite that header; do not trust arbitrary incoming forwarding headers. Point `SIM_BINARY` at the shipped executable if the deployment working directory differs.

Run `pnpm jobs:dispatch` from a continuously operated dispatcher or a provider-managed short recurring task. It invokes reconciliation and leases pending outbox records. Dispatch uses a stable job/generation idempotency key, retries lost acknowledgments without changing generations, and reschedules a queued job if its provider attempt cannot acquire DB capacity. Do not run the local worker against the same database while operating Trigger workers.

Deployment commands are `pnpm trigger:dev` and `pnpm trigger:deploy`; neither has been run because project configuration/staging were explicitly deferred. Do not treat a successful TypeScript build as provider packaging or cancellation evidence. Complete the checks in `top-gear-compatibility.md` before enabling public admission.

Primary implementation references: [Trigger configuration](https://trigger.dev/docs/config/config-file), [additional files](https://trigger.dev/docs/config/extensions/additionalFiles), [shared queue concurrency](https://trigger.dev/docs/queue-concurrency), and the installed SDK's task `signal`/lifecycle type declarations.
