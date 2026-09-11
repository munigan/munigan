# Task 3 implementation report

Implemented the Discord-only runtime, authoritative identity, account lifecycle lock, restricted auth routes, and renewing account-session endpoint. The Task 2 generated auth schema and migration are unchanged.

## Boundaries and behavior

- `getAuth()` initializes Better Auth lazily, validates `BETTER_AUTH_URL` as a fixed root origin matching `APP_ORIGIN`, requires HTTPS in production and a 32-character minimum secret, and uses the existing native PostgreSQL pool. No worker module imports the auth configuration or reads Discord secrets.
- Both rollout flags default false (`AUTH_ENROLLMENT_ENABLED`, `REPORT_SAVING_ENABLED`). An unconfigured cookieless request remains anonymous/disabled. A present normal or Secure auth cookie with unavailable configuration returns `AUTH_UNAVAILABLE` 503. Configured sessions remain validated with both flags off.
- Protected identity uses public `api.getSession`, database lookup with cookie caching disabled and `disableRefresh:true`, safe account fields, session `createdAt` freshness, and active lifecycle verification. Owner hashing uses the existing cookie parser and digest.
- Account-session reads own renewal and append each `getSetCookie()` independently, retaining private/no-store headers. Infrastructure errors become sanitized 503 responses.
- `lockActiveAccount` explicitly obtains `FOR UPDATE`. The before-session hook checks lifecycle for early rejection; the previously reviewed native trigger remains the authoritative concurrent-write barrier. The enrollment hook rechecks the flag before creating users.
- The auth wrapper permits exactly social sign-in, Discord callback, get-session, and sign-out. It rejects concrete token/password routes, other providers, linking, and provider-token APIs. Social requests cannot add scopes, authorization parameters, or ID-token sign-in. POST application auth requests require the exact origin even without cookies.
- Cookies remain host-only, HttpOnly and Lax, and become Secure in production/HTTPS. Origin and CSRF checks are explicitly enabled. Auth IP attribution accepts only `x-vercel-forwarded-for` on Vercel and rejects missing/invalid trusted addresses there; arbitrary forwarded-header fallbacks are disabled. Existing simulation source hashing and owner-cookie policy are unchanged.
- Both the Better Auth logger and its underlying router's unexpected-error logging are prevented from exposing raw details: `logger.disabled` plus `onAPIError.throw`, caught by the sanitized wrapper.

## Tests and RED/GREEN evidence

Read the installed Next authentication, route-handler and rendering guides plus the pinned provider preflight before route implementation. Used the TDD skill.

1. Initial requested focused command failed: both suites could not import the not-yet-created identity/runtime modules (2 failed suites; no tests collected). This is missing-module RED evidence, not an assertion failure.
2. Implemented the runtime and routes; focused suite reached 9 passing and one concurrency-fixture failure. PostgreSQL statistics snapshots were cached inside the deletion transaction; clearing the statistics snapshot before observing a blocked insert corrected the fixture. All initial 10 checks passed.
3. Real mocked-provider callbacks validate phone-only mapping, encrypted provider tokens, existing-account sign-in during enrollment rollback, and rejecting deleting-account sessions. Test transport handles Discord's encoded `%40me` URL and forbids unexpected network requests; it resets database rate-limit fixtures between OAuth round trips.
4. An added regression exposed raw `# SERVER_ERROR: Error: sensitive-provider-token` logging with only `logger.disabled`; the test failed on the leaked synthetic value. Adding `onAPIError.throw:true` made the test pass while preserving a sanitized 503.
5. An added regression for client scope overrides failed with actual status 200 instead of 400. Route request validation made all permission/token override cases pass.
6. An added untrusted-origin regression failed with actual status 200 instead of 403. Explicitly enabling the library origin/CSRF checks and requiring exact origin on application POST auth routes made it pass. Trusted callbacks remain accepted.
7. Final focused command: `pnpm exec vitest run --project unit src/server/auth/identity.test.ts --project integration tests/integration/authentication.test.ts`: **20 tests passed**.
8. Full unit/UI/integration suite, typecheck, and lint passed (final counts recorded below). All integration operations used generated `tg_test_*` schemas on the existing local test database; no deployed services, migrations, real Discord credentials, or production data were used.

Covered: missing/revoked/expired/unknown sessions; storage failure and safe error body; active/deleting lifecycle; lock/insert race with no surviving session; seven-day database and browser renewal; non-renewing protected reads; safe DTO; disabled/rollback behavior; valid owner hashing; anonymous worker-module startup in a subprocess without auth environment; phone-only profile insertion and unverified email; identify-only OAuth URL; token encryption; actual handler endpoint restrictions; origin/return URL checks; and cookie attributes.

## Review notes and limits

- OAuth transport is mocked against the real Better Auth handler and real local PostgreSQL schema. Real Discord application setup/browser consent remains deployment validation.
- The exact endpoint allowlist excludes the library's built-in error page; the later auth-return/UI task should supply its intended same-origin error callback URL.
- Rollout options are initialized per process; deployment environment changes normally restart the process. The enrollment create hook independently reads the current flag to cover an in-process policy change.
- No unrelated application routes, schema files, worker code, or report behavior changed.

Final validation: **57 test files / 296 tests passed** across unit, UI, and integration projects (11.45 seconds). `pnpm typecheck` and `pnpm lint` both exited 0. Native simulator regression coverage was run independently by the controller and is not included in these counts.

## Final persistence-failure correction

Pinned-source review after the first commit found that OAuth signup catches a non-API database insert error and returns `unable_to_create_user` as a 302 error redirect. Added a local-schema trigger that deliberately rejects user insertion: the new actual-handler regression failed with **302 instead of 503**. The callback wrapper now translates the pinned persistence-error redirect codes (`unable_to_create_user`, `unable_to_create_session`, `unable_to_update_account`) into sanitized `AUTH_UNAVAILABLE` responses. Enrollment denial remains a separate library API policy response.

After this correction, **21 focused tests passed**, and the final full run passed **57 test files / 297 tests** in 11.62 seconds. Typecheck, lint, and `git diff --check` all passed. The synthetic failure trigger/function are dropped in a test `finally` block, inside the generated local test schema.

## Review round 1: OAuth lookup failure

Verified the P1 finding against the installed `link-account.mjs`: account-owner lookup and user/email lookup failures become `internal_server_error` redirects. Added an actual-handler regression that creates OAuth state successfully, then temporarily renames `auth_account` in the generated local test schema before the callback. RED: **302 instead of expected 503**, with 21 existing checks passing. Added `internal_server_error` to the existing callback infrastructure-error normalization. GREEN: **22 focused tests passed**, including the new sanitized `AUTH_UNAVAILABLE` JSON assertion. The test restores the table name in `finally`. `pnpm typecheck` and `git diff --check` passed. No broad suite rerun was needed for this scoped correction; the controller separately reported a successful build of the preceding head.
