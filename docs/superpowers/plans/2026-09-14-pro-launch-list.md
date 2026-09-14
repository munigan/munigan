# PRO Launch List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved PRO coming-soon modal and sidebar/header entry points, with durable Discord-account signup for launch updates and an extra discount, while leaving payments disabled.

**Architecture:** Mount one client-side PRO dialog provider beneath the existing AuthProvider, and connect header/sidebar triggers to it. Persist explicit, idempotent membership through authenticated Next.js route handlers and PostgreSQL, extending the existing OAuth return state only enough to reopen the dialog after a verified login. Preserve server admission policy and current Gear Lab draft restoration.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript, Better Auth 1.7.4, PostgreSQL through `pg` 8.23.1, existing SQL migrations, Base UI 1.8.0 dialog/tooltip primitives, next-intl 4.14.2, Vitest 5, and Playwright 1.63.0. Retain repository-pinned versions; no new runtime dependency is required.

**Spec:** [PRO launch-list design](../specs/2026-09-14-pro-launch-list-design.md). [Approved Paper page](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/15-0).

## Global Constraints

- Payments remain disabled. Do not add Stripe, checkout, credit balances, credit purchases, subscription entitlements, or paid execution.
- The current free limits remain 120 combinations and 500 iterations per set under the default server policy. Preserve the existing server policy, workload validation, admission quotas, and readiness checks.
- Joining the launch list never changes simulation permissions or automatically starts a run.
- PRO benefits are upcoming: Gear Lab without limits, Log Review, and DPS-gain comparisons across raid items such as Icecrown Citadel.
- Signup uses the authenticated Discord account, not email.
- Anonymous users authenticate first and then explicitly confirm joining. OAuth completion alone is not marketing consent.
- The offer is an extra launch discount with no specified percentage, price, launch date, coupon, or recurring-payment commitment.
- Show all new interface copy in en-US and pt-BR.
- Preserve current gear selections, enhancements, item version, pending import draft, and existing auth/report return flows.
- Only the player identity is outside the sidebar’s three content boxes. The run action, notices, and free alternative belong inside the third box.
- The iteration control is a slider only: no number input and no minus/plus buttons. Center every label on its marker, including both endpoints.
- `About the set limit` is a dashed-underlined tooltip trigger without a disclosure arrow.
- This task produces application code and tests when executed; the current planning task only creates these documents.

---

## Execution amendment: existing Discord server

The user approved implementation using the configured Discord server after this plan was written. This section supersedes the earlier copy promising direct messages.

- Preserve the explicit app signup POST and account-linked extra launch discount; Discord server membership is a separate optional step, never proof of signup.
- Joined confirmation includes an external `Enable Discord notifications` / `Ativar avisos no Discord` link to `https://discord.gg/79SMq4A7vg`, explaining that it grants the PRO Launch role for channel mentions, and how to request role removal in support. Do not auto-open the link or call the membership POST from link clicks.
- General community/support link uses `https://discord.gg/vtK8Zvs6EG`, without automatic role assignment. Add a discreet Discord support link to existing shared footer/navigation where appropriate.
- Centralize both public URLs in `src/domain/pro-launch/discord.ts`. No secret webhook URLs, bot tokens, outgoing webhook calls, DMs, role-sync API or payment execution in this release.
- Replace offerBody, anonymousBody, consent and nextSteps copy to make clear app signup reserves the offer and optional Discord server enrollment enables channel announcements. No claim of guaranteed delivery or existing role assignment.
- Two publishing webhooks exist in Discord but are intentionally not consumed by this web UI implementation. See `docs/engineering/discord-community-setup.md`.

## Repository findings and execution preparation

Inspected checkout: `6e5e6ad` on 2026-09-14. Re-read the touched files at execution time rather than assuming this checkout is unchanged.

| Existing seam | Reason it matters |
| --- | --- |
| `src/features/shell/AppDocument.tsx` | AuthProvider wraps the shared AppShell for both marketing and workbench routes. Put the PRO provider here so both header and sidebar use one host. |
| `src/features/shell/WorkbenchNavigation.tsx` | Desktop utilities currently render LanguageSelector then AccountMenu. Insert Go PRO before LanguageSelector. |
| `src/features/shell/DrawerNavigation.tsx` | Small screens hide desktop utilities; expose a drawer entry that closes the drawer before opening PRO. |
| `src/features/auth/SignInDialog.tsx`, `return-state.ts`, `AuthReturn.tsx` | Discord OAuth already uses validated, expiring flow state and strict `/auth/return?flow=…` callbacks. Reuse that machinery. |
| `src/features/auth/AuthProvider.tsx` | Separates loading, anonymous, authenticated and unavailable states, with cross-tab account invalidation. |
| `src/server/auth/identity.ts`, `account-lock.ts` | Resolve identity on the server and serialize account writes with deletion. |
| `src/server/http/report-saving.ts` | `accountMutationBody` provides same-origin, JSON and 2KiB body validation; `savingFailure` produces safe account errors. These helpers do not require report-saving to be enabled. |
| `src/features/inventory/RunSetup.tsx`, `RunAllowance.tsx`, `RunIterations.tsx` | Existing sidebar and limits. RunIterations already rejects higher slider values and leaves the server value selected. |
| `src/features/inventory/TopGearApp.tsx` | Owns live gear/import state and restores the `munigan.top-gear.signin-restore` marker after OAuth. |
| `src/domain/equipment/enumerate.ts` | Counts may have `countKind: 'upper-bound'`. Do not display an estimated excess as an exact count. |
| `src/server/jobs/policy.ts` | Default free limit is `600000 / 5000 = 120` combinations and 500 iterations. Units per set are internal workload units, not credits. |
| `messages/{en-US,pt-BR}` plus four `src/i18n/messages-*.ts` registries | Home and workbench each need the new PRO namespace because both render the header. |

Before editing:

- [ ] Create an isolated checkout using `superpowers:using-git-worktrees`; use a `codex/` branch. Preserve all existing simulator changes and untracked research/plans.
- [ ] Read the checkout’s applicable AGENTS.md and local Next guides: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `05-server-and-client-components.md`, and `04-linking-and-navigating.md`.
- [ ] Retrieve Paper JSX and computed styles for the five approved artboards; retain a short export/reference file under `docs/design/pro-launch-list.md`. Do not reconstruct implementation measurements from screenshots.
- [ ] Check migration names before creating `drizzle/0011_pro_launch_list.sql`. Main currently ends at 0003, while the independent Log Review worktree already occupies 0004–0010. Use 0011 with dependencies only on 0001/0002; if 0011 has since been used, choose the next free number and update this plan’s file references. Never rename or edit an applied migration.
- [ ] Record baseline results for `pnpm typecheck` and the scoped existing auth/inventory tests before attributing any failures to this feature.

## File and module ownership

