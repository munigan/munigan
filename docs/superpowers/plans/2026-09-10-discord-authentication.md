# Discord Authentication and My Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people sign in with Discord, retain their own Gear Lab reports, and manage them across devices without requiring login to simulate.

**Architecture:** Better Auth owns Discord identity and database sessions in the existing Next.js Node runtime. Application services own report access, explicit anonymous claims, library publication and deletion; the worker publishes retained reports transactionally. A client session boundary integrates the approved Paper experience without making localized homepages dynamic.

**Tech Stack:** Node 24, pnpm 10.33.0, Next.js 16.3.4, React 19.2.8, Better Auth 1.7.4, pg 8.23.0/PostgreSQL, Base UI 1.8.0, next-intl, Vitest, Playwright, Vercel/Neon/Trigger.dev.

**Spec:** [Approved authentication specification](../specs/2026-09-10-discord-authentication-design.md). Read the entire spec before executing; it is authoritative for product policy.

## Global Constraints

- This artifact is a plan. No application changes, dependency installations, database migrations or deployment have been performed by writing it.
- Discord only; request `identify`, disable default extra scopes. No passwords, email login, linking, bot or guild permissions.
- Saved reports have no automatic age-based expiry. Anonymous reports retain seven-day access followed by the existing 30-day physical-deletion grace period.
- Seven-day rolling database sessions, daily refresh, five-minute freshness for account deletion; cookie caching disabled.
- Keep `/top-gear`, `/api/top-gear`, `tool: "top-gear"`, draft keys, simulation contracts and `CAPABILITY_KEY`. Display name: **Gear Lab** in both languages.
- My Library is private; saved report capability links remain public read-only until deletion. Only Gear Lab/report entries ship initially.
- Preserve EN-US/PT-BR, shared top navigation, mobile access, anonymous import/run, local drafts, report pagination and edit/run-again behavior.
- Authentication success does not prove saving succeeded. No automatic modal on report arrival; no automatic claim of browser history.
- Do not introduce cloud drafts, saved setups, Raid Trainer persistence, subscriptions, new simulation formulas or increased simulation allowances.
- Lock account lifecycle before job whenever both are needed. Claims additionally lock intent between account and job. Never publish or claim a deleted report.
- New enrollment and new saving are independently switchable. Disabling either must preserve existing users' access and existing retained data.
- Work in isolation when execution starts; follow the worktree skill. The current branch has unrelated changes. Start from the reviewed current app state, not an older commit missing the UI; do not reset/stash/commit others' work indiscriminately.
- Before writing Next code, read `node_modules/next/dist/docs/01-app/02-guides/authentication.md` and the installed route-handler/rendering guides. Re-read project `AGENTS.md`.

## File map and implementation order

Paths below are repository-relative. New tests use the existing Vitest projects: `src/**/*.test.ts` is unit, `src/**/*.test.tsx` is UI, `tests/integration/**/*.test.ts` is PostgreSQL integration. All new database tests use isolated schemas and the real migration runner.

| Task | Files | Responsibility |
| --- | --- | --- |
| 1 | `src/server/db/migrate.ts`, `scripts/migrate.ts`, `tests/support/database.ts`, migration tests | Ordered, checksummed migrations and safe baseline adoption |
| 2 | `src/server/auth/options.ts`, `schema-config.ts`, `drizzle/0001_auth.sql`, `drizzle/0002_report_accounts.sql`, `src/domain/accounts/contracts.ts`, `tests/support/accounts.ts` | Pinned auth schema, application tables, shared contracts and fixtures |
| 3 | `src/server/auth/config.ts`, `identity.ts`, `account-lock.ts`, auth routes | Provider/session integration, lifecycle enforcement, safe request identity |
| 4 | `src/server/reports/access.ts`, `read.ts`, `projection.ts`, report route | Separate report projection and access from worker execution |
| 5 | `src/server/library/report-summary.ts`, `repository.ts` | Publication adapter, owner-isolated list and link resolution |
| 6 | `src/server/jobs/admit.ts`, `work.ts`, job routes | Signed-in admission, quotas, retry, atomic worker publication |
| 7 | `src/server/library/claims.ts`, save routes | Explicit, owner-bound save intents and direct claims |
| 8 | `src/server/accounts/deletion.ts`, `src/server/reports/cleanup.ts`, recovery and deletion routes | Immediate access revocation and durable cleanup |
| 9 | `src/features/auth/client.ts`, `AuthProvider.tsx`, `AccountMenu.tsx`, `SignInDialog.tsx`, shared shell | Session-aware top bar and optional sign-in |
| 10 | `src/features/auth/return-state.ts`, `AuthReturn.tsx`, `src/features/reports/ReportSave.tsx`, report hook/view, import submission | Save UI, OAuth return context and explicit anonymous continuation |
| 11 | `src/features/library/LibraryView.tsx`, `use-library.ts`, `DeleteReportDialog.tsx`, `src/features/auth/DeleteAccountDialog.tsx`, library page | Private history and destructive-action confirmation |
| 12 | Locale catalogs, headings, homepage and metadata | Gear Lab naming and complete bilingual experience |
| 13 | `tests/e2e/authentication.spec.ts`, integration race tests, deployment runbook | Browser/provider validation, release and rollback evidence |

Task-local test paths and new route files are listed below. No module imported by workers may import `auth/config.ts` or require Discord secrets. Shared DTOs belong in `src/domain/accounts/contracts.ts`, not in client components.

### Shared contracts to establish in Task 2

```ts
// src/domain/accounts/contracts.ts
export type AccountIdentity = {
  id: string;
  name: string;
  image: string | null;
  sessionId: string;
  authenticatedAt: string; // session.createdAt, never its sliding updatedAt
};
export type RequestIdentity = {
  account: AccountIdentity | null;
  ownerHash: string | null;
};
export type PublicAccount = Pick<AccountIdentity, "id" | "name" | "image">;
export type AuthMode = "account" | "anonymous";
export type ReportAccess = {
  saved: boolean;
  effectiveExpiresAt: string | null;
  anonymousExpiresAt: string;
  canManage: boolean;
  canSave: boolean;
  canDelete: boolean;
};
export type LibrarySummary = {
  characterName: string;
  classKey: string;
  specKey: string;
  level: number;
  dps: number;
  gainDps: number | null;
};
export type LibraryItem = {
  id: string;
  tool: "top-gear";
  kind: "report";
  title: string;
  summary: LibrarySummary;
  createdAt: string;
  savedAt: string;
};
export type LibraryQuery = { search?: string; cursor?: string; tool?: "top-gear" };
export type LibraryPage = {
  items: LibraryItem[];
  nextCursor: string | null;
  tools: Array<"top-gear">;
};
export type ClaimResult = { itemId: string; reportPath: string };
export type SaveIntent = { token: string; expiresAt: string };
export type ReportViewState = {
  version: 1;
  reportPath: string;
  locale: "en-US" | "pt-BR";
  cursor: number;
  selectedId: string | null;
  difference: "equipped" | "highest";
  scrollY: number;
};
export type AccountErrorCode =
  | "SIGN_IN_REQUIRED" | "AUTH_UNAVAILABLE" | "NOT_FOUND"
  | "REPORT_EXPIRED" | "OWNER_COOKIE_REQUIRED" | "INTENT_EXPIRED"
  | "REPORT_NOT_READY" | "CLAIM_CONFLICT" | "ACCOUNT_DELETING"
  | "FRESH_LOGIN_REQUIRED" | "ACCOUNT_CHANGED" | "SAVING_UNAVAILABLE"
  | "INVALID_REQUEST" | "RATE_LIMITED";
```

