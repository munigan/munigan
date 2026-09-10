# Discord authentication and My Library

Date: 2026-09-10

Status: architecture approved in conversation; written specification awaiting review. No implementation or deployment authorized by this document.

## Purpose and agreed direction

Let people use Gear Lab without an account, then sign in with Discord to keep their own reports and find them across devices. Use the approved Paper authentication experience and shared top navigation. Gear Lab is the user-approved public name for Top Gear; existing internal contracts and URLs remain compatible.

Saved reports have no automatic age-based expiry: they remain until the user deletes the report or account. Anonymous reports retain seven-day access, followed by the existing 30-day physical-deletion grace period. These are different policies from session expiry and job execution deadlines.

My Library is the account-wide saved-content destination. This release implements Gear Lab reports only. Paper's saved setups and Raid Trainer results demonstrate extensibility and must not appear as functioning save features yet.

Design reference: [Discord experience and navigation](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/O-0). Handoff: `docs/design/discord-authentication-experience.md`. Main screens were reviewed; the extra navigation-detail board still needs a final render check. Use the verified main screens as the implementation reference if that preview problem persists.

## Approach

Use Better Auth inside the existing Next.js Node runtime with the existing `pg.Pool` and PostgreSQL database. Better Auth owns identity, OAuth and sessions; application services own reports, library entries, retention and authorization. Do not put report-claiming logic into generic user-created hooks.

Alternatives considered:

- A hosted identity service adds another operational dependency and a separate identity administration surface without a needed feature for this release.
- Custom Discord OAuth reduces library dependencies but makes the application responsible for implementing and maintaining OAuth/session security.
- Better Auth provides the required integration while keeping the database and UI under our control. Its native PostgreSQL integration fits the actual code, which currently uses SQL through `pg`, despite Drizzle being installed.

## Existing integration points

- `src/server/db/client.ts`: shared pool, transaction helper, isolated test schemas, Vercel pool lifecycle handling.
- `drizzle/0000_top_gear.sql`: job, work, budget and outbox tables. Jobs carry an anonymous owner hash, read-token hash/encrypted replay, immutable request/results and an expiry timestamp.
- `scripts/migrate.ts`: currently replays one idempotent SQL file; needs ordered, recorded migrations before adding this subsystem.
- `src/server/http/api.ts` and `/api/top-gear/config`: `tg_owner`, an HttpOnly, Secure-in-production, SameSite=Strict anonymous capability cookie.
- `src/server/jobs/admit.ts`: admission, idempotency, quotas and cancellation. `work.ts`: execution, settlement, report reads and retries.
- `src/server/jobs/reconcile.ts`: expiry cleanup, also executed by `src/trigger/recovery.ts`. Web and worker deploy independently.
- `src/features/reports/ReportView.tsx`: report context, sharing, polling, pagination and edit/run-again behavior.
- `WorkbenchNavigation.tsx`, `AppDocument.tsx`, and `src/i18n/`: shared shell and localized home/workbench rendering.

## Release scope

Include Discord sign-in/sign-out, session-aware header, report save prompt and dialog, explicit anonymous-report claiming, automatic retention of signed-in runs, private My Library, report deletion, account deletion, localized error/recovery states and operational monitoring.

Include Gear Lab display-name changes in navigation, homepage, tool/report headings and metadata. Preserve `/top-gear`, `/api/top-gear`, `tool: "top-gear"`, local draft keys and persisted simulation contracts. Renaming these technical identifiers or introducing route redirects is outside this release.

Do not add passwords, email sign-in, additional providers, Discord bots/guild access, account linking, cloud draft synchronization, saved setups, Raid Trainer persistence, subscriptions or changes to simulation formulas. Signing in does not grant extra simulation capacity.

## Module boundaries

| Unit | Responsibility and interface | Dependencies |
| --- | --- | --- |
| Auth configuration and client | Configure Discord and session behavior; expose the Better Auth handler/client | Better Auth, shared PostgreSQL pool, server secrets |
| Request identity | Resolve a validated account and/or anonymous capability; distinguish missing session from infrastructure failure | Auth session API, cookie parser |
| Report access | Decide read, manage, claim and delete permissions; supply access metadata separately from frozen results | Request identity, job ownership and lifecycle records |
| Save intents | Begin and complete an explicit anonymous-report claim, idempotently | Report access, transactions, database clock |
| Library | Create/report entries and query the caller's saved work with bounded search/pagination | Account identity, library records, report-summary adapter |
| Account lifecycle | Revoke access and schedule durable deletion without breaking active-job settlement | Auth records, library, jobs, recovery task |
| UI features | Optional sign-in, save/recovery states, library and account actions | Public DTOs, auth client, Base UI components, translations |