| Module | Files | Responsibility |
| --- | --- | --- |
| Contract | `src/domain/pro-launch/contracts.ts` | Source/locale/consent/offer versions and the public status DTO. |
| Persistence | `src/server/pro-launch/repository.ts`; `drizzle/0011_pro_launch_list.sql` | Authenticated account membership, uniqueness, first consent, deletion compatibility. |
| HTTP | `src/server/pro-launch/http.ts`; `src/app/api/pro-launch/route.ts` | Strict request parsing, session identity, private responses. |
| OAuth handoff | `src/features/auth/useDiscordSignIn.ts`; `src/features/pro-launch/resume.ts` | Reuse social login and reopen PRO only after verified return. |
| Modal view | `src/features/pro-launch/ProLaunchDialog.tsx`, `ProFeatures.tsx`, `ProSignup.tsx`, `pro-launch.css` | Approved anonymous/member/success/error views and responsive layout. |
| Modal owner | `src/features/pro-launch/ProLaunchProvider.tsx`, `ProLaunchButton.tsx` | Opening, membership fetch/join, account-switch cancellation, focus restoration. |
| Sidebar | `RunSetup.tsx`, `RunAllowance.tsx`, `RunIterations.tsx`, `inventory-design.css`; new `free-run-state.ts`, `ProRunNotice.tsx` | Three boxes, accurate free-limit state, tooltip, aligned slider and entry point. |
| Localization | `messages/en-US/pro.json`, `messages/pt-BR/pro.json`; inventory/auth keys where specified below | Complete English/Portuguese copy without business values embedded in CSS or components. |
| Verification | New scoped unit/UI/integration/E2E files specified per task | Verify the feature and existing OAuth/free-run invariants. |

Tasks execute in order. Each task is a separate reviewable commit; run its failing test, implement, rerun, and inspect the diff before committing only its files.

## Shared contracts

Task 1 creates these exports; later tasks import them rather than duplicating strings:

```ts
export const PRO_CONSENT_VERSION = 'pro-discord-launch-v1' as const;
export const PRO_OFFER_VERSION = 'pro-launch-v1' as const;
export const proLaunchSources = ['header', 'gear_limit', 'iterations_limit'] as const;
export type ProLaunchSource = typeof proLaunchSources[number];
export type ProLaunchLocale = 'en-US' | 'pt-BR';
export type ProLaunchMembership = {
  status: 'joined';
  joinedAt: string;
  offerVersion: typeof PRO_OFFER_VERSION;
};
export type ProLaunchStatus = { status: 'not_joined' } | ProLaunchMembership;
export type JoinProLaunchInput = {
  expectedUserId: string;
  source: ProLaunchSource;
  locale: ProLaunchLocale;
  consentVersion: typeof PRO_CONSENT_VERSION;
};
```

`expectedUserId` is a comparison guard for the account shown to the user, never an authorization identity. The server session selects the row. `discord_account_id` and `offer_version` never come from the browser.

### Task 1: Durable, idempotent Discord launch-list membership

**Files:**
- Create: `src/domain/pro-launch/contracts.ts`
- Create: `drizzle/0011_pro_launch_list.sql`
- Create: `src/server/pro-launch/repository.ts`
- Modify: `src/server/accounts/deletion.ts`
- Test: `tests/integration/pro-launch.test.ts`

**Interfaces:**
- Consumes: `AccountIdentity`, `pool`, `transaction`, `lockActiveAccount`, `AccountError`.
- Produces: `readProLaunchStatus(account: AccountIdentity): Promise<ProLaunchStatus>` and `joinProLaunchList(account: AccountIdentity, input: JoinProLaunchInput): Promise<ProLaunchMembership>`.

- [ ] **Step 1: Add the contract and a failing persistence test.** Use the existing isolated database setup and `seedAccount` fixture; do not require a real Discord request.

```ts
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { pool } from '@/server/db/client';
import { PRO_CONSENT_VERSION } from '@/domain/pro-launch/contracts';
import { readProLaunchStatus, joinProLaunchList } from '@/server/pro-launch/repository';
import { createTestDatabase, dropTestDatabase } from '../support/database';
import { seedAccount } from '../support/accounts';

beforeAll(createTestDatabase);
beforeEach(async () => { await pool.query('TRUNCATE auth_user CASCADE'); });
afterAll(async () => { await dropTestDatabase(); await pool.end(); });

it('keeps one first consent across concurrent joins', async () => {
  const account = await seedAccount();
  expect(await readProLaunchStatus(account)).toEqual({ status: 'not_joined' });
  const input = {
    expectedUserId: account.id, source: 'header' as const,
    locale: 'en-US' as const, consentVersion: PRO_CONSENT_VERSION,
  };
  const results = await Promise.all([
    joinProLaunchList(account, input), joinProLaunchList(account, input),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0].status).toBe('joined');
  expect((await pool.query('SELECT * FROM pro_launch_memberships')).rowCount).toBe(1);
  expect(await readProLaunchStatus(account)).toEqual(results[0]);
});

it('does not join a different account than the one shown', async () => {
  const account = await seedAccount();
  await expect(joinProLaunchList(account, {
    expectedUserId: 'someone-else', source: 'header', locale: 'en-US',
    consentVersion: PRO_CONSENT_VERSION,
  })).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED', status: 409 });
});
```

- [ ] **Step 2: Run `pnpm exec vitest run --project integration tests/integration/pro-launch.test.ts`.** Expect failure because the repository/migration does not exist, not because the test database is unavailable.
- [ ] **Step 3: Add the migration and transaction implementation.** Use an additive SQL migration; store the actual provider ID from `auth_account.account_id`.

```sql
CREATE TABLE pro_launch_memberships (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  discord_account_id text NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('header','gear_limit','iterations_limit')),
  locale text NOT NULL CHECK (locale IN ('en-US','pt-BR')),
  consent_version text NOT NULL CHECK (consent_version = 'pro-discord-launch-v1'),
  offer_version text NOT NULL CHECK (offer_version = 'pro-launch-v1'),
  joined_at timestamptz NOT NULL DEFAULT now()
);
```

Core repository flow (include the imports from the declared interfaces):

```ts
export async function joinProLaunchList(account: AccountIdentity, input: JoinProLaunchInput) {
  if (account.id !== input.expectedUserId)
    throw new AccountError('ACCOUNT_CHANGED', 409);
  if (input.consentVersion !== PRO_CONSENT_VERSION)
    throw new AccountError('INVALID_REQUEST', 400);
  return transaction(async (client) => {
    await lockActiveAccount(client, account.id);
    const linked = await client.query<{ account_id: string }>(
      "SELECT account_id FROM auth_account WHERE user_id=$1 AND provider_id='discord'",
      [account.id],
    );
    if (linked.rowCount !== 1) throw new AccountError('AUTH_UNAVAILABLE', 503);
    await client.query(
      `INSERT INTO pro_launch_memberships
         (user_id,discord_account_id,source,locale,consent_version,offer_version)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO NOTHING`,
      [account.id, linked.rows[0].account_id, input.source, input.locale,
       PRO_CONSENT_VERSION, PRO_OFFER_VERSION],
    );
    const result = await client.query<{ joined_at: Date; offer_version: typeof PRO_OFFER_VERSION }>(
      'SELECT joined_at,offer_version FROM pro_launch_memberships WHERE user_id=$1',
      [account.id],
    );
    return {
      status: 'joined' as const, joinedAt: result.rows[0].joined_at.toISOString(),
      offerVersion: result.rows[0].offer_version,
    };
  });
}
```

Implement `readProLaunchStatus` using `transaction`, `lockActiveAccount`, and the same two selected columns. Return `not_joined` for an absent row; never return another user’s membership or the Discord ID. Do not mutate source, consent time, locale, or offer on a repeated join.

In `requestAccountDeletion`, immediately after setting lifecycle to `deleting`, inside its existing transaction:

```ts
await c.query('DELETE FROM pro_launch_memberships WHERE user_id=$1', [account.id]);
```

Final cleanup also cascades through the user FK. No membership is retained while the rest of account cleanup waits for active jobs.

- [ ] **Step 4: Add and run deletion/identity boundary tests.** Assert missing Discord links fail closed, another account reads `not_joined`, duplicate join preserves the original locale/source/time, and deletion request removes membership immediately. Use `requestAccountDeletion({ account, ownerHash: null }, account.id)` with the fresh seeded session. Add a concurrent deletion-first test using the existing `pg_stat_activity` lock-observation pattern from `auth-races.test.ts`; joining must reject `ACCOUNT_DELETING` after the lifecycle lock is released. Test final user deletion cascades too.
- [ ] **Step 5: Run the new integration file plus `account-schema.test.ts`, `auth-races.test.ts`, and `migrations.test.ts`, then commit.**

```sh
pnpm exec vitest run --project integration tests/integration/pro-launch.test.ts tests/integration/account-schema.test.ts tests/integration/auth-races.test.ts tests/integration/migrations.test.ts
git add drizzle/0011_pro_launch_list.sql src/domain/pro-launch src/server/pro-launch/repository.ts src/server/accounts/deletion.ts tests/integration/pro-launch.test.ts
git commit -m "feat(pro): persist Discord launch-list membership"
```

### Task 2: Private membership status and join API

**Files:**
- Create: `src/server/pro-launch/http.ts`
- Create: `src/app/api/pro-launch/route.ts`
- Test: `src/server/pro-launch/http.test.ts`
- Test: `tests/integration/pro-launch-http.test.ts`

**Interfaces:**
- Consumes: Task 1’s contract and repository functions; `getIdentity`, `requireAccount`, `accountMutationBody`, `savingFailure`, `privateHeaders`.
- Produces: GET `/api/pro-launch` returning `ProLaunchStatus`; POST of `JoinProLaunchInput` returning `ProLaunchMembership`. Successful POST is 200 for both first and repeat join.

- [ ] **Step 1: Write strict-body parser tests.** Export `parseJoinProLaunchInput(fields: Record<string, unknown>): JoinProLaunchInput` from `http.ts`.

```ts
const valid = {
  expectedUserId: 'account-a', source: 'header', locale: 'en-US',
  consentVersion: 'pro-discord-launch-v1',
};
it('accepts only the consent contract', () => {
  expect(parseJoinProLaunchInput(valid)).toEqual(valid);
  for (const fields of [
    {}, { ...valid, consentVersion: 'old' }, { ...valid, source: 'checkout' },
    { ...valid, locale: 'en' }, { ...valid, discordId: 'attacker-supplied' },
    { ...valid, expectedUserId: '' }, { ...valid, expectedUserId: 'x'.repeat(257) },
  ]) expect(() => parseJoinProLaunchInput(fields)).toThrow();
});
```