Server-only `AccountError` in `src/server/auth/errors.ts` extends Error with `code: AccountErrorCode` and `status: number`. HTTP error body is `{code, error}` where `error` is a safe generic fallback, not an exception/SQL message. UI translates `code`. Infrastructure failures are 503, missing authentication 401, not-owned/deleted resources 404, expired report 410, state/freshness conflicts 409, quotas 429, malformed input 400. Owner-cookie diagnostics are exposed only in a flow already bound to that browser, not arbitrary shared-report lookup.

### Task 1: Make migrations safe for existing production data

**Files:** Create `src/server/db/migrate.ts`, `tests/support/database.ts`, `tests/integration/migrations.test.ts`. Modify `scripts/migrate.ts` and existing integration files which directly replay `0000_top_gear.sql`.

**Interfaces:** Produce `migrate(client: pg.PoolClient, directory?: string): Promise<void>`; `createTestDatabase(): Promise<void>` and `dropTestDatabase(): Promise<void>` in test support. Default migration directory is `drizzle`. Test support uses existing `pool`/`testSchema`; it rejects a missing or invalid `tg_test_` schema. It never falls back to public schema.

- [ ] Add a database test exercising adoption without data loss:

```ts
it("adopts the baseline and can run twice without changing jobs", async () => {
  const c = await pool.connect();
  try {
    await c.query(await readFile("drizzle/0000_top_gear.sql", "utf8"));
    await c.query("INSERT INTO tg_budgets(day,reserved,spent) VALUES('2026-09-10',0,123)");
    await migrate(c);
    await migrate(c);
    expect((await c.query("SELECT spent FROM tg_budgets WHERE day='2026-09-10'")).rows[0].spent).toBe("123");
    expect((await c.query("SELECT count(*) FROM app_migrations WHERE name='0000_top_gear.sql'")).rows[0].count).toBe("1");
  } finally { c.release(); }
});
```

- [ ] Run `pnpm exec vitest run --project integration tests/integration/migrations.test.ts`; expect missing runner failure.
- [ ] Implement connection-scoped advisory locking and a ledger. Use one transaction per migration, ledger insertion in that transaction, SHA-256 of exact bytes, lexical numeric file order, checksum mismatch as a hard error, unlock in `finally`. Preserve baseline bytes.