Extract report reading/authorization from the worker-heavy `work.ts` into a focused server module. Retain the existing historical report normalization and recommendation calculation. This is a targeted separation needed for shared access rules, not a general worker rewrite.

## Identity and sessions

Configure only the Discord provider. Request `identify`, disable default extra scopes, and use Discord's immutable user ID as provider identity. No guild, bot or email permission is needed.

Better Auth currently requires a user email field. Map all Discord identities to a deterministic non-deliverable value such as `<discord-id>@discord.placeholder.invalid`, marked unverified. This is an internal compatibility value, never displayed as contact information, used for mail or accepted as an alternative login. Keep email/password, verification-mail flows, email changes and automatic cross-provider linking disabled. This also supports phone-only Discord accounts.

Store the provider ID, display name/avatar and the records Better Auth requires. Use the pinned release's supported token-encryption option for persisted OAuth tokens. Do not expose provider access/refresh tokens in application DTOs or logs. Do not add plugins which expose JWTs, API keys or provider tokens for this feature.

Use database-backed sessions with HttpOnly cookies, Secure in production, host-only scope, and Better Auth's supported OAuth-compatible SameSite behavior. Proposed concrete defaults: seven-day rolling session, refresh at most daily, five-minute freshness requirement for account deletion. Keep cookie caching disabled initially so revoked sessions are rejected immediately by protected operations.

Validate sessions at every protected endpoint/service boundary. Cookie presence alone is not authorization. Verify exact trusted origins; accept only validated same-origin callback destinations. Use Better Auth's OAuth state/PKCE protections rather than replacing them.

Use database-backed auth rate limiting appropriate to Vercel's multiple instances. Retain existing simulation source/global limits and add account-wide limits using the same current per-owner thresholds (two active, twenty daily), in addition to anonymous-browser limits. Deleting a report must not reset today's usage.

## Data design

Generate the Better Auth schema from the exact dependency version selected for implementation, inspect it, and commit SQL migrations. Use explicit `auth_` table names to avoid generic names colliding with application tables. The consulted docs identify 1.7.4 as current; verify the registry version and compatible APIs when pinning, rather than copying unversioned examples blindly.

Application additions:

| Record | Fields and invariants |
| --- | --- |
| Account lifecycle | One row per auth user; `active` or `deleting`, deletion timestamp. Protected operations and new session creation reject `deleting` accounts. |
| Job ownership/lifecycle | Nullable account user ID, nullable `deleted_at`, and publication timestamp. Preserve anonymous owner/read hashes and the original anonymous expiry. Account ownership is exclusive; it cannot be transferred by changing cookies. |
| Library item | UUID, user ID, tool key, kind, title, character/spec summary, created/saved timestamps, nullable deletion timestamp. A unique Gear Lab job foreign key links each report to at most one library entry. Tool/kind combinations are validated; Gear Lab/report is the only supported pair initially. |
| Save intent | Hash of a cryptographically random opaque token, job ID, anonymous-owner hash, creation/ten-minute expiry, completion timestamp and completing account. No raw capability or provider token. |

Use typed columns for ownership, dates, filtering and references. Any JSON summary is bounded display metadata, not a second copy of the full request or results. Library queries join only the current user's nondeleted records and return no encrypted read tokens or owner hashes. Index user/date/ID for pagination and job ownership/retention lookups.

Account ownership is the authority for account operations. An active library item is the retention reference for a terminal report. Ownership association alone must not retain failed empty jobs forever. All mutations maintain these rules transactionally.

## Anonymous save journey

