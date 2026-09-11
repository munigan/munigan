# Worker and report operations

## Local execution

`pnpm setup:local` initializes only the ignored project-local PostgreSQL cluster, loopback port 55435, and a mode-0600 `.env.local`. Start `pnpm dev` and `pnpm worker` separately. The two worker loops call the same `executeTopGear` function used by Trigger. The web handlers never call the native evaluator.

The engine binary is pinned and built with `pnpm sim:build`. Regeneration is explicit: `pnpm data:generate` for simulator data and `pnpm data:limits` for supplemental restrictions. If source versions change, bump their version in the normalized snapshot contract and invalidate older drafts. Finished reports keep their frozen source versions.

## Durable state

PostgreSQL stores the frozen request, policy, hashed anonymous owner/read capabilities, encrypted read-token replay, canonical work, attempts/results, budget reservation and outbox. Admission serializes the global budget/backlog reservation with a transaction-scoped advisory lock. Matching idempotency retries return the same report; conflicting requests under one key fail.

The work claim uses a shared global cap of two, a 30-second lease, a random fencing token and a one-second heartbeat. There is one CLI subprocess per claimed job. Native execution uses a private temporary directory, bounded input/output, deadlines and process-group termination. A lost heartbeat aborts the child; stale publishers cannot write results using a superseded lease.

Each admitted set receives equal sampling and a distinct deterministic seed interval. The equipped mechanical key is evaluated once. Work results persist before moving on. Transient resource/I/O errors retry only inside the frozen attempt cap; input errors do not. Reservations cover the upper-bound work count times the attempt cap, then settle to recorded attempts. A retry creates a new report, preserving the old report; compatible completed results are copied without new attempted-work charges.

`reconcileJobs` settles canceled/expired queued jobs without consuming CPU capacity, releasing their reservations. It resets expired running leases for resumption and increments an outbox dispatch generation. Reports return 410 after seven days and can be removed after a further 30-day grace period when no retained retry references them. Deletion is limited to settled rows. Rotate capability encryption keys only with a migration/re-encryption strategy; an unplanned key change breaks idempotent read-token replay.

## Trigger.dev Development configuration

The SDK, build package and CLI are pinned to 4.5.16. `trigger.config.ts` uses Node 24, the supported additional-files extension to package `dist/simulator/wowsimcli`, and one shared queue (`wotlk-simulation`, concurrency 2). No per-user queue key and no nested task fan-out is used. Provider abort signals propagate into the native process adapter.

The project is now `proj_tbzzdkaotlbspettqxxh` (WoW Droptmizer, Munigan). The development key is configured only in ignored mode-0600 `.env.local`; the CLI uses the existing user login. Run `pnpm trigger:dev` and `pnpm jobs:dispatch:watch` alongside `pnpm dev`. The first two replace `pnpm worker`. Trigger Development executes on this computer and can reach its loopback database.

For hosted execution, configure a remotely reachable `DATABASE_URL`, `CAPABILITY_KEY`, `APP_ORIGIN`, explicit policy limits and `TRUSTED_IP_HEADER`, plus the corresponding environment's `TRIGGER_SECRET_KEY` for the web/dispatcher process. Never upload the local loopback database settings as hosted credentials. The proxy must overwrite the trusted-IP header. Point `SIM_BINARY` at the shipped executable if the deployment working directory differs.

`pnpm jobs:dispatch` performs one reconciliation/dispatch cycle; `pnpm jobs:dispatch:watch` repeats every two seconds and shuts down on SIGINT/SIGTERM. In hosted environments, operate this process continuously or arrange an equivalent provider-managed recurring task. It leases pending outbox records and sends job IDs only. Dispatch uses a stable job/generation idempotency key, retries lost acknowledgments without changing generations, and reschedules a queued job if its provider attempt cannot acquire DB capacity. Do not run the direct local worker against the same database while operating Trigger workers.

The installed package exposes the `trigger` executable; the pnpm scripts invoke it. Development execution and a deployment dry run have passed; no hosted deployment was performed. Dry-run bundling is not evidence of a successful Linux container execution or provider cancellation. Complete the checks in `top-gear-compatibility.md` before enabling public admission.

Primary implementation references: [Trigger configuration](https://trigger.dev/docs/config/config-file), [additional files](https://trigger.dev/docs/config/extensions/additionalFiles), [shared queue concurrency](https://trigger.dev/docs/queue-concurrency), and the installed SDK's task `signal`/lifecycle type declarations.

## Saved-report deletion and retention

Saved library reports do not expire with their original seven-day anonymous deadline. Ordinary cleanup removes at most 100 settled candidates per pass after the additional 30-day grace period, rechecking under row locks. It skips library entries (including tombstones), unsettled reservations and referenced retry parents. Account association alone does not retain empty failed runs.

`DELETE /api/library/:id` takes an exact `{}` JSON body and a server-resolved session. It returns 204 after atomically tombstoning the job and library item. Public capability reads immediately return 404; repeated deletion by that owner remains safe while the tombstone exists. `POST /api/account/delete` takes exactly `{ "expectedUserId": "<current account ID>" }` and returns 202 `{ "status": "deleting" }`. The expected ID confirms the fresh session's identity; it never selects a target account. The session must have been created within five minutes, even if an older session has refreshed recently. Both mutations enforce same origin, JSON content type and a streamed 2 KiB body limit.

Account deletion obtains lifecycle `FOR UPDATE` before jobs, marks all jobs and entries deleted, requests cancellation of unsettled work, and revokes every session in one transaction. This conflicts with session insertion's lifecycle `FOR KEY SHARE`, preventing issuance after deletion starts. Provider linkage remains until final cleanup. Better Auth's independent hard-delete and linking endpoints remain disabled.

Recovery runs settlement, expired-lease recovery, report cleanup, then account cleanup. A recovered running lease becomes queued and can require the next sweep to settle; payloads remain until settlement. Explicitly deleted settled jobs lose work/outbox and sensitive report payloads; retry children are detached first. Operational skeletons and existing budget totals remain, so deletion does not refund usage or resurrect idempotency keys. Final account cleanup waits for every owned job to settle and scrub, removes library entries and associated/completed save intents, clears job account references, and removes provider accounts, sessions and the user/lifecycle atomically. Discord-only OAuth verification rows have opaque identifiers and no account ownership field; cleanup preserves them rather than guessing ownership. Existing provider state expires through authentication's verification lifecycle. A new sign-in after final deletion creates an empty account.

The production Trigger recovery schedule remains every ten minutes. Its result includes `reports: { scrubbed, expired }`, `accounts: { deleted, pending }`, `oldestDeletionSeconds` (null when none or the monitoring query fails), and `failedPasses`. Pass failures log only a fixed message and pass name, never raw SQL/errors or connection details; subsequent passes still run with their own guards, and subsequent sweeps retry. Monitor increasing oldest-deletion age, nonempty `failedPasses`, and sustained pending accounts. Session revocation alone is not deletion completion. Re-run `reconcileJobs()` through the existing recovery/dispatch entrypoint after resolving infrastructure faults; no manual bulk deletion or reservation edits are needed.

## Discord accounts and retained reports

Follow [authentication operations](authentication-operations.md) for direct migration configuration, retention-aware worker-first deployment, disabled-by-default enrollment/saving, exact Discord callbacks, rollback and the mandatory real-provider release gate. Saved nonempty reports have no automatic age-based expiry until explicit deletion. Preserve the existing `CAPABILITY_KEY` and all historic report capabilities. Production rollout remains blocked until real consent, cancellation, cross-device library access and deletion are verified on the configured origin.