```sql
SELECT pg_advisory_lock(33050339);
CREATE TABLE IF NOT EXISTS app_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] For an untracked database, replay the idempotent baseline and verify `tg_jobs`, `tg_work`, `tg_budgets`, `tg_outbox`, required columns, primary/unique keys and foreign keys using `information_schema`/`pg_catalog` before recording `0000`. Missing incompatible columns/constraints fail with their names. Never drop tables to repair adoption.
- [ ] Add fresh-schema, concurrent-runner, transaction rollback, deliberately edited checksum, partial-baseline rejection and data-preservation cases. Replace integration setup's direct baseline queries with `createTestDatabase()`; teardown drops only its own schema.
- [ ] Run the migration tests and existing integration suite. Commit only this task's files: `git commit -m "chore: version PostgreSQL migrations safely"` after explicit staging.

### Task 2: Pin Better Auth and add ownership/retention schema

**Files:** Create `src/server/auth/options.ts`, `src/server/auth/schema-config.ts`, `src/domain/accounts/contracts.ts`, `drizzle/0001_auth.sql`, `drizzle/0002_report_accounts.sql`, `tests/support/accounts.ts`, `tests/integration/account-schema.test.ts`, `src/server/auth/options.test.ts`. Modify `package.json`, `pnpm-lock.yaml`.

**Interfaces:** Produce the shared contracts above. `authOptions(env: NodeJS.ProcessEnv): BetterAuthOptions` is pure and does not connect to the DB. Test-only helpers: `seedAccount(id?: string): Promise<AccountIdentity>`; `seedTerminalReport(options?: {accountId?: string; expiresAt?: Date}): Promise<{jobId:string; token:string; ownerKey:string}>`. Fixtures use `fixtureRequest()`, existing admission/worker test evaluator and frozen serialization; set account_id explicitly in fixture SQL until signed admission exists. Seed a terminal settled job with results, without publishing a library entry. `seedAccount` inserts the generated user/account columns and returns test session metadata; it does not expose a login bypass. No production test login route.

- [ ] Write config tests asserting the provider is Discord only, default scopes disabled, placeholder email unverified, no linking, seven-day session and no cookie cache. Write schema test inserting two library entries for one job and expecting PostgreSQL unique violation `23505`.
- [ ] Run focused unit/integration tests and record failure before adding the schema.
- [ ] Install pinned packages during execution:

```sh
pnpm add --save-exact better-auth@1.7.4
pnpm add -D --save-exact auth@1.7.4
```

The registry was checked on 2026-09-10: `better-auth` and `auth` were 1.7.4; legacy `@better-auth/cli` was 1.4.21. Use the matching `auth` CLI, not an unpinned legacy generator.

- [ ] Implement the options core below; require and validate server configuration in `config.ts` (Task 3), keeping the options file importable for schema generation. Map generated auth fields to snake_case where application SQL uses them: user `email_verified`, `created_at`, `updated_at`; session `user_id`, `created_at`, `updated_at`, `expires_at`, `ip_address`, `user_agent`; account `user_id`, `account_id`, `provider_id`, token/date fields; verification date fields.

```ts
// Core options merged with modelName/fields maps and credentials by authOptions.
const settings = {
  user: { modelName: "auth_user", deleteUser: { enabled: false }, changeEmail: { enabled: false } },
  session: {
    modelName: "auth_session", expiresIn: 604800, updateAge: 86400,
    freshAge: 300, cookieCache: { enabled: false },
  },
  account: {
    modelName: "auth_account", encryptOAuthTokens: true,
    storeStateStrategy: "database", storeAccountCookie: false,
    accountLinking: { enabled: false },
  },
  verification: { modelName: "auth_verification" },
  rateLimit: { enabled: true, storage: "database", modelName: "auth_rate_limit", window: 60, max: 100 },
  emailAndPassword: { enabled: false },
} satisfies BetterAuthOptions;
```

- [ ] Generate SQL from the configured native PostgreSQL adapter using `pnpm exec auth generate --help` then `pnpm exec auth generate --config ./src/server/auth/schema-config.ts --output ./drizzle/0001_auth.sql`. The generator-only `schema-config.ts` exports `auth = betterAuth({...authOptions(process.env), database:pool})` and is never imported by runtime code. Load local environment variables when invoking the CLI; Task 3 adds lazy runtime configuration and route exposure. Use a local development environment, never CLI `migrate` against production. Inspect emitted SQL and types; ensure all five `auth_` tables, indexes and foreign keys are in the migration. Record the exact successful generator command in the runbook.
- [ ] Write application migration with these concrete columns:

```sql
CREATE TABLE account_lifecycle (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleting')),
  deletion_requested_at timestamptz
);
ALTER TABLE tg_jobs ADD COLUMN account_id text REFERENCES auth_user(id) ON DELETE SET NULL;
ALTER TABLE tg_jobs ADD COLUMN deleted_at timestamptz;
ALTER TABLE tg_jobs ADD COLUMN scrubbed_at timestamptz;
ALTER TABLE tg_jobs ADD COLUMN published_at timestamptz;
CREATE INDEX tg_jobs_account_created ON tg_jobs(account_id, created_at);
CREATE TABLE library_items (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_user(id),
  job_id uuid NOT NULL UNIQUE REFERENCES tg_jobs(id),
  tool text NOT NULL CHECK(tool='top-gear'),
  kind text NOT NULL CHECK(kind='report'),
  title text NOT NULL CHECK(length(title)<=160),
  character_name text NOT NULL CHECK(length(character_name)<=80),
  summary jsonb NOT NULL CHECK(octet_length(summary::text)<=4096),
  created_at timestamptz NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX library_user_page ON library_items(user_id,saved_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE TABLE report_save_intents (
  token_hash text PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES tg_jobs(id) ON DELETE CASCADE,
  owner_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  completed_at timestamptz,
  completed_by text REFERENCES auth_user(id) ON DELETE SET NULL
);
CREATE INDEX save_intent_expiry ON report_save_intents(expires_at);
```

- [ ] Add safe scrubbing support: make `request`, `policy`, `token_cipher` nullable, and add a constraint permitting null only when `deleted_at IS NOT NULL AND scrubbed_at IS NOT NULL AND settled`. All live-job reads narrow away deleted records before decoding. Replace the actual catalog-discovered `prior_job` FK with `ON DELETE SET NULL`.
- [ ] Keep deleted-job skeletons containing only IDs/hashes/idempotency keys, ownership until account cleanup, timestamps and budget accounting. Scrub snapshots, plan, work, report, source hash, encrypted read token and freeform errors after settlement. These small operational tombstones preserve idempotency rejection and current-day quotas without retaining character payloads. Do not delete them through ordinary expiry cleanup. Account cleanup clears their account foreign key before deleting the auth user; spent budgets remain aggregates. This is the concrete implementation of the spec's minimal operational-record exception.
- [ ] Add trigger-backed lifecycle enforcement: an `AFTER INSERT` trigger on `auth_user` inserts the active lifecycle row; a `BEFORE INSERT` trigger on `auth_session` locks that row and rejects absent/deleting accounts. This closes the session-create/account-delete race which a preflight hook alone cannot close. Backfill lifecycle rows for any auth users created during migration validation.
- [ ] Implement fixture helpers with generated auth columns and real hashed/encrypted capabilities; initialize every suite with Task 1 support. Run schema/config tests plus typecheck. Commit as `feat: define account and retained report storage`.

### Task 3: Expose Discord authentication and trustworthy request identity

**Files:** Modify `src/server/auth/options.ts`; create `config.ts`, `errors.ts`, `identity.ts`, `account-lock.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/api/account/session/route.ts`, `tests/integration/authentication.test.ts`, `src/server/auth/identity.test.ts`.

**Interfaces:** `getIdentity(request: NextRequest): Promise<RequestIdentity>`; `requireAccount(identity: RequestIdentity): AccountIdentity`; `lockActiveAccount(client: pg.PoolClient, userId:string): Promise<void>`; `getAuth(): ReturnType<typeof betterAuth>` lazily creates the runtime singleton. `/api/account/session` returns `{account:PublicAccount|null, savingEnabled:boolean, enrollmentEnabled:boolean}` with private no-store headers. It returns 503 on auth/storage failure, not anonymous success.

- [ ] Write identity tests for missing, expired and revoked sessions; cookie presence without a DB session; unavailable DB; and a deleting account. Include phone-only Discord mapping:

```ts
expect(authOptions(env).socialProviders?.discord).toMatchObject({
  disableDefaultScope: true, scope: ["identify"],
});
// In the provider callback test, inspect the inserted auth_user row:
expect(user.email).toBe("123456789@discord.placeholder.invalid");
expect(user.email_verified).toBe(false);
```

Here `env` is a local object containing `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `AUTH_ENROLLMENT_ENABLED`; no real credentials belong in tests.
- [ ] Run `pnpm exec vitest run --project unit src/server/auth/identity.test.ts --project integration tests/integration/authentication.test.ts` and record failure.
- [ ] Configure Discord `mapProfileToUser` to map every provider ID to the placeholder email. Leave provider display-name/avatar handling intact. Set `disableSignUp` when enrollment is disabled, verify existing-account sign-in still works, and enforce the same enrollment rule in `databaseHooks.user.create.before` as a race-safe policy check. Keep token encryption supported by the pinned adapter.
- [ ] Keep runtime auth initialization lazy. When credentials are absent and both rollout flags are false, session endpoint returns anonymous/disabled only when no auth session cookie exists; a present session cookie must yield unavailable, not an anonymous downgrade. On configured systems always validate sessions, including during rollback. Static rendering and worker imports must not initialize Better Auth. Wrap auth handler configuration/storage errors in sanitized 503 responses.
- [ ] Set `baseURL` from a validated fixed `BETTER_AUTH_URL`; require it to match `APP_ORIGIN`. Trusted origins contain that exact origin. Use host-only cookies, production Secure, OAuth-compatible library defaults; do not alter `tg_owner`'s Strict policy. For Vercel use only the platform's trusted client-IP source for rate limiting, preserving existing source-hash logic; reject arbitrary forwarded-header trust.
- [ ] Expose only the needed auth paths. Disable `/delete-user`, `/change-email`, `/update-user`, `/link-social`, `/unlink-account`, `/get-access-token`, `/refresh-token` plus password/email flows verified in the pinned endpoint definitions. Preserve sign-in/social, callback/discord, session refresh/read and sign-out. Test disabled endpoints via the actual handler, not just config snapshots.

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/config";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}
export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
```

- [ ] Implement request identity via `getAuth().api.getSession({headers:request.headers,query:{disableRefresh:true}})` for protected-operation identity reads, map only safe fields and verify active lifecycle. Derive `ownerHash` using existing cookie parser/digest. `requireAccount` throws 401 when absent. `lockActiveAccount` executes `SELECT status FROM account_lifecycle WHERE user_id=$1 FOR UPDATE`, throws 404/409 for absent/deleting rows. Never hold this lock while calling the provider.
- [ ] The custom `/api/account/session` endpoint owns sliding refresh: call `getAuth().api.getSession({headers:request.headers,returnHeaders:true})`, validate the returned account lifecycle, map `response` to the public DTO, and append every returned `headers.getSetCookie()` value separately to the outgoing response. Retain private no-store headers. Do not discard renewal headers or comma-join cookies. Test both DB expiry extension and renewed browser-cookie expiry after daily refresh.
- [ ] Test actual DB revocation and concurrent attempted session insertion during account tombstoning; confirm no valid session survives. Hook checks improve errors, but DB trigger is the final write barrier. Verify anonymous job worker startup without Discord environment variables.
- [ ] Run focused tests and typecheck. Commit as `feat: add Discord-only database sessions`.

### Task 4: Centralize report reading and permissions

**Files:** Create `src/server/reports/access.ts`, `read.ts`, `projection.ts`, `src/server/reports/access.test.ts`, `tests/integration/report-access.test.ts`. Modify `src/server/jobs/work.ts`, `src/app/api/reports/[token]/route.ts` and existing report-read test imports.

**Interfaces:** `OwnershipRecord = {ownerHash:string; accountId:string|null; deletedAt:Date|null; accountDeleting:boolean; retained:boolean; expiresAt:Date; eligible:boolean}`; `reportAccess(record:OwnershipRecord, identity:RequestIdentity, now:Date): ReportAccess`; `readReport(token:string, identity?:RequestIdentity):Promise<{jobId:string; report:TopGearReport; access:ReportAccess; canManage:boolean; error:string|null}>`. Keep `canManage` as a compatibility alias during this change. Move existing projection into `projectReport(jobId:string):Promise<TopGearReport>` with existing serializer behavior, not new simulation calculations.

- [ ] Write the no-fallback permission test:

```ts
it("does not give the original browser account-owned management after sign-out", () => {
  const access = reportAccess({
    ownerHash:"browser", accountId:"account-a", deletedAt:null,
    accountDeleting:false, retained:true, expiresAt:new Date(0), eligible:true,
  }, {account:null, ownerHash:"browser"}, new Date());
  expect(access).toMatchObject({saved:true, effectiveExpiresAt:null, canManage:false, canSave:false});
});
```

- [ ] Run the focused access test; expect missing function failure.
- [ ] Implement the governing rule and derive capabilities from it:

```ts
const owns = record.accountId !== null
  ? identity.account?.id === record.accountId
  : identity.ownerHash !== null && identity.ownerHash === record.ownerHash;
const expired = !record.retained && record.expiresAt <= now;
```

Deleted/deleting and expired checks precede reads, claims and management. `canSave` requires eligible terminal successful results, anonymous ownership, not deleted/expired; `canDelete` requires owning account and retained report. Active account-owned runs canManage before publication; failed empty jobs do not become retained.
- [ ] Move current historical normalization, pinned recommendations and projection intact from `work.ts`. Keep tests proving legacy recommendation recalculation does not mutate frozen results. The worker imports projection; `read.ts` does not import the execution module or auth config.
- [ ] Add integration matrix: valid public token, wrong token, anonymous expiry, retained past old expiry, matching/different account, old owner cookie after claim, deleted records, absent library retention for failed jobs. Use the DB's `now()` for authoritative expiry queries. A 503 session resolution failure cannot be converted into owner management.
- [ ] Report route keeps its existing 20-result pagination; add `access` outside `report`. No token/hash/account ID leaks. Run all existing report/orchestration tests and new tests. Commit as `refactor: centralize report access and retention metadata`.

### Task 5: Build transactional library publication and bounded queries

**Files:** Create `src/server/library/report-summary.ts`, `repository.ts`, `tests/integration/library.test.ts`, `src/server/library/report-summary.test.ts`, `src/app/api/library/route.ts`, `src/app/api/library/[id]/open/route.ts`. Extend `tests/support/accounts.ts` with the publication fixture below.

**Interfaces:** `summarizeReport(report:TopGearReport):LibrarySummary`; `publishReport(client:pg.PoolClient, input:{jobId:string; userId:string; report:TopGearReport}):Promise<string|null>`; `listLibrary(userId:string, query:LibraryQuery):Promise<LibraryPage>`; `libraryReportPath(userId:string,itemId:string):Promise<string>`. `publishReport` caller already holds active-account and job locks; it checks deletion itself, does not acquire locks in reverse order, and ignores new-saving flags for admitted work.

- [ ] Write owner-isolation and idempotency tests, including the essential query assertion:

```ts
const a = await seedAccount("library-a");
const b = await seedAccount("library-b");
const job = await seedTerminalReport({accountId:a.id});
await publishSeededReport(job, a);
expect((await listLibrary(a.id, {})).items).toHaveLength(1);
expect((await listLibrary(b.id, {})).items).toEqual([]);
await expect(libraryReportPath(b.id, (await listLibrary(a.id, {})).items[0].id))
  .rejects.toMatchObject({status:404});
```

- [ ] Run `pnpm exec vitest run --project integration tests/integration/library.test.ts`; expect missing publication/query failure.
- [ ] Define test-only `publishSeededReport(job:{jobId:string;token:string}, account:AccountIdentity):Promise<string|null>` in accounts support: read the seeded report with `readReport(job.token,{account,ownerHash:null})`; inside `transaction`, call `lockActiveAccount`, select job `FOR UPDATE`, then return `publishReport(client,{jobId:job.jobId,userId:account.id,report:data.report})`. The original seed helper stays publication-free, so schema tests do not depend on this task.
- [ ] Implement summary from the actual report's recommended row, falling back to highest, and equipped DPS for gain. Use current class/spec registry; no hardcoded warrior metadata. Require finite numbers, bounded strings and at least one successful result. Publication uses `INSERT ... ON CONFLICT(job_id) DO NOTHING`, verifies any existing entry belongs to the same user and is not deleted, then sets `published_at`. An existing tombstone is never updated to active.
- [ ] Query 21 rows and return 20 with next cursor `(saved_at,id)` encoded as bounded base64url JSON; parse timestamp and UUID, reject malformed cursors with 400. Search maximum 100 trimmed characters, escape `%`, `_`, `\` for literal `ILIKE`, parameterize all SQL. Filter user/deleted state in SQL. Order `saved_at DESC,id DESC`, use `<` tuple for next page. Tool filter accepts only `top-gear`.

```sql
SELECT id,tool,kind,title,summary,created_at,saved_at
FROM library_items
WHERE user_id=$1 AND deleted_at IS NULL
ORDER BY saved_at DESC,id DESC
LIMIT 21;
```

- [ ] `/api/library` resolves account and returns no-store JSON; `/api/library/[id]/open` checks the caller and live job before decrypting its existing token, then returns `{reportPath}`. Never return token cipher/owner hash from listing. Keep link resolution a read-only request.
- [ ] Test search escaping, invalid cursors, equal timestamps, multiple pages, partial/canceled successful reports, failed empty reports, deleted entries and response payload excluding full report/request fields. Run tests/typecheck. Commit as `feat: add private Gear Lab report library`.

### Task 6: Associate signed-in runs and publish without a browser

**Files:** Modify `src/server/jobs/admit.ts`, `work.ts`, `policy.ts`, `src/app/api/top-gear/jobs/route.ts`, `src/app/api/top-gear/jobs/[id]/retry/route.ts`, `src/app/api/top-gear/jobs/[id]/cancel/route.ts`, `tests/integration/orchestration.test.ts`. Create `tests/integration/account-jobs.test.ts`.

**Interfaces:** Extend existing `admitJob` input with `identity?:RequestIdentity` (server-only; legacy service tests can omit), keeping existing request/ownerKey/idempotencyKey/priorJob/sourceHash and result unchanged. `cancelJob(id:string, identity:RequestIdentity):Promise<void>` and `retryJob(id:string, identity:RequestIdentity, idempotencyKey:string, ownerKey:string, sourceHash?:string):Promise<existing admission result>` replace browser-only authorization. HTTP admission adds sibling `authMode?:AuthMode` outside the frozen simulation request.

- [ ] Add tests for signed-in admission, retry from a different browser, another account reusing an idempotency key and automatic publication without reading the result in a browser:

```ts
const account = await seedAccount();
const ownerKey = capability();
const job = await admitJob({
  request: encodeRequest(fixtureRequest()), ownerKey, idempotencyKey:randomUUID(),
  identity:{account, ownerHash:digest(ownerKey)},
});
expect((await pool.query("SELECT account_id FROM tg_jobs WHERE id=$1", [job.jobId])).rows[0].account_id).toBe(account.id);
```

- [ ] Run focused account-job tests; capture failures before modifying admission/finish.
- [ ] Parse `authMode` in the route. `account` requires valid session and saving enabled; expired/unavailable auth returns 401/503 without admission. Explicit `anonymous` creates anonymous work even if logged in; the UI must label that consequence. Legacy omission resolves real server identity and associates a session when present. Never accept a user ID. Existing anonymous owner cookie still binds idempotency.
- [ ] In admission transaction acquire account lock first, then existing global admission lock; validate prior report ownership/deletion/expiry before replaying token or copying work. On idempotency replay also verify the original admission mode/account matches the requested mode; an anonymous existing job cannot silently satisfy an account-saving request, or vice versa (409). Count account active/daily jobs in addition to browser/source/global limits, using current limits (2/20); deleted skeletons count for daily usage. Do not add `deleted_at IS NULL` to daily-count queries. Admission stores account_id with job/outbox atomically.
- [ ] In `finish`, obtain job's account ID without a row lock, lock lifecycle if present, then lock/re-read job. Retain the existing settlement algorithm, but publish within its transaction before commit. For deleting accounts/deleted jobs, settle consumed budget and skip publication. Null report for deleted jobs rather than exposing projected results. Publication failures roll back settlement so worker recovery can retry. Existing jobs admitted with an account still publish when saving flag later turns off.
- [ ] Parameterize a race test over complete, partial, canceled-with-results and empty failure; duplicate delivery produces one library entry. Inject a database failure at library INSERT and verify `settled=false`, then remove the fault and retry settlement successfully. Race publication against account tombstone using two transactions and barriers, not arbitrary sleeps.
- [ ] Run integration tests plus existing simulator tests covering retry/settlement, and typecheck. Commit as `feat: save signed-in runs transactionally`.

### Task 7: Add owner-bound save intents and direct claiming

**Files:** Create `src/server/library/claims.ts`, `tests/integration/report-claims.test.ts`, `src/app/api/reports/[token]/save-intent/route.ts`, `src/app/api/reports/[token]/save/route.ts`, `src/app/api/library/save-intents/complete/route.ts`. Modify `src/server/http/api.ts` to serialize `AccountError` safely alongside existing errors.

**Interfaces:** `beginSaveIntent(reportToken:string, identity:RequestIdentity):Promise<SaveIntent>`; `completeSaveIntent(intentToken:string, identity:RequestIdentity):Promise<ClaimResult>`; `claimReport(reportToken:string, identity:RequestIdentity):Promise<ClaimResult>`. Begin/claim requires new saving enabled; an already issued intent can finish when rollout disables new saving, while its ten-minute lifetime and all permissions still apply. Claims use Task 5 publication and Task 4 access checks.

- [ ] Add successful/repeated claim and public-viewer rejection tests:

```ts
const account = await seedAccount();
const job = await seedTerminalReport();
const identity = {account:null, ownerHash:digest(job.ownerKey)};
const intent = await beginSaveIntent(job.token, identity);
const signedIn = {...identity, account};
const first = await completeSaveIntent(intent.token, signedIn);
expect(await completeSaveIntent(intent.token, signedIn)).toEqual(first);
await expect(beginSaveIntent(job.token, {account:null, ownerHash:"someone-else"}))
  .rejects.toMatchObject({status:404});
```

- [ ] Run `pnpm exec vitest run --project integration tests/integration/report-claims.test.ts`; expect missing service failure.
- [ ] Begin intent in a transaction: look up report token hash, lock job, verify matching owner and anonymous/nondeleted/unexpired/eligible state, cap this owner's outstanding intents at 5, generate existing `capability()`, insert only `digest(token)`. Return raw opaque token exactly once. Query expiry using database time. Prune expired intents; repeated valid attempts do not mutate reports.
- [ ] Complete requires a valid account and original owner cookie. Lock lifecycle, intent, then job. Check ownerHash and eligibility again. A completed intent can be retried by the same account/original browser only while the report is still live and owned by that account; another account gets conflict and no report path. Uncompleted expired intent gets `INTENT_EXPIRED`; expired report gets 410. Transaction sets account_id, calls `publishReport`, then marks intent completed_by/completed_at. No external requests inside transaction.

```sql
UPDATE tg_jobs SET account_id=$2
WHERE id=$1 AND account_id IS NULL AND deleted_at IS NULL;
UPDATE report_save_intents SET completed_by=$2,completed_at=now()
WHERE token_hash=$1 AND completed_at IS NULL;
```

Both updates follow locked validation. Assert expected affected rows rather than treating a lost ownership race as success.
- [ ] Direct claim uses the same transaction/locking rules, without manufacturing OAuth state. An already-owning active account gets the existing live entry idempotently. General sign-in never invokes either claim service.
- [ ] Routes are same-origin JSON POSTs. Begin and direct claim bodies are `{}`; completion body is `{token:string}` with the existing 43-character capability format. Apply a small 2 KiB body limit for these endpoints, not the import limit. Return 201 for begin, 200 for claim/complete; no-store/no-referrer everywhere. Reject array/unknown body keys, cross-origin requests and missing content type.
- [ ] Add two-connection tests: competing accounts; changed/missing cookie; report deleted or expired during OAuth; same-account retry; missing token; disabled-saving new request versus already-issued completion; no successful rows. Verify rollback leaves neither account ownership nor a library entry on failure. Run focused tests/typecheck and commit as `feat: claim anonymous reports after Discord sign-in`.

### Task 8: Make deletion and cleanup durable and race-safe

**Files:** Create `src/server/accounts/deletion.ts`, `src/server/reports/cleanup.ts`, `tests/integration/account-deletion.test.ts`, `tests/integration/report-retention.test.ts`, `src/app/api/library/[id]/route.ts`, `src/app/api/account/delete/route.ts`. Modify `src/server/jobs/reconcile.ts`, `src/trigger/recovery.ts` if reporting needs adjustment, and operational docs.

**Interfaces:** `deleteLibraryReport(userId:string, itemId:string):Promise<void>`; `requestAccountDeletion(identity:RequestIdentity, expectedUserId:string):Promise<void>`; `cleanupReports():Promise<{scrubbed:number; expired:number}>`; `cleanupAccounts():Promise<{deleted:number; pending:number}>`. Helpers take server-validated account identity, not an arbitrary client user ID. `expectedUserId` confirms identity and is compared to the session; it never chooses the account to delete.

- [ ] Write immediate-access and quota-preservation tests:

```ts
const account = await seedAccount();
const job = await seedTerminalReport({accountId:account.id});
await publishSeededReport(job, account);
const [entry] = (await listLibrary(account.id, {})).items;
await deleteLibraryReport(account.id, entry.id);
await expect(readReport(job.token, {account, ownerHash:null})).rejects.toMatchObject({status:404});
await cleanupReports();
const row = (await pool.query("SELECT request,report,token_cipher,settled FROM tg_jobs WHERE id=$1", [job.jobId])).rows[0];
expect(row).toMatchObject({request:null, report:null, token_cipher:null, settled:true});
expect((await pool.query("SELECT count(*) FROM tg_jobs WHERE account_id=$1", [account.id])).rows[0].count).toBe("1");
```

- [ ] Run the two retention/deletion suites and record failure.
- [ ] Implement report deletion transaction: lock active account then job (look up item ID without locking first), validate ownership, mark both job and entry deleted with one timestamp. Repeated deletion by same owner is idempotent while tombstones exist. Return 204. No new save entry can replace the deleted unique job entry.
- [ ] Implement account deletion: require session created within 300 seconds, exact expected identity and active lifecycle; transaction marks lifecycle deleting, all its jobs/library entries deleted, active jobs cancel_requested, and deletes every auth_session for the user. Return 202 `{status:"deleting"}`. DB session trigger blocks concurrent issuance. Never expose Better Auth's independent hard-delete endpoint.
- [ ] Implement bounded cleanup passes (100 candidates each, `FOR UPDATE SKIP LOCKED`); lock lifecycle before account-owned job. Explicitly deleted, settled jobs lose `tg_work`, `tg_outbox`, request/policy/plan/report, token cipher, source hash and error text; set scrubbed_at. Detach children's prior_job when scrubbing explicit deletions. Keep current budget totals and operational job skeletons; idempotency replays must still fail 404.
- [ ] Ordinary anonymous expiry cleanup retains the seven-plus-thirty-day behavior, skips unsettled jobs, retained live library entries, deleted tombstones and prior-job references. Recheck eligibility under lock to serialize with saves. Failed empty account runs follow ordinary expiry; account association alone is insufficient retention. Do not use a single unguarded bulk DELETE.
- [ ] Account cleanup waits for every dependent job to settle and be scrubbed, removes all owned library entries, relevant save intents (including completed_by references), provider accounts, sessions and verification records belonging to that account as supported by the generated schema; clears job account_id, then deletes auth_user/lifecycle. Do not delete verification state belonging to other users. At sign-in during cleanup the existing provider/account linkage remains until final transaction, so deletion blocks resurrection. A subsequent new Discord account starts empty.
- [ ] Recovery order: settle queued/canceled jobs and recover leases, cleanup reports, cleanup accounts. Keep ten-minute production schedule. Catch/report sanitized failure by pass so next run retries; monitor oldest deletion timestamp. Never mark deletion done merely because session revocation worked.
- [ ] Add races for claim-versus-expiry, deletion-versus-publication, session creation-versus-account deletion, worker crash/cleanup retry, pending reservations, detached retry survival, repeated account deletion, new sign-in after final cleanup and wrong-account fresh reauthentication. Verify saved read links survive original expiry and unsigned old reports still clean up. Run integration/simulator checks and commit as `feat: revoke and clean up saved reports safely`.

### Task 9: Integrate account controls with the shared top bar

**Files:** Create `src/features/auth/client.ts`, `AuthProvider.tsx`, `AccountMenu.tsx`, `SignInDialog.tsx`, `DiscordIcon.tsx`, `auth.css`, `AuthProvider.test.tsx`, `SignInDialog.test.tsx`. Modify `src/features/shell/AppDocument.tsx`, `WorkbenchNavigation.tsx`, `shell.css`, `src/i18n/messages-en.ts`, `messages-pt.ts`, `messages-home-en.ts`, `messages-home-pt.ts`.

**Interfaces:** Export `authClient = createAuthClient()` from `better-auth/react`. `AuthState = {status:"loading"|"anonymous"|"authenticated"|"unavailable"; account:PublicAccount|null; savingEnabled:boolean; enrollmentEnabled:boolean}`. `useAccount():AuthState & {refresh():Promise<void>; signOut():Promise<void>}`; `AuthProvider({children}:{children:ReactNode})`; `SignInDialog({open,onOpenChange,callbackPath}:{open:boolean;onOpenChange:(open:boolean)=>void;callbackPath:string})`. It never claims a report itself.

- [ ] Add a UI test where `/api/account/session` returns 503: the provider shows retry/unavailable, not a sign-in success or anonymous default. Add sign-out test clearing account-specific children immediately after server success while local draft storage remains unchanged.
- [ ] Run `pnpm exec vitest run --project ui src/features/auth/AuthProvider.test.tsx src/features/auth/SignInDialog.test.tsx`; expect missing component failures.
- [ ] Implement provider as a client-only boundary around shell children. Use no-store fetch plus AbortController/generation key; never apply an old account response after logout/login change. Subscribe to Better Auth session changes and window focus; refresh the sanitized session endpoint. Broadcast account invalidation across tabs with `BroadcastChannel`, with storage-event fallback; broadcast no tokens or profile payloads. Protected server checks remain authoritative.

```tsx
// In AppDocument: retain server locale loading and existing providers.
<AuthProvider>
  <AppShell>{children}</AppShell>
</AuthProvider>
```

- [ ] Render desktop My Library and Discord/account controls in `WorkbenchHeader`, which is exported from **`WorkbenchNavigation.tsx`**, not a file named WorkbenchHeader.tsx. Include the same account actions in mobile navigation. Reserve a stable utility-slot size during loading; unavailable state offers retry without shifting the nav. Use Paper's top bar; do not reintroduce the old sidebar.
- [ ] Build the focused sign-in dialog with the current Base UI wrappers. Primary Continue with Discord, secondary Continue without signing in, X/Escape, no email form. Discord mark is a small SVG; use existing dark surfaces, green action and icon/text spacing. Validate callback before `authClient.signIn.social({provider:"discord",callbackURL:callbackPath,errorCallbackURL:callbackPath})`.
- [ ] Add initial EN/PT namespaces to **both** home and workbench catalogs. Account menu includes My Library, sign out, delete account; delete UI wired in Task 11. Preserve local drafts on sign-out. Test keyboard navigation, focus return, 390px mobile width, loading slot and no automatic dialog.
- [ ] Run UI tests, typecheck and production build; `/en-us` and `/pt-br` remain prerendered. Commit as `feat: add Discord account controls to shared navigation`.

### Task 10: Preserve report context through authentication and saving

**Files:** Create `src/features/auth/return-state.ts`, `return-state.test.ts`, `AuthReturn.tsx`, `src/app/(workbench)/auth/return/page.tsx`, `src/features/reports/ReportSave.tsx`, `ReportSave.test.tsx`. Modify `src/features/reports/ReportView.tsx`, `use-report.ts`, `src/features/inventory/TopGearApp.tsx`, locale catalogs and report tests.

**Interfaces:** `safeReturnPath(value:string, origin:string):string` accepts same-origin app-relative destinations and falls back to `/top-gear`; it rejects protocol-relative URLs, auth API routes, backslashes and recursive `/auth/return`. `storeReturnState(flowKey:string,state:ReportViewState):void`; `loadReturnState(flowKey:string):ReportViewState|null`; `clearReturnState(flowKey:string):void`. These three storage functions store report flows only. Also export `storeSignInReturn(flowKey:string,state:{returnPath:string;locale:"en-US"|"pt-BR";expectedUserId?:string}):void`, `loadSignInReturn(flowKey:string):{returnPath:string;locale:"en-US"|"pt-BR";expectedUserId?:string}|null`, and `clearSignInReturn(flowKey:string):void` for general sign-in/fresh reauthentication. Keys are the opaque save intent or independent random flow ID; prefixes separate the two payload shapes. `ReportSave({token,access,onSaved}:{token:string;access:ReportAccess;onSaved:()=>void})`. Extend `useReport<T>(url:string,resourceKey?:string)` with returned `refresh():void` while preserving existing fields and pagination behavior.

- [ ] Add pure return validation and hostile-storage tests:

```ts
expect(safeReturnPath("//evil.example/path", "https://munigan.app")).toBe("/top-gear");
expect(safeReturnPath("/reports/abc?auth=secret", "https://munigan.app")).toBe("/reports/abc");
expect(safeReturnPath("/pt-br", "https://munigan.app")).toBe("/pt-br");
```

Store a versioned payload; validate locale, bounded nonnegative scroll, page multiple of 20, selectedId length and comparison enum. Session storage errors remain recoverable before leaving the page, not swallowed.
- [ ] Add ReportSave UI tests for dismiss, dialog opening only on click, shared viewer lacking save action, saving pending, save failure after auth success and saved only after API success. Run focused unit/UI tests and record failures.
- [ ] Implement optional inline notice using actual effective expiry and character/spec context. Dismissal is scoped to report in sessionStorage; keep quiet expiry/save affordance. Signed-in anonymous owner direct-saves; signed-out owner creates intent first, stores selection/page/comparison/scroll and locale, then opens Discord with `/auth/return?intent=<opaque>`.
- [ ] General sign-in stores only a validated return path plus locale under a random flow key; callback `/auth/return?flow=<opaque>`. It never begins a report claim. Keep report share action canonical: `${location.origin}/reports/${token}` with no flow/cursor/account parameters.
- [ ] Return page captures and removes query secrets immediately with `history.replaceState`, then runs same-origin completion POST for an intent, **after** OAuth's callback navigation. It must not rely on Strict cookie presence on the cross-site callback. Preserve captured token in per-tab storage until success or explicit abandonment; do not log URL/query. OAuth cancellation/missing session shows a retry/back action. Successful auth + failed save stays authenticated and offers save retry. Set page metadata noindex/nofollow/no-referrer and response no-store.
- [ ] Restore state after report data is ready. Restore selectedId from returned rows, otherwise recommended/highest; fetch preserved page first. Restore scroll once via requestAnimationFrame after content layout, not on later polling/pages. Clear consumed flow storage. For lost/expired flow, show explanation and safe return, not claim success.
- [ ] Add explicit hook refresh by internal revision counter in effect dependencies; retain current report data during refresh. After claim, increment revision even when report polling had stopped at complete. On account change immediately hide privileged controls until access revalidation; don't continue to render stale canManage. Use identity key to abort stale permission responses without unnecessarily clearing public report results.

```ts
const [revision, setRevision] = useState(0);
const refresh = useCallback(() => setRevision(value => value + 1), []);
// Include revision in existing fetch-effect dependencies; return refresh.
```

- [ ] At Gear Lab submit, send `authMode:"account"` when account is active and saving expected; 401/503 preserves draft and offers sign-in/retry or explicit Run without saving. Explicit continuation sends `authMode:"anonymous"` and a new idempotency intent only after the first request is known not admitted; retain the same key for uncertain network outcomes to avoid duplicate jobs. Resolve ambiguous admission by retrying the original mode/key; if it remains unavailable, retain the draft and disable mode switching until resolved.
- [ ] Every report expiry display uses `data.access.effectiveExpiresAt`, not frozen `report.expiresAt`. Add regression for saved report whose frozen expiry is yesterday. Run return/save/hook tests, existing pagination/draft tests and typecheck. Commit as `feat: preserve report context through Discord saving`.

### Task 11: Build My Library and deletion confirmation

**Files:** Create `src/app/(workbench)/library/page.tsx`, `src/features/library/LibraryView.tsx`, `use-library.ts`, `DeleteReportDialog.tsx`, `library.css`, `LibraryView.test.tsx`, `src/features/auth/DeleteAccountDialog.tsx`, `DeleteAccountDialog.test.tsx`. Modify `AccountMenu.tsx` and locale catalogs.

**Interfaces:** `useLibrary(query:LibraryQuery):{data:LibraryPage|null;pending:boolean;error:AccountErrorCode|null;refresh:()=>void}`; `LibraryView():ReactNode`; `DeleteReportDialog({item,onDeleted}:{item:LibraryItem;onDeleted:()=>void})`; `DeleteAccountDialog({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void})`. Account change is part of library resource identity; never use a global unkeyed cache.

- [ ] Write test for stale response isolation: start account A list fetch, switch to B, resolve A response, assert A character never renders; assert sign-out clears rows immediately. Also test keeping current rows during same-account page loading and no scrollTo call.
- [ ] Run `pnpm exec vitest run --project ui src/features/library/LibraryView.test.tsx src/features/auth/DeleteAccountDialog.test.tsx`; expect missing component failures.
- [ ] Implement private list with Paper's character/spec image, Gear Lab/report label, title, summary DPS, saved date and contextual delete action. Open resolves authorized path before navigation. Search debounced 200ms, bounded 100 characters, resets cursor; 20 rows, next/back cursor history; no blinking/scroll-to-top. Tool filter contains only available supported keys; omit unnecessary selector if only Gear Lab exists. No fake future saved records.
- [ ] Match Paper's empty, signed-out, search-empty, error/retry, pending and mobile states. Share and library access use server paths. Do not infer deletion from a load error. Page is noindex/nofollow; no private data in page metadata or shared caches.
- [ ] Delete report confirmation names character and states its shared link will stop working. Use existing Base UI dialog/close, destructive visual style, pending guard, failure retry and focus restoration. DELETE `/api/library/[id]` sends same-origin JSON `{}`; refresh list after success and invalidate any open report access.
- [ ] Account deletion confirmation displays current Discord name/avatar and explains saved reports/shared links, in-progress jobs and current-browser draft removal. POST `{expectedUserId:account.id}` to `/api/account/delete`. If fresh login required, capture expected account ID in `storeSignInReturn` per-tab reauth context, perform Discord sign-in, then require **another explicit confirmation** after matching returned account ID. Do not auto-delete on OAuth return; different account displays conflict and deletes neither.
- [ ] Successful account deletion clears account/library UI, current-browser draft-store keys and auth-return state, and broadcasts invalidation. Tell the user access is removed and cleanup is processing. Sign-out alone does not clear drafts. Other devices' local-only drafts and backup deletion are not promised erased.
- [ ] Run library/delete UI tests, integration deletion tests, typecheck. Commit as `feat: add My Library and account deletion controls`.

### Task 12: Finish bilingual copy and Gear Lab naming

**Files:** Modify `src/i18n/messages-en.ts`, `messages-pt.ts`, `messages-home-en.ts`, `messages-home-pt.ts`, `diagnostics.ts`, `src/features/inventory/TopGearApp.tsx`, `src/features/reports/ReportView.tsx`, `src/features/shell/ToolNav.tsx`, relevant homepage/metadata sources found by the search below, `src/i18n/messages.test.ts`. Keep existing translation keys where that preserves callers.

**Interfaces:** All auth/library error codes from shared contracts have EN/PT translations. Keep tool key `top-gear`; tool display text is Gear Lab. Date/number formatting uses current locale utilities.

- [ ] Add catalog completeness tests for every `AccountErrorCode` and each new auth/library message path across home/workbench catalogs. Add assertion Gear Lab display name is identical in both locales.
- [ ] Run `pnpm exec vitest run --project unit src/i18n/messages.test.ts`; expect missing new translations before completing catalogs.
- [ ] Search display occurrences precisely:

```sh
rg -n 'Top Gear|TOP GEAR|Find Top Gear|bag full|your bags' src
```

Edit user-facing strings/headings and homepage metadata only; do not alter routes, package name, generated simulator sources, draft keys or domain type names. Homepage hero/CTA now describes equipped, bag **and manually added items**.
- [ ] Use the following core copy, with exact server expiry dates interpolated separately:

| State | EN-US | PT-BR |
| --- | --- | --- |
| Entry | Continue with Discord | Continuar com Discord |
| Save benefit | Save this report and find it on any device. | Salve este relatório e acesse de qualquer dispositivo. |
| Saved | Report saved | Relatório salvo |
| Library | My Library | Minha biblioteca |
| Save failure after login | You're signed in, but this report wasn't saved. Try saving again. | Você entrou, mas este relatório não foi salvo. Tente salvar novamente. |
| Public viewer | Shared report · read only | Relatório compartilhado · somente leitura |
| Expired | This report expired and can no longer be saved. | Este relatório expirou e não pode mais ser salvo. |
| Auth unavailable | We couldn't check your session. Try again. | Não foi possível verificar sua sessão. Tente novamente. |
| Explicit anonymous | Run without saving | Simular sem salvar |
| Deletion processing | Access removed. Data cleanup is processing. | Acesso removido. A exclusão dos dados está em andamento. |
| Tool summary | Compare equipped, bag and custom items. | Compare itens equipados, da bolsa e adicionados manualmente. |

- [ ] Localize all remaining modal/button/empty/error/fresh-login copy at its component, no English fallback exposed to PT users. Preserve Gear Lab product name. Run locale tests and typecheck, then commit as `feat: localize account journeys and name Gear Lab`.

### Task 13: Prove OAuth behavior, cross-device saving and safe rollout

**Files:** Create `tests/e2e/authentication.spec.ts`, `tests/support/discord-oauth.ts`, `tests/integration/auth-races.test.ts`, `docs/engineering/authentication-operations.md`. Modify `docs/engineering/top-gear-operations.md`, `production-launch.md`, `docs/design/discord-authentication-experience.md`, test configuration only where the OAuth harness requires an isolated process.

**Interfaces:** Test-only `startDiscordHarness():Promise<{origin:string;close():Promise<void>}>` lives under tests and is never imported by production routes. Its controlled provider endpoints provide authorization redirect, token exchange and `/users/@me`; route the pinned provider's outbound requests through test-process network interception. Do not add a query/header that authenticates a production request. Exercise the real Better Auth handler, state cookies and session writes.

- [ ] Build provider integration tests first. Obtain authorize URL from real sign-in route; assert scope exactly `identify`; exchange test code through intercepted token/userinfo calls; validate state mismatch, replay, denial and phone-only user. Keep OAuth state signed/verified by Better Auth. Use different hostnames for provider/app so the browser actually models a cross-site callback; app owner cookie must be Strict, absent on cross-site callback and present on the return page's same-origin completion POST.
- [ ] Run focused OAuth tests; a stubbed frontend session alone is not adequate evidence. Add browser test skeleton using real app routes:

```ts
test("saving returns to the selected report page without losing scroll", async ({page}) => {
  // seedTerminalReport supplies a real DB job; the fixture sets its owner cookie.
  await page.goto(reportPath);
  await page.getByRole("button", {name:"Next page"}).click();
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", {name:"Save report", exact:true}).first().click();
  await page.getByRole("button", {name:"Continue with Discord"}).click();
  await expect(page.getByText("Report saved", {exact:true})).toBeVisible();
  expect(Math.abs((await page.evaluate(() => window.scrollY))-before)).toBeLessThan(8);
});
```

In that test's fixture setup create at least 21 deterministic result rows, capture selected row ID and comparison mode and assert both after return; set `reportPath` from the seeded capability. Use real rendered translated accessible names from the app rather than weakening role locators.
- [ ] Exercise fresh browser/account B library isolation, account A cross-device opening, anonymous claim after completion, unsupported missing owner cookie, cancellation and retry-after-save-failure. Mobile 390px and desktop 1440px in both locales; test focus return, Escape and reduced motion. Assert no horizontal overflow, no duplicate notice interruptions, and screenshot Paper's main states for visual comparison.
- [ ] Run barrier-based integration races for claim/cleanup, delete/publish and account deletion/session creation. Verify both possible lock order outcomes satisfy invariants. Verify production bundle contains no test-provider switch and no server credentials.
- [ ] Run the full release validation sequence once relevant focused checks pass:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:sim
pnpm test:e2e
pnpm build
```

Record actual output and distinguish pre-existing failures from new ones. Confirm both localized homepage routes are prerendered and report/API responses no-store. Check missing Discord env fails auth safely without breaking anonymous workers or static homepage build. Do not report real OAuth as tested solely from mocks.
- [ ] Write operational configuration with names and roles (never secret values): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `AUTH_ENROLLMENT_ENABLED`, `REPORT_SAVING_ENABLED`, existing `APP_ORIGIN`, `DATABASE_URL`, `CAPABILITY_KEY`. Default new enrollment/saving flags false. Worker requires DB and existing job configuration, not Discord credentials. Require stable auth secret; rotating CAPABILITY_KEY would break historic reports and is prohibited here.
- [ ] Record concrete deployment order: run versioned additive migrations; deploy retention-aware Trigger worker/recovery; verify old anonymous job and newly account-associated test job; deploy web with new saving/enrollment disabled; register exact local and production Discord callbacks; enable enrollment and saving on verified origin. Existing account-associated in-flight jobs and intents complete even if new saving is switched off.
- [ ] Register `https://munigan.app/api/auth/callback/discord` and `http://127.0.0.1:3000/api/auth/callback/discord`; use an explicit fixed staging origin when testing staging. No arbitrary preview wildcard. Discord application credentials require the user's account access if unavailable; finish all code/config templates before requesting that final setup input.
- [ ] Release gate: manually use real Discord consent and cancellation, signed-in run, cross-device My Library, anonymous claim, public viewer, sign-out and report/account deletion on configured test origin. Record date, deployed commit and outcome without profile/token screenshots. Missing credentials or real OAuth verification blocks rollout, not the ability to finish implementation.
- [ ] Rollback drill: disable **new** enrollment and saving, retain existing-account login, sessions, My Library, schema and retention-aware worker. Never roll back cleanup to the legacy bulk delete. Monitor sanitized auth/save/publication errors, cleanup lag, retained row/byte growth and migration/worker version. No capability URLs, owner cookies, intent/provider/session tokens or imported snapshots in logs.
- [ ] Update the Paper handoff's old unresolved retention wording to the approved spec (no-age-expiry until explicit deletion). Record visual checks of the verified main screens; an unreliable detail-board screenshot cannot justify inventing a different nav. Commit the tests/docs as `test: verify Discord report retention and rollout`.

## Coverage and review checklist

| Approved requirement | Implementation / verification |
| --- | --- |
| Existing data and historic report links survive | 1–4, 8, 13 |
| Discord-only identity, phone-only accounts, encrypted tokens | 2–3, 13 |
| Session expiry, revocation, no silent anonymous downgrade | 3, 6, 10 |
| Original-browser claim proof, no shared-link claiming | 4, 7, 10, 13 |
| Strict-cookie OAuth return, independent auth/save outcomes | 7, 10, 13 |
| Account quotas and unauthorized idempotency/retry | 6, 8, 13 |
| Browser-independent retention and partial-result publication | 5–6, 8 |
| Private generic library, only Gear Lab initially | 2, 5, 11 |
| Public sharing until deletion, accurate expiry metadata | 4, 8, 10 |
| Deletion races, quota preservation, durable erasure | 2, 6, 8, 13 |
| Top bar, optional dialog, mobile, both locales | 9–12 |
| Draft preservation, selection/pagination/scroll restoration | 9–10, 13 |
| Saved reports survive rollback and worker cleanup | 8, 13 |
| No feature implementation/deployment during planning | Current document and docs-only commit |

Self-review before handing this plan to execution:

- Reviewed shared interfaces and corrected fixture publication dependencies, separate general-sign-in/report-return storage shapes, lazy runtime auth initialization and session-cookie renewal forwarding. Existing types/functions are identified by their source modules.
- Verify generated Better Auth SQL against 1.7.4 types rather than hand-maintaining its internal schema. The options reference documents native `account.encryptOAuthTokens`; do not substitute one-way encryption hooks which break token refresh.
- Keep service tests independent of React/OAuth; keep browser tests behind the real handler, not a production bypass.
- Ensure no missing retention/deletion behavior is postponed until after enabling sign-in.
- Keep explicit staging/commits limited to each task's files; never commit the current workspace wholesale.

## Verified sources and local references

- [Better Auth options](https://better-auth.com/docs/reference/options): configuration API; verify against installed 1.7.4 declarations while implementing.
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next).
- [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql).
- [Discord provider](https://better-auth.com/docs/authentication/discord).
- [OAuth scope/profile behavior](https://better-auth.com/docs/concepts/oauth).
- [Sessions](https://better-auth.com/docs/concepts/session-management) and [rate limiting](https://better-auth.com/docs/concepts/rate-limit).
- [Approved Paper handoff](../../design/discord-authentication-experience.md) and [Paper main screens](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/O-0).
- Installed Next.js authentication guide, `src/server/jobs/admit.ts`, `work.ts`, `reconcile.ts`, `src/features/reports/use-report.ts`, and `src/features/shell/WorkbenchNavigation.tsx` were inspected during planning.

## Execution handoff

This is one dependency-ordered account/report-retention project, not thirteen independently deployable releases. Review each task after its focused checks, but keep enrollment/saving disabled until Task 13 passes. Implementation can use fresh subagents per task with review gates, or execute inline in this session with checkpoints. Deployment remains a separate explicit action after implementation and release evidence are reviewable.