1. A terminal report containing at least one successfully evaluated result offers its anonymous owner a dismissible Save report notice. A shared-link viewer cannot claim it and instead receives read-only context. Existing, unexpired pre-release reports are eligible when the original owner cookie is still present.
2. A same-origin JSON POST begins a save intent. Verify the report token, current anonymous owner, eligibility, absence of deletion and account ownership, and database expiry. Store only the hashed opaque intent token and ownership binding. Do not import all reports associated with the browser.
3. Keep the intent and report view state in per-tab session storage: selected combination, pagination, comparison mode and scroll. Persist any relevant local draft before navigating. Failure to preserve context is shown before leaving; no owner secret is copied into web storage.
4. Start Discord OAuth with a validated same-origin return route containing only the opaque intent token. Better Auth manages OAuth state and session issuance. The intent is not ownership proof by itself and is not placed in the public report share URL.
5. The return page issues a same-origin POST to complete saving, using both the validated account session and the original anonymous owner cookie. Do not claim inside the cross-site OAuth callback: the existing Strict cookie may be absent there. Remove the intent token from the visible URL after capturing it and use no-store/no-referrer headers.
6. In one transaction, lock the active account lifecycle row, save intent and job; recheck the owner binding, eligibility, expiry and deletion state; set account ownership; insert the unique library entry; mark the intent completed. An intent completed by the same account returns the same success. A competing account is rejected. If the intent is lost/expired, return to the report and let the verified owner restart saving.
7. Return to the same report and restore its view state. Show Saved only after the transaction succeeds. If sign-in succeeded but saving failed, retain the authenticated session and offer Try saving again. Cancellation or denial returns to the report with no persistence claim.

A missing original owner cookie cannot be replaced with possession of the report URL or intent. Show a precise recovery message rather than assigning ownership. OAuth and report save remain separate outcomes. An unsaved report that expires during OAuth cannot be rescued after the deadline.

Already-signed-in anonymous owners use the same ownership checks through a direct claim operation without an OAuth round trip. General header sign-in does not claim existing browser history or unrelated reports.

## Signed-in runs and worker publication

At admission, resolve identity on the server and store the active account ID in the same transaction as the job/outbox. Do not accept a client-supplied account ID. Keep the existing anonymous capability for browser idempotency and anonymous continuity, but once account-owned, management requires that account's valid session.

On a signed-in UI, an expired session or unavailable auth database must not silently submit an anonymous run. Return a recoverable session/service error; preserve the draft and allow explicit sign-in or continuation anonymously. A genuinely anonymous submission remains supported.

Publish the library entry transactionally with final result/settlement for complete reports and partial/canceled reports with successful results. Failed/canceled jobs with no useful results are not library entries and expire normally. Library publication must not depend on a mounted report page or active login cookie. Idempotent worker delivery produces one entry, and publication failure cannot leave the job settled but missing its promised entry.

Account deletion and worker publication use consistent locking (account lifecycle before job when both are needed) and recheck deletion under lock. A deleting account or deleted job cannot gain a new library entry. Recovery retries legitimate publication failures; it never recreates intentionally deleted entries.

Idempotency replay must verify account ownership before returning an existing signed-in job. Changing the signed-in account in the same browser must not reveal or transfer a prior account's report. A retry creates a new report attached to the authorized caller, leaves the old report intact, and checks account ownership before reusing prior work. The new run retains all current budget controls.

## Access, sharing and retention

| Visitor/state | Read report | Manage/save |
| --- | --- | --- |
| Valid read URL, unexpired anonymous report | Yes | Only matching anonymous owner can manage or claim |
| Valid read URL, saved report | Yes, read-only even after original anonymous expiry | Only owning active account can manage/delete |
| Owning account opening My Library | Yes across devices | Account permissions; no original browser cookie required |
| Different account with original anonymous browser cookie after claim | Read through valid link | No ownership transfer or management |
| Expired unsaved report | 410 | No claim, retry or resurrection |
| Deleted report/account | Unavailable | No claim or management |

Preserve existing report URLs and read-token encryption keys. My Library resolves a link only after validating the owning account. Sharing uses the canonical report URL and does not include auth-flow parameters, user IDs or session information. A saved report's existing read link remains accessible until deletion; My Library itself is private.

Return access metadata outside frozen simulation results: anonymous expiry, saved status, effective expiry (null when retained), canManage, canSave and canDelete. Every UI expiry display uses this metadata; the historical report's embedded `expiresAt` must not falsely state that a saved report will expire. No simulations are rerun or frozen metrics rewritten to save a report.

Make cleanup select-and-delete checks transactional and exclude active retained entries. Save, publication, deletion and cleanup must not race into deleting a report after a successful save. Existing anonymous grace and settled-job constraints remain. Monitor retained bytes and entry growth; do not silently expire saved items or add a paid storage plan.

## Deletion and sign-out

Report deletion is an explicit confirmed action with a clear statement that the share link will stop working. Atomically mark the library entry and job deleted. Reads, management, claiming and idempotency replay reject tombstones immediately. There is no restore feature in this release; do not label the operation merely Remove from library.

