# Task 2 report: Better Auth and account/report storage

## Outcome

- Pinned `better-auth` and the matching `auth` CLI at 1.7.4.
- Added pure Discord-only Better Auth options with identify-only scope, unverified placeholder email mapping, enrollment gating, database-backed seven-day sessions, disabled cookie caching/account linking/password flows, token encryption, explicit trusted origins, disabled unused endpoints, and explicit table/field mappings.
- Added the shared account/library contracts and a generator-only native PostgreSQL config that is not imported by runtime code.
- Generated `drizzle/0001_auth.sql` with the pinned CLI. It contains all five configured auth tables, the generated foreign keys, and the generated user/verification indexes.
- Added account lifecycle, job ownership/retention columns, scrubbing validity, retained-report library, save intents, and the corrected `prior_job` delete action in `drizzle/0002_report_accounts.sql`.
- Added trigger-backed lifecycle creation and session enforcement. The session trigger locks the lifecycle row `FOR KEY SHARE`; the concurrency test proves it blocks behind the deletion transaction's required explicit `FOR UPDATE`, then rejects a session after the lifecycle becomes `deleting`.
- Added account and terminal-report test fixtures. Terminal reports run through real admission, frozen request serialization, the worker flow with a deterministic test evaluator, and real capability hashing/encryption. They do not create library entries.
- Narrowed all existing job paths that decode retained payloads to live (`deleted_at IS NULL`) records. Ordinary expiry cleanup excludes published reports and scrubbed tombstones.

## TDD evidence

RED, before the option implementation:

```text
$ pnpm exec vitest run --project unit src/server/auth/options.test.ts
FAIL src/server/auth/options.test.ts
Error: Cannot find module './options'
exit 1
```

RED, before the schema and fixture implementation:

```text
$ pnpm exec vitest run --project integration tests/integration/account-schema.test.ts
FAIL tests/integration/account-schema.test.ts
Error: Cannot find module '../support/accounts'
exit 1
```

The initial concurrency assertion also failed with `Received: "inserted"` when the test modeled deletion as a plain non-key update. PostgreSQL gives that update a lock compatible with `FOR KEY SHARE`. The corrected test models the specified deletion lock order by selecting the lifecycle row `FOR UPDATE` before changing status; it then proves the trigger serialization behavior.

GREEN focused runs:

```text
$ pnpm exec vitest run --project unit src/server/auth/options.test.ts
Test Files 1 passed (1)
Tests 4 passed (4)

$ pnpm exec vitest run --project integration tests/integration/account-schema.test.ts
Test Files 1 passed (1)
Tests 5 passed (5)
```

## Schema generation

CLI inspection:

```text
$ pnpm exec auth generate --help
Usage: better-auth generate [options]
... --config, --output, --adapter, --dialect, --yes ...
exit 0
```

Exact successful generation command (local PostgreSQL only; no migrate command was run):

```sh
DATABASE_URL=postgresql://127.0.0.1:55435/wow_top_gear APP_ORIGIN=http://127.0.0.1:3000 BETTER_AUTH_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa DISCORD_CLIENT_ID=discord-client DISCORD_CLIENT_SECRET=discord-secret AUTH_ENROLLMENT_ENABLED=false pnpm exec auth generate --config ./src/server/auth/schema-config.ts --output ./drizzle/0001_auth.sql --yes
```

The CLI exited 0 and reported the schema file was generated. The placeholder generation secret caused the expected short-secret warning; production configuration validation belongs to Task 3.

## Verification

```text
$ pnpm test
Test Files 51 passed (51)
Tests 249 passed (249)

$ pnpm test:integration
Test Files 4 passed (4)
Tests 27 passed (27)

$ pnpm typecheck
exit 0

$ pnpm lint
exit 0

$ git diff --check
exit 0
```

The first full integration run caught the pre-existing migration test's single-baseline ledger expectation. It failed with the received `0001_auth.sql` and `0002_report_accounts.sql` rows; the expectation now reflects the ordered migration set, and the full integration rerun passes.

## Notes for follow-up tasks

- `AUTH_ENROLLMENT_ENABLED` is the approved enrollment flag. Only the Discord provider's `disableSignUp` uses it.
- Deletion code must preserve the tested lock order: explicitly lock `account_lifecycle` `FOR UPDATE`, set it to `deleting`, then revoke sessions. A plain update of the non-key status column does not by itself conflict with the trigger's `FOR KEY SHARE` lock.
- Runtime auth configuration and the session hook belong to Task 3. `schema-config.ts` remains generator-only.