- [ ] **Step 2: Run `pnpm exec vitest run --project unit src/server/pro-launch/http.test.ts`; expect missing parser failure.**
- [ ] **Step 3: Implement the parser and handlers.** Validate exactly four keys, expectedUserId string length 1–256, source membership in `proLaunchSources`, exact locale, and exact consent version; throw `AccountError('INVALID_REQUEST', 400)` otherwise. Route handlers stay thin:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getIdentity, requireAccount } from '@/server/auth/identity';
import { accountMutationBody, savingFailure } from '@/server/http/report-saving';
import { privateHeaders } from '@/server/http/api';
import { parseJoinProLaunchInput } from '@/server/pro-launch/http';
import { joinProLaunchList, readProLaunchStatus } from '@/server/pro-launch/repository';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try {
    const account = requireAccount(await getIdentity(request));
    return NextResponse.json(await readProLaunchStatus(account), { headers: privateHeaders });
  } catch (error) { return savingFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const input = parseJoinProLaunchInput(await accountMutationBody(request));
    const account = requireAccount(await getIdentity(request));
    return NextResponse.json(await joinProLaunchList(account, input), { headers: privateHeaders });
  } catch (error) { return savingFailure(error); }
}
```

No owner cookie is required for a signed-in launch-list join. Do not tie this endpoint to `REPORT_SAVING_ENABLED`, expose list enumeration, create sessions, or request Discord tokens.

- [ ] **Step 4: Add HTTP boundary tests with real database persistence and a controlled identity resolver.** In the integration file, use `vi.mock('@/server/auth/identity', async importOriginal => ({ ...await importOriginal(), getIdentity: vi.fn() }))`, then return seeded accounts through `vi.mocked(getIdentity)`. Construct real `NextRequest` instances to exercise route/body/origin code:

```ts
const request = new NextRequest('http://localhost/api/pro-launch', {
  method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
  body: JSON.stringify({
    expectedUserId: account.id, source: 'header', locale: 'en-US',
    consentVersion: 'pro-discord-launch-v1',
  }),
});
expect((await POST(request)).status).toBe(200);
```

Use the Task 1 database lifecycle fixture. Assert anonymous GET/POST are 401, bad origin 403, non-JSON 415, body over 2048 bytes 413, invalid fields 400, account mismatch 409, auth/database failure 503, and all responses use no-store headers. GET must not insert; POST must not write any `tg_jobs` or `tg_budgets` rows. Mocked identity is supplemented by the real OAuth E2E in Task 7.
- [ ] **Step 5: Run both new test files, typecheck, and commit these four files.**

```sh
pnpm exec vitest run --project unit src/server/pro-launch/http.test.ts --project integration tests/integration/pro-launch-http.test.ts
pnpm typecheck
git add src/server/pro-launch/http.ts src/server/pro-launch/http.test.ts src/app/api/pro-launch/route.ts tests/integration/pro-launch-http.test.ts
git commit -m "feat(pro): expose authenticated launch-list endpoints"
```

### Task 3: Reusable Discord sign-in and verified modal resume

**Files:**
- Create: `src/features/auth/useDiscordSignIn.ts`
- Create: `src/features/pro-launch/resume.ts`
- Modify: `src/features/auth/SignInDialog.tsx`, `return-state.ts`, `AuthReturn.tsx`
- Test: `src/features/auth/SignInDialog.test.tsx`, `return-state.test.ts`, `AuthReturn.test.tsx`
- Test: `src/features/pro-launch/resume.test.ts`

**Interfaces:**
- Consumes: existing `authClient.signIn.social`, `safeReturnPath`, `storeSignInReturn`, `oauthCallbackPath`, and the server-verified account in AuthReturn.
- Produces: `useDiscordSignIn({ callbackPath, proLaunch? }): { pending: boolean; error: string | null; beginSignIn(): Promise<void> }`, where `proLaunch?: { source: ProLaunchSource }`; and `storeProLaunchResume(input: { userId: string; returnPath: string; source: ProLaunchSource }): void`, `hasProLaunchResume(returnPath: string): boolean`, `consumeProLaunchResume(userId: string, returnPath: string): { source: ProLaunchSource } | null`.

- [ ] **Step 1: Write failing round-trip and invalid-state tests.** Extend `SignInReturn` with optional `proLaunch: { source: ProLaunchSource }` and allow only the three declared sources. Existing states without the property remain valid.

```ts
it('retains PRO intent separately from the safe callback path', () => {
  const flow = crypto.randomUUID();
  storeSignInReturn(flow, {
    returnPath: '/gear-lab', locale: 'pt-BR', proLaunch: { source: 'gear_limit' },
  });
  expect(loadSignInReturn(flow)?.proLaunch).toEqual({ source: 'gear_limit' });
});
it('consumes a verified resume only once for the same user and route', () => {
  storeProLaunchResume({ userId: 'a', returnPath: '/gear-lab', source: 'header' });
  expect(consumeProLaunchResume('a', '/gear-lab')).toEqual({ source: 'header' });
  expect(consumeProLaunchResume('a', '/gear-lab')).toBeNull();
});
```

Test user mismatch, route mismatch, malformed storage, oversized values, invalid sources, expired entries, storage exceptions, and a fabricated future expiry. Resume storage is UX state only and must never perform a POST.
- [ ] **Step 2: Run the new tests to see the missing exports/validation failures.**
- [ ] **Step 3: Extract the existing sign-in behavior into the hook.** Move `flow`, pending/error, the callback validation, and `beginSignIn` from SignInDialog without changing normal sign-in behavior. Keep the current `crypto.randomUUID()` flow, locale, `provider: 'discord'`, and equal callbackURL/errorCallbackURL. Add only the optional PRO context to `storeSignInReturn`:

```ts
storeSignInReturn(flow.current, {
  returnPath: safeReturnPath(callbackPath, window.location.origin),
  locale: locale === 'pt-BR' ? 'pt-BR' : 'en-US',
  ...(proLaunch ? { proLaunch } : {}),
});
const callbackURL = oauthCallbackPath('flow', flow.current);
const result = await authClient.signIn.social({
  provider: 'discord', callbackURL, errorCallbackURL: callbackURL,
});
```

SignInDialog calls the hook with its existing callbackPath. The PRO modal calls the same hook directly, avoiding a second sign-in dialog. Keep the callback security checks and storage failure behavior from the existing code. Do not widen `safeReturnPath`, accept arbitrary query flags, or add an auth server endpoint.

In `AuthReturn.complete`, only inside the successful ordinary `flow` branch, after session existence and expectedUserId validation and before clearing sign-in state:

```ts
if ('proLaunch' in state && state.proLaunch && 'returnPath' in state) {
  storeProLaunchResume({
    userId: result.account.id, returnPath: state.returnPath,
    source: state.proLaunch.source,
  });
}
```

`resume.ts` uses a single sessionStorage key `munigan.pro-launch.resume`, a version 1 record, 5-minute expiry, bounded user ID and source, and `safeReturnPath` equality. Remove the entry on successful consumption or invalid/mismatched state; catch read/parse/remove failures by returning null. `storeProLaunchResume` propagates storage failure so AuthReturn retains its retryable error and does not falsely claim a completed resume. Do not create a marker on OAuth cancellation, state mismatch, missing session, or failed report-saving intent.

`hasProLaunchResume(returnPath)` runs the same version, shape, source, path, size and expiry validation without consuming a valid entry or exposing its user ID. Return false on malformed/expired state or storage failure. Task 5 uses this only to decide whether an anonymous auth context needs one refresh; it does not establish identity or membership. Test that checking presence leaves a valid marker available for subsequent consumption.

- [ ] **Step 4: Extend AuthReturn tests.** Verify successful PRO login stores a resume and navigates to the original path, ordinary login does not store it, rejected OAuth state cannot reopen it, account mismatch does not store it, and no completion path invokes `/api/pro-launch` POST. Preserve deletion-return and report-save tests.
- [ ] **Step 5: Run and commit the OAuth boundary change.**

```sh
pnpm exec vitest run --project unit src/features/auth/return-state.test.ts src/features/pro-launch/resume.test.ts --project ui src/features/auth/SignInDialog.test.tsx src/features/auth/AuthReturn.test.tsx
git add src/features/auth/useDiscordSignIn.ts src/features/auth/SignInDialog.tsx src/features/auth/return-state.ts src/features/auth/AuthReturn.tsx src/features/auth/SignInDialog.test.tsx src/features/auth/return-state.test.ts src/features/auth/AuthReturn.test.tsx src/features/pro-launch/resume.ts src/features/pro-launch/resume.test.ts
git commit -m "feat(pro): resume launch dialog after Discord sign-in"
```

### Task 4: Localized modal views and Discord button

**Files:**
- Create: `src/features/pro-launch/ProLaunchDialog.tsx`, `ProFeatures.tsx`, `ProSignup.tsx`, `pro-launch.css`
- Create: `messages/en-US/pro.json`, `messages/pt-BR/pro.json`
- Modify: `src/i18n/messages-en.ts`, `messages-pt.ts`, `messages-home-en.ts`, `messages-home-pt.ts`
- Test: `src/features/pro-launch/ProLaunchDialog.test.tsx`, `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: existing Dialog/Button primitives and `DiscordIcon`; `PublicAccount`.
- Produces: a view-only `ProLaunchDialog` with the following prop contract, plus `ProFeatures()` and `ProSignup()` used only by that dialog:

```ts
export type ProDialogState =
  | { kind: 'auth_loading' }
  | { kind: 'auth_unavailable' }
  | { kind: 'anonymous'; signingIn: boolean; error: string | null }
  | { kind: 'membership_loading'; account: PublicAccount }
  | { kind: 'membership_error'; account: PublicAccount }
  | { kind: 'ready'; account: PublicAccount; joining: boolean; error: string | null }
  | { kind: 'joined'; account: PublicAccount };
export type ProLaunchDialogProps = {
  open: boolean;
  state: ProDialogState;
  onOpenChange(open: boolean): void;
  onSignIn(): void;
  onJoin(): void;
  onRetry(): void;
};
```

- [ ] **Step 1: Add view tests using NextIntlClientProvider and the new `pro` namespace.** Render the anonymous state; click `Continue with Discord`; expect only `onSignIn` to run. Render ready; expect account name and `onJoin`. Render joined; expect confirmation and no join action. Add loading and error cases, and verify a pending join is disabled while close remains available.

```tsx
const onSignIn = vi.fn(), onJoin = vi.fn();
render(<NextIntlClientProvider locale="en-US" messages={{ common, pro }}>
  <ProLaunchDialog open state={{ kind: 'anonymous', signingIn: false, error: null }}
    onOpenChange={vi.fn()} onSignIn={onSignIn} onJoin={onJoin} onRetry={vi.fn()} />
</NextIntlClientProvider>);
await userEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }));
expect(onSignIn).toHaveBeenCalledOnce();
expect(onJoin).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run `pnpm exec vitest run --project ui src/features/pro-launch/ProLaunchDialog.test.tsx`; expect missing view/message failures.**
- [ ] **Step 3: Implement the view branches and Paper measurements.** Use the approved page as the source of copy and measurements. Anonymous button markup is exactly this ordering:

```tsx
<Button className="pro-primary" disabled={state.signingIn} onClick={onSignIn}>
  <span>{t(state.signingIn ? 'signingIn' : 'continueDiscord')}</span>
  <DiscordIcon />