Physical cleanup removes deleted payloads after safe job settlement through the recovery task. Preserve minimal operational records needed for current-day quotas, budget accounting and outstanding retry references, without leaving character snapshots/results readable. Dependent retries already contain independent request/results; deletion may detach their prior-job foreign-key reference without deleting the retry. Change that foreign-key cleanup behavior explicitly and test it. Do not use deletion as a route to release already-spent simulation budget.

Account deletion requires a recent Discord-authenticated session and confirmation of the exact signed-in identity. If reauthentication returns a different account, do not delete either account. Use an application lifecycle operation rather than exposing Better Auth's default hard-delete path independently:

1. Lock and mark the account deleting, tombstone all its library items/jobs, request cancellation of active jobs and revoke all sessions. New admission/claim/publication/session issuance must reject the deleting account.
2. Return confirmation that access is removed and cleanup is processing. Active jobs still settle reservations normally; they cannot publish new saved items.
3. A durable recovery pass removes saved payloads, intents, provider credentials and auth user data after dependent jobs settle. Keep the deletion state until cleanup completes, retry failures and monitor aged deletions. Signing in during cleanup cannot resurrect data. A later new account for that Discord identity starts empty.

Automatic recovery runs every ten minutes in current production; failed cleanup remains queued for subsequent passes. Do not promise an exact physical-erasure time. Provider backups follow their configured lifecycle and are outside immediate application deletion; publish accurate user-facing deletion wording before release.

Sign-out revokes the current session and clears client account/library caches. Account-owned reports cannot fall back to anonymous-owner management after sign-out. Local equipment drafts remain local and are not uploaded or reassigned by sign-in. Account deletion clears the current browser's local drafts with explicit wording; other devices' local-only data cannot be remotely erased and must not be claimed as erased.

## HTTP and presentation contracts

Mount Better Auth under `/api/auth/[...all]`. Add application-owned endpoints for starting/completing save intents, direct authenticated claiming, querying/deleting library items, and account deletion. Use `/library` and a dedicated auth-return route in the workbench routing group. Exact endpoint names and files belong in the implementation plan, not implicit coupling to Better Auth hooks.

All application mutations validate origin, content type, size and input; account identity is always server-derived. Use stable localized error codes. Missing authentication returns 401, wrong ownership does not reveal the record, expired reports return 410, state conflicts return 409, capacity limits return 429 and infrastructure failures return 503. Report DTOs distinguish unavailable permissions from load failures.

My Library lists twenty items per page, newest saved first with UUID as a deterministic tie-breaker. Use cursor pagination and a parameterized, trimmed, length-bounded search over title/character name. The tool filter contains only supported tools with saved content; initially Gear Lab. Keep existing content visible while changing pages, do not scroll to top, and prevent stale responses from crossing account/filter boundaries. Sign-out or account change clears private content immediately. Do not load full report JSON merely to render the library.

Use the existing Base UI Dialog, Select and Toast wrappers for the Paper states. Include signed-out, empty, search-empty, loading, load-failed, save-pending, save-failed, canceled OAuth and expired-session states. Save prompts are inline and dismissible; opening a result does not launch a blocking modal automatically. Preserve an understated expiry/save affordance after dismissal, scoped to the report.

Keep the shared top bar and mobile navigation. My Library, Discord sign-in/account avatar, sign-out and account deletion are in the account area. Preserve locale and current tool state during authentication. Fetch header account state through a client boundary with a dimensionally stable loading slot so `/en-us` and `/pt-br` remain prerendered. Do not add `headers()`/session reads to the shared marketing layout or expose private data through shared caches.

Implement EN-US and PT-BR copy, localized dates/numbers, accessible icon names, focus restoration, Escape and keyboard behavior. Saving feedback uses live announcements without stealing focus. Retain reduced-motion behavior. After OAuth, restore report selection/page/scroll; if the saved selection no longer exists, fall back to the current recommendation without crashing.

## Migration and release strategy

1. Introduce a migration ledger, checksums, an advisory migration lock and ordered transactional SQL. Support both a new database and the existing untracked `0000` schema. Replaying the legacy idempotent baseline must not reset data; validate required baseline objects before recording adoption. Use the same migration runner in isolated database tests.
2. Apply additive auth, lifecycle, ownership, library and intent migrations. Existing reports remain anonymous, with no bulk historical account assignment. Do not rotate `CAPABILITY_KEY`.
3. Deploy a compatible worker/recovery version before enabling auth/saving. It must preserve retained entries, publish signed-in results and honor deletion. Existing jobs without account metadata behave as before.
4. Deploy the web release with saving disabled, verify schema/worker compatibility and configure Discord application credentials and exact callback URLs. Then enable the feature after local/staging and production smoke checks.
5. Roll back by disabling new account enrollment and saving while retaining existing-user sign-in, sessions, library access, migrations and retention-aware cleanup. Never restore an old cleanup worker that deletes retained reports. Existing users must not lose access to saved data as a rollback side effect.