</Button>
```

Use DialogTitle/Description, DialogDismiss, semantic list markup for the benefits, and text error/status regions. Do not embed session fetching or POSTs in these presentational files. Account name/image come from PublicAccount, never the player’s imported character. Reuse the app’s image/fallback treatment from AccountMenu. The success action closes the modal; it must not navigate away from a report or clear Gear Lab state.

Required core copy (create the corresponding keys under `pro`; load it in all four message registries):

| Key | en-US | pt-BR |
| --- | --- | --- |
| goPro | Go PRO | Seja PRO |
| comingSoon | Coming soon | Em breve |
| title | Meet munigan PRO. | Conheça o munigan PRO. |
| lead | More ways to find your next DPS gain. | Mais formas de encontrar seu próximo ganho de DPS. |
| introduction | Here’s what we’re building for the paid plan. | Veja o que estamos preparando para o plano pago. |
| gearTitle | Gear Lab without limits | Gear Lab sem limites |
| gearBody | Compare all your gear combinations and run deeper simulations. | Compare todas as suas combinações de equipamentos e faça simulações mais detalhadas. |
| logTitle | Log Review | Log Review |
| logBody | Find missed casts, cooldown gaps, and lost DPS with fight-by-fight insights from your logs. | Identifique habilidades não usadas, falhas no uso de cooldowns e perdas de DPS com análises de cada luta dos seus logs. |
| raidTitle | Find your next raid upgrade | Encontre seu próximo upgrade de raid |
| raidBody | Simulate the DPS gain from every item in raids like Icecrown Citadel, and see what to chase next. | Simule o ganho de DPS de cada item em raids como Icecrown Citadel e descubra quais buscar. |
| offerTitle | Join early. Get an extra discount. | Entre na lista. Ganhe um desconto extra. |
| offerBody | Be first to hear when PRO launches, with an extra discount for joining. | Saiba primeiro quando o PRO chegar e ganhe um desconto extra por entrar na lista. |
| anonymousBody | Sign in with Discord, then join the list for launch updates and your extra discount. | Entre com o Discord e confirme sua inscrição para receber novidades e seu desconto extra. |
| continueDiscord | Continue with Discord | Continuar com Discord |
| signingIn | Connecting to Discord… | Conectando ao Discord… |
| returnNotice | After signing in, you’ll return here to confirm joining. | Depois de entrar, você voltará aqui para confirmar a inscrição. |
| discordAccount | Discord account | Conta do Discord |
| join | Join the PRO list | Entrar na lista PRO |
| joining | Joining… | Entrando na lista… |
| consent | By joining, you agree to receive PRO launch updates on Discord. | Ao entrar na lista, você concorda em receber novidades sobre o lançamento do PRO pelo Discord. |
| noPayment | Free to join. No payment today. | A inscrição é gratuita. Nenhum pagamento agora. |
| joinedTitle | You’re on the list. | Você está na lista. |
| joinedBody | Your extra launch discount is linked to your Discord account. | Seu desconto extra de lançamento está vinculado à sua conta do Discord. |
| joined | Joined | Inscrito |
| nextSteps | We’ll message you on Discord when PRO is ready. Until then, Gear Lab stays free within the current limits. | Vamos avisar pelo Discord quando o PRO estiver pronto. Até lá, o Gear Lab continua gratuito dentro dos limites atuais. |
| backGearLab | Back to Gear Lab | Voltar ao Gear Lab |
| back | Back to the app | Voltar ao app |
| loading | Checking your account… | Verificando sua conta… |
| membershipLoading | Checking your launch-list status… | Verificando sua inscrição… |
| retry | Try again | Tentar novamente |
| authUnavailable | We couldn’t check your Discord sign-in. Try again. | Não foi possível verificar seu acesso pelo Discord. Tente novamente. |
| statusFailed | We couldn’t check your launch-list status. Try again. | Não foi possível verificar sua inscrição. Tente novamente. |
| joinFailed | We couldn’t confirm your signup. Try again; you won’t be added twice. | Não foi possível confirmar sua inscrição. Tente novamente; você não será inscrito duas vezes. |
| accountChanged | Your account changed. Review the account below before joining. | Sua conta mudou. Confira a conta abaixo antes de se inscrever. |
| preserveFailed | We couldn’t save your current work. Allow browser storage and try again. | Não foi possível salvar seu trabalho atual. Permita o armazenamento no navegador e tente novamente. |

Render `backGearLab` on `/gear-lab` and `back` elsewhere; both only close. Reuse existing auth translations for OAuth errors returned by the shared hook.

CSS foundation (use actual Paper exports to finish section spacing and icon sizing):

```css
.pro-dialog { max-width:680px; padding:0; border-color:var(--color-control-border); }
.pro-dialog[data-joined="true"] { max-width:520px; }
.pro-heading { padding:24px 32px 28px; }
.pro-features { padding:0 32px 28px; }
.pro-signup { padding:28px 32px 32px; background:var(--color-gear-row); border-top:1px solid var(--color-border); }
.pro-primary { width:100%; min-height:48px; }
.pro-account-action { display:flex; align-items:center; justify-content:space-between; gap:24px; }
.pro-account-action .pro-primary { width:264px; }
@media (max-width:639px) {
  .pro-heading,.pro-features,.pro-signup { padding-inline:20px; }
  .pro-account-action { align-items:stretch; flex-direction:column; gap:16px; }
  .pro-account-action .pro-primary { width:100%; }
}
```

- [ ] **Step 4: Verify keyboard dismissal, title/description association, error announcement, button pending state, all three planned benefits, no pricing UI, and PT text.** Keep all body text accessible in short viewports through the existing DialogContent internal scroll behavior. Extend message-registry tests to assert the PRO namespace exists in home and workbench for both locales.
- [ ] **Step 5: Run scoped UI/i18n tests, typecheck, and commit only Task 4 files.**

```sh
pnpm exec vitest run --project ui src/features/pro-launch/ProLaunchDialog.test.tsx --project unit src/i18n/messages.test.ts
pnpm typecheck
git add src/features/pro-launch/ProLaunchDialog.tsx src/features/pro-launch/ProFeatures.tsx src/features/pro-launch/ProSignup.tsx src/features/pro-launch/pro-launch.css src/features/pro-launch/ProLaunchDialog.test.tsx messages/en-US/pro.json messages/pt-BR/pro.json src/i18n/messages-en.ts src/i18n/messages-pt.ts src/i18n/messages-home-en.ts src/i18n/messages-home-pt.ts src/i18n/messages.test.ts
git commit -m "feat(pro): build localized launch-list dialog states"
```

### Task 5: One shared dialog owner and header entry points

**Files:**
- Create: `src/features/pro-launch/ProLaunchProvider.tsx`, `ProLaunchButton.tsx`, `client.ts`
- Modify: `src/features/shell/AppDocument.tsx`, `WorkbenchNavigation.tsx`, `DrawerNavigation.tsx`, `shell.css`
- Test: `src/features/pro-launch/ProLaunchProvider.test.tsx`, `src/features/pro-launch/client.test.ts`
- Modify test: `src/features/shell/DrawerNavigation.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4, `useAccount()`, `useLocale()`, `usePathname()`.
- Produces: `useProLaunch(): { open(source: ProLaunchSource, trigger?: HTMLElement): void }`; `ProLaunchButton({ source, children?, onBeforeOpen? })`; client functions `getProLaunchStatus(signal: AbortSignal): Promise<ProLaunchStatus>` and `joinProLaunch(input: JoinProLaunchInput, signal: AbortSignal): Promise<ProLaunchMembership>`.
- Exports: `proBeforeSignInEvent = 'munigan:pro-before-sign-in'`, a synchronous cancelable preservation request for Task 6.