Required server configuration: Better Auth secret, fixed Better Auth base URL, Discord client ID/secret and separate enrollment/saving rollout flags. Reuse `DATABASE_URL` and the existing canonical origin. Register `https://munigan.app/api/auth/callback/discord` and the exact local-development origin (`127.0.0.1:3000` currently) with Discord. Use a fixed staging origin if needed; do not wildcard arbitrary Vercel preview origins. Keep all secrets out of source control, browser bundles and logs. Workers should not require Discord secrets just to process jobs/library publication.

## Verification and acceptance

Automated tests must cover:

- Fresh and existing-database migration paths, repeated migration execution and isolated auth tables.
- Discord identity mapping without email, only the intended scopes, session expiry/revocation and unavailable auth storage.
- Valid anonymous claim, public-link rejection, missing/changed owner cookie, already-owned report, concurrent different-account claim, retrying the same claim and intent expiry/replay.
- Real redirect-shaped OAuth return handling with Strict anonymous cookies; no assumption that the cross-site callback sees the owner cookie. Test a controlled OAuth provider flow through Better Auth; never add a production authentication bypass.
- Account association at admission, account-wide limits, browser/account changes during idempotency replay, cross-device reads/retries and browser-independent worker publication.
- Useful partial/canceled results versus failed empty runs; duplicate worker delivery; publication failure transaction rollback.
- Anonymous expiry, retained access after the old expiry, stale embedded expiry metadata, save-versus-cleanup and delete-versus-publication races.
- Library isolation/search/cursor ordering, pagination without blinking, cache clearing at sign-out/account change and no full result payload in list responses.
- Report deletion invalidating shared links, quota preservation, retained retry references, account deletion during active work, session revocation and durable cleanup retry.
- Both locales and mobile/desktop for optional prompts, modal accessibility, account controls, save recovery and restoration of selected combination/page/scroll.
- Anonymous import, local draft restore, existing public report links and edit-and-run-again remaining functional.

Run typecheck, lint, relevant unit/UI/database and browser suites, and a production build. Native simulation tests remain appropriate when worker settlement/retry behavior changes; use deterministic evaluator fixtures for authorization races. Verify homepage prerendering and no auth-state layout shift.

Before release completion, manually exercise real Discord consent/cancellation with a test account on the configured origin, then a small signed-in run and cross-device library access. Also verify one anonymous save after completion, a shared viewer's lack of claim rights, sign-out, and deletion. Any missing real OAuth validation must be recorded as a release blocker, not replaced by mocked browser evidence.

Monitor auth errors, save failures, publication failures, cleanup lag, retained row/byte growth, and migration/worker versions. Logs carry request/job correlation IDs and sanitized error codes, never report capability URLs, owner cookies, save-intent tokens, provider tokens or full imported characters.

## Sources and review notes

- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next): route-handler and session integration.
- [Better Auth PostgreSQL integration](https://better-auth.com/docs/adapters/postgresql): direct `pg.Pool` integration and generated schema.
- [Better Auth Discord](https://better-auth.com/docs/authentication/discord): provider configuration and callback registration.
- [Better Auth OAuth](https://better-auth.com/docs/concepts/oauth): identity mapping, absent email and scope configuration.
- [Better Auth sessions](https://better-auth.com/docs/concepts/session-management): session lifetime, freshness and cache/revocation trade-offs.
- [Better Auth users/accounts](https://better-auth.com/docs/concepts/users-accounts): deletion and account lifecycle hooks.
- Installed Next.js guide: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`.
- Repository operations: `docs/engineering/top-gear-operations.md` and `docs/engineering/production-launch.md`.

Self-review: the scope is one account/report-retention subsystem with a small initial library. Public reading, private management and persistence are separate. Account-owned reports never fall back to browser ownership; failed empty runs do not gain indefinite retention. Deletion is immediate for access and durable for cleanup. Future tool examples are explicitly excluded from implementation. The next artifact is the detailed implementation plan after review of this specification.