- [ ] **Step 1: Add a failing controller test.** Mount the provider with mocked `useAccount` and a test trigger; stub fetch with controllable promises. Opening while anonymous must make no membership POST. Opening while authenticated fetches status and renders the correct account. Click Join twice while pending and expect one POST with the shown account ID, current locale, source, and consent version.

```tsx
function Trigger() {
  const pro = useProLaunch();
  return <button onClick={(e) => pro.open('header', e.currentTarget)}>Go PRO</button>;
}
// Render within the existing NextIntlClientProvider test wrapper.
await user.click(screen.getByRole('button', { name: 'Go PRO' }));
await user.click(await screen.findByRole('button', { name: 'Join the PRO list' }));
expect(joinRequestBody).toEqual({
  expectedUserId: 'account-a', source: 'header', locale: 'en-US',
  consentVersion: 'pro-discord-launch-v1',
});
```

In the test, obtain `joinRequestBody` by parsing the POST `RequestInit.body` in the fetch mock; GET returns `{ status: 'not_joined' }`, and a deferred POST returns a joined DTO. Do not mock a successful signup by clicking a view-only button without checking a network write.
- [ ] **Step 2: Run the new provider/client tests; expect absent-controller failures.**
- [ ] **Step 3: Implement private API calls and the state owner.** Both calls use `credentials: 'same-origin'`, `cache: 'no-store'`, and an AbortSignal; POST sends JSON. Validate the returned DTO (`not_joined` or joined with a valid ISO date and exact offerVersion) before displaying success. Non-OK responses carry only a recognized account error code; otherwise map to the generic localized status/join failure.

Use this transition contract:

| Event | Result |
| --- | --- |
| Open, auth loading/unavailable/anonymous | Render corresponding state; do not call membership API. |
| Open or account refresh to authenticated | Invalidate the old request generation; GET status for this account. |
| GET not_joined | Ready state for the same account. |
| GET joined | Joined confirmation for the same account. |
| Join | Capture shown user ID; POST once; on success show joined only for that same generation/account. |
| POST 401 or 409 ACCOUNT_CHANGED/ACCOUNT_DELETING | Refresh auth, discard old membership, require another explicit Join. |
| GET/POST failure | Show error and retry; do not infer membership from localStorage. |
| Close | Abort requests and invalidate generation; next open re-reads persisted status. |
| Sign out, account change, deletion or unmount | Abort and discard previous-account state. |
| Verified resume | Consume the marker only after auth resolves; open with its source and show account/status; never auto-join. |

Use a ref holding the current account ID plus a monotonically increasing request generation. Checking a captured closure’s account value alone is insufficient:

```ts
const requestGeneration = ++generation.current;
const expectedUserId = currentAccountId.current;
const result = await getProLaunchStatus(controller.signal);
if (controller.signal.aborted || requestGeneration !== generation.current ||
    expectedUserId !== currentAccountId.current) return;
// Only this current result may update membership state.
```

Before the anonymous sign-in call:

```ts
const event = new Event(proBeforeSignInEvent, { cancelable: true });
if (!window.dispatchEvent(event)) {
  // Render pro.preserveFailed; do not start OAuth.
  return;
}
await beginSignIn();
```

The hook receives the current safe pathname and source. On the destination pathname, if `hasProLaunchResume(pathname)` is true and AuthProvider still reports anonymous, call its refresh once, guarded by a ref for that navigation. Do not repeatedly refresh or consume the marker before the account has resolved. Skip resume consumption on `/auth/return`; only the original destination consumes it. The server-authenticated user ID must match the marker. Handle expiry/malformed state by leaving PRO closed.

Store the initiating element for focus return. Use the Base UI popup’s supported final-focus API, as exposed by the local installed types, to restore it after close. If the mobile drawer unmounts that trigger, focus the still-mounted menu button instead.

- [ ] **Step 4: Mount and connect the header.** Wrap AppShell and its children with ProLaunchProvider inside AuthProvider in AppDocument. Insert `<ProLaunchButton source="header" />` before LanguageSelector. In DrawerNavigation add the same entry before its language utility, close the drawer with `onNavigate`, then open PRO after the drawer closes; do not stack two active focus traps. Match the 44px outlined header button and responsive drawer typography.

```tsx
<AuthProvider>
  <ProLaunchProvider>
    <AppShell>{children}</AppShell>
    <DeleteAccountDialogHost />
  </ProLaunchProvider>
</AuthProvider>
```

- [ ] **Step 5: Verify account-switch and uncertain-write behavior.** Resolve account A’s GET and POST after switching to B; A’s success/name must not render for B. Close during POST, reopen after the server committed, and observe joined from GET. Test account unavailable, anonymous retry, status failure, malformed DTO, network failure, reload persistence, and one dialog for both trigger sources.
- [ ] **Step 6: Run tests and commit the provider/header changes.**

```sh
pnpm exec vitest run --project ui src/features/pro-launch/ProLaunchProvider.test.tsx src/features/shell/DrawerNavigation.test.tsx --project unit src/features/pro-launch/client.test.ts
pnpm typecheck
git add src/features/pro-launch/ProLaunchProvider.tsx src/features/pro-launch/ProLaunchButton.tsx src/features/pro-launch/client.ts src/features/pro-launch/ProLaunchProvider.test.tsx src/features/pro-launch/client.test.ts src/features/shell/AppDocument.tsx src/features/shell/WorkbenchNavigation.tsx src/features/shell/DrawerNavigation.tsx src/features/shell/DrawerNavigation.test.tsx src/features/shell/shell.css
git commit -m "feat(pro): connect shared launch dialog to app navigation"
```

### Task 6: Implement the prelaunch sidebar without changing free execution

**Files:**
- Create: `src/features/inventory/free-run-state.ts`, `ProRunNotice.tsx`
- Modify: `src/features/inventory/RunSetup.tsx`, `RunAllowance.tsx`, `RunIterations.tsx`, `TopGearApp.tsx`, `InventorySelector.tsx`, `inventory-design.css`
- Modify: `messages/en-US/inventory.json`, `messages/pt-BR/inventory.json`
- Test: `src/features/inventory/free-run-state.test.ts`, `RunAllowance.test.tsx`, `TopGearApp.admission.test.tsx`

**Interfaces:**
- Consumes: existing request/allowance/policy/readiness values and `useProLaunch().open`.
- Produces: `isCombinationLimitExceeded(policy: WorkPolicy | null, allowance: Allowance | null): boolean`, importing both types from `@/domain/top-gear/model`; `ProRunNotice(props: { freeLimit: number; freeIterations: number; onReduceSelection(): void })`; optional `onReduceSelection` prop propagated RunSetup → RunAllowance.

- [ ] **Step 1: Write boundary tests using `allowanceForCount` and the existing test policy.** Check 0, 96, 120, 121, missing policy, and disallowed-but-not-over-count. Also check that the server’s policy tests remain unchanged.

```ts
import type { Allowance, WorkPolicy } from '@/domain/top-gear/model';

export function isCombinationLimitExceeded(
  policy: WorkPolicy | null,
  allowance: Allowance | null,
): boolean {
  return !!policy && !!allowance && policy.unitsPerSet > 0 &&
    allowance.count > Math.floor(policy.maxUnits / policy.unitsPerSet);
}
// Boundary assertions in free-run-state.test.ts, using allowanceForCount.
expect(isCombinationLimitExceeded(policy, allowanceForCount(120, policy))).toBe(false);
expect(isCombinationLimitExceeded(policy, allowanceForCount(121, policy))).toBe(true);
expect(isCombinationLimitExceeded(policy, allowanceForCount(0, policy))).toBe(false);
```

Extend RunAllowance’s setup fixture to accept a supplied allowance and `onReduceSelection`. With count 144, clicking Add credits calls `open('gear_limit', trigger)` and never `onRun`; with 96, Run Gear Lab retains existing guards. Passing an error/readinessError must preserve its alert and must not convert it into a pricing failure.
- [ ] **Step 2: Run the new helper/UI tests to establish the failing behavior.**
- [ ] **Step 3: Reorganize RunSetup and RunAllowance into the approved three boxes.** Move the existing player identity outside `run-configuration`; keep item version, buffs/settings, and EnhancementSummary inside that first surface. Box two contains combinations, the tooltip, and RunIterations. Box three contains either the free run action/caption/feedback or ProRunNotice. Preserve existing handlers and accessible labels.

`ProRunNotice` uses these contents from Paper:

```tsx
<section className="run-action-panel">
  <div className="section-top"><span>{t('proLimit.title')}</span><span>{t('proLimit.soon')}</span></div>
  <h3>{t('proLimit.heading')}</h3>
  <p>{t('proLimit.body')}</p>
  <Button className="run-button" onClick={(e) => pro.open('gear_limit', e.currentTarget)}>
    {t('proLimit.addCredits')} <span aria-hidden="true">→</span>
  </Button>
  <p className="run-caption">{t('proLimit.noPayment')}</p>
  <Button variant="ghost" onClick={onReduceSelection}>{t('proLimit.reduce')} →</Button>
  <p>{t('proLimit.reduceHelp', { count: freeLimit, iterations: freeIterations })}</p>
</section>
```

Pass `freeLimit` and `freeIterations` as additional numeric props to ProRunNotice from the server policy rather than hardcoding them. Keep these props in the component signature and all call sites. Exact en-US strings: “Free limit reached”; “Coming soon”; “More room for your gear.”; “Larger Gear Lab runs are coming with PRO. Get launch updates and an extra discount.”; “Add credits”; “Payments aren’t available yet.”; “Reduce selection”; “Select fewer items to reach {count} combinations or less. Keep {iterations} iterations and run free.” PT equivalents: “Limite gratuito atingido”; “Em breve”; “Mais espaço para seus equipamentos.”; “Simulações maiores do Gear Lab estão chegando com o PRO. Receba novidades e um desconto extra.”; “Adicionar créditos”; “Os pagamentos ainda não estão disponíveis.”; “Reduzir seleção”; “Selecione menos itens para chegar a {count} combinações ou menos. Mantenha {iterations} iterações e simule grátis.”

For exact counts render the localized excess. For an upper bound render `Up to {count} combinations` / `Até {count} combinações` and `This selection may exceed the free limit.` / `Esta seleção pode ultrapassar o limite gratuito.` Never label an empty/invalid selection as a paid requirement.

Replace the details/summary with a Base UI TooltipRoot and a button TooltipTrigger styled as dashed-underlined text. Keep its existing explanatory text, with localized numbers and the policy-derived iteration limit. Support hover and keyboard focus, and controlled click toggle for touch; Escape dismisses. No disclosure arrow. The tooltip button must not toggle the PRO modal.

- [ ] **Step 4: Align the slider and retain the free-value lock.** Remove the separate numeric heading value; keep the selected scale label and native slider accessible value. Use shared geometry instead of endpoint label alignment exceptions:

```css
.run-iterations-scale { --label-half:20px; --thumb:20px; position:relative; height:64px; }
.run-iterations-scale input {
  position:absolute; left:calc(var(--label-half) - var(--thumb)/2);
  width:calc(100% - 2*var(--label-half) + var(--thumb));
  height:44px; top:0; margin:0; background:transparent;
}
.run-iterations-marks,.run-iterations-labels {
  position:absolute; left:var(--label-half); right:var(--label-half);
}
.run-iterations-marks { top:22px; }
.run-iterations-labels { top:44px; }
.run-iterations-marks span,.run-iterations-labels span {
  position:absolute; left:var(--tick); transform:translateX(-50%);
}
.run-iterations-labels span { width:40px; text-align:center; font-variant-numeric:tabular-nums; }
```

Draw the visual track within the shared marks region, make native track transparent, and retain visible WebKit/Firefox thumbs with 20px border-box size. Remove old first/last-child exceptions. At minimum, maximum, and intermediate values, browser tests must measure marker/label centers within 1px. The interactive range still receives pointer and keyboard events across a 44px high area.

On an attempt above the policy value, reset to the existing selected value as RunIterations already does. Keep the status message and add an explicit `See PRO` / `Conhecer o PRO` button calling `open('iterations_limit', trigger)`. The attempt must not modify TopGearRequest or disable an otherwise valid free run.

- [ ] **Step 5: Preserve work before PRO OAuth and make Reduce selection useful.** In TopGearApp register the cancelable preservation event via `useEffect` and a stable `useEffectEvent` handler, following the existing `topGearStartEvent` pattern:

```ts
const preserveForPro = useEffectEvent((event: Event) => {
  try {
    if (request) saveDraft(request);
    importPanel.current?.saveForLater();
    if (request) sessionStorage.setItem('munigan.top-gear.signin-restore', '1');
  } catch (error) {
    event.preventDefault();
    setStorageError(describeError(error));
  }
});
useEffect(() => {
  const listener = (event: Event) => preserveForPro(event);
  window.addEventListener(proBeforeSignInEvent, listener);
  return () => window.removeEventListener(proBeforeSignInEvent, listener);
}, []);
```

Do not use the preservation event to submit, clear, or modify an admission attempt. A header-triggered OAuth flow must preserve work just like a sidebar-triggered flow. Opening/closing the modal without authentication must not touch drafts.

Wrap InventorySelector in a focusable, named equipment-selection target in TopGearApp (or forward a ref to its existing section to avoid another wrapper). Pass a callback through RunSetup that calls `focus({ preventScroll: true })` and `scrollIntoView({ block: 'start', behavior: 'auto' })` on this target. It must not change request/selection. Avoid smooth scrolling when reduced motion is requested.

- [ ] **Step 6: Run and commit the sidebar change after testing draft preservation and limits.** Include exact/upper-bound counts, unknown policy, invalid sets, service error, pending submission, repeated slider attempts, tooltip keyboard/touch use, successful OAuth draft restoration, storage failure preventing OAuth, and Reduce selection preserving all selected IDs.

```sh
pnpm exec vitest run --project unit src/features/inventory/free-run-state.test.ts src/server/jobs/policy.test.ts --project ui src/features/inventory/RunAllowance.test.tsx src/features/inventory/TopGearApp.admission.test.tsx
pnpm typecheck
git add src/features/inventory/free-run-state.ts src/features/inventory/free-run-state.test.ts src/features/inventory/ProRunNotice.tsx src/features/inventory/RunSetup.tsx src/features/inventory/RunAllowance.tsx src/features/inventory/RunIterations.tsx src/features/inventory/TopGearApp.tsx src/features/inventory/InventorySelector.tsx src/features/inventory/inventory-design.css src/features/inventory/RunAllowance.test.tsx src/features/inventory/TopGearApp.admission.test.tsx messages/en-US/inventory.json messages/pt-BR/inventory.json
git commit -m "feat(pro): add prelaunch sidebar invitation while preserving free limits"
```

### Task 7: End-to-end consent, responsive review, and release handoff

**Files:**
- Create: `tests/e2e/pro-launch.spec.ts`, `playwright.pro-launch.config.ts`
- Modify: `playwright.config.ts` (exclude this OAuth-specific test from the anonymous project)
- Create: `docs/engineering/pro-launch-list.md`
- Update: `docs/design/pro-launch-list.md` with final visual verification references

**Interfaces:**
- Consumes: completed application; existing `tests/support/start-oauth-app.ts`, `startDiscordHarness`, and its isolated database runtime file.
- Produces: browser evidence of explicit consent, durable membership, aligned sidebar, and a deployment/campaign boundary document.

- [ ] **Step 1: Add a dedicated OAuth Playwright config derived from `playwright.oauth.config.ts`.** Use the same local launcher, port, database isolation, one worker, and no saved OAuth screenshots/traces/video. Change only testMatch to `pro-launch.spec.ts`; add that filename to the default config’s testIgnore. Do not route real Discord traffic or save tokens in test artifacts.
- [ ] **Step 2: Write the primary browser test before connecting any missing behavior.** Use the isolated runtime file and database setup pattern in `authentication.spec.ts`; use `startDiscordHarness(page, 'phone_only')`.

```ts
await page.goto('/gear-lab');
await page.getByRole('button', { name: 'Go PRO', exact: true }).click();
await expect(page.getByRole('dialog')).toContainText('Gear Lab without limits');
await page.getByRole('button', { name: 'Continue with Discord', exact: true }).click();
await page.getByRole('button', { name: 'Allow', exact: true }).click();
await expect(page).toHaveURL(/\/gear-lab$/);
await expect(page.getByRole('button', { name: 'Join the PRO list', exact: true })).toBeVisible();
expect((await db.query('SELECT * FROM pro_launch_memberships')).rowCount).toBe(0);
await page.getByRole('button', { name: 'Join the PRO list', exact: true }).click();
await expect(page.getByRole('dialog')).toContainText('You’re on the list.');
expect((await db.query('SELECT * FROM pro_launch_memberships')).rowCount).toBe(1);
await page.reload();
await page.getByRole('button', { name: 'Go PRO', exact: true }).click();
await expect(page.getByRole('dialog')).toContainText('You’re on the list.');
```

Additional E2E cases: OAuth cancellation and invalid state leave no member; storage denial prevents leaving with an unsaved draft; over-limit Add credits opens the same dialog without a simulation POST; existing account/new account both work under existing enrollment controls; account switch never joins the wrong ID; network interruption followed by retry yields one membership; account deletion removes it.

- [ ] **Step 3: Verify both locales and responsive/accessibility behavior.** Run at 1440×900, 768×1024, 390×844, and 320×740. Check desktop Go PRO precedes language picker; mobile drawer closes before modal opens; modal fits/scrolls; focus trap and Escape work; close restores focus; Discord icon follows text; labels and markers share centers; free selection still runs after an attempted higher slider value. Use mocked OAuth only, and capture visual screenshots after auth query strings have been stripped.

For slider alignment use DOM geometry, not only screenshots:

```ts
const labels = await page.locator('.run-iterations-labels span').evaluateAll(nodes =>
  nodes.map(n => { const r = n.getBoundingClientRect(); return r.x + r.width / 2; }));
const marks = await page.locator('.run-iterations-marks span').evaluateAll(nodes =>
  nodes.map(n => { const r = n.getBoundingClientRect(); return r.x + r.width / 2; }));
expect(labels).toHaveLength(6);
for (let i = 0; i < 6; i++) expect(Math.abs(labels[i] - marks[i])).toBeLessThanOrEqual(1);
```

Use `fixtureRequest()` from the existing test support to produce a saved draft with a selection above the limit, and seed it through `saveDraft`’s format; do not replace the production estimate endpoint just to display 144. If a fixture’s estimate is an upper bound, assert the qualifier rather than an exact excess.

- [ ] **Step 4: Run final checks and write the evidence.** Run the targeted integration files from Tasks 1–2, the complete unit/UI suite, typecheck, lint, build, and the dedicated PRO OAuth suite. Run existing OAuth tests because the shared auth-return code changed. Run only one Playwright server suite at a time on port 3100. Record pre-existing failures separately; do not modify unrelated simulator code to force a green run.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test --config playwright.pro-launch.config.ts
pnpm exec playwright test --config playwright.oauth.config.ts
pnpm exec playwright test --config playwright.oauth-rollback.config.ts
pnpm exec playwright test --config playwright.auth-controls.config.ts
git diff --check
```

- [ ] **Step 5: Write the release/operations document.** Include the additive migration order (migrate before deploying routes), required existing Discord/auth environment configuration, safe rollback (previous UI can run with the extra table), membership/consent/offer semantics, deletion behavior, count queries that do not export user data, and the outstanding launch-delivery boundary. No production migration/deploy or outbound messages are executed by this plan without a separate request.

```sql
SELECT source, locale, count(*) AS members
FROM pro_launch_memberships
GROUP BY source, locale
ORDER BY source, locale;
```

Record that `identify` authentication alone is not a Discord notification sender. Before the eventual PRO campaign, build and test an authorized sender, opt-out, blocked-DM handling, and controlled retries against consenting active memberships; preserve the stored offer version when calculating discounts. Do not claim this signup release can already deliver DMs or issue coupons. Link the official Discord sources in the spec. Campaign implementation is a separate deliverable, not a hidden prerequisite to collecting the approved list.

- [ ] **Step 6: Commit verification and handoff docs after checks pass.**

```sh
git add tests/e2e/pro-launch.spec.ts playwright.pro-launch.config.ts playwright.config.ts docs/engineering/pro-launch-list.md docs/design/pro-launch-list.md
git commit -m "test(pro): verify Discord signup and prelaunch entry points"
```

## Acceptance checklist

- [ ] Go PRO appears before the language picker; the mobile equivalent is reachable.
- [ ] Add credits above the free combination limit opens the same coming-soon modal.
- [ ] Free execution and server workload limits are unchanged; no subscription grants paid access.
- [ ] All three planned PRO features and the extra-discount offer are represented.
- [ ] Authenticated account identity is real, not imported-character mock data.
- [ ] Anonymous Discord CTA uses the existing trailing DiscordIcon and returns for explicit consent.
- [ ] Joining survives refresh, is idempotent, and is rejected for stale/wrong/deleting accounts.
- [ ] Both locales, short viewports, keyboard focus, tooltip interaction, and slider center alignment pass.
- [ ] Gear/import drafts and existing save-report/deletion OAuth return paths are preserved.
- [ ] No Stripe/payment code, delivery bot, paid entitlements, or unrelated Log Review/simulator work enters this diff.

## Planning self-review

The seven tasks cover the five approved artboards and the implied loading/error/account-switch states. Contract names and endpoints are shared across tasks; no client-supplied Discord ID or price reaches persistence. Main unresolved future business values (discount amount, PRO pricing, launch date) are intentionally absent from implementation rather than required inputs to this plan. The only future subsystem identified here is campaign delivery, explicitly outside the current signup release.
