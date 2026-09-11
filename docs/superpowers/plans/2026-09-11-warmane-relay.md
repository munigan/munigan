# Warmane relay implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent implementation and review. User already authorized execution and deployment.

**Goal:** Restore production Warmane imports with an owned Cloudflare relay, controlled upstream traffic and explicit saved-profile recovery.

**Architecture:** Next.js calls a private Worker. A Durable Object per realm/name fetches and validates profiles, persists good snapshots and cooldowns, and shares in-flight requests. The existing import review gains source/age, refresh and saved-profile controls.

**Tech Stack:** Next.js 16.3.4, TypeScript, Cheerio, Cloudflare Workers/Durable Objects, Wrangler 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-warmane-relay-design.md`

## Global constraints

- Follow the approved spec's API contract, 60-second freshness, 24-hour retention, 512,000-byte cap and 12-second maximum upstream deadline.
- Share the existing parser; preserve equipment slots, empty sockets, gems, enchants and professions.
- Production must use the private relay; no silent fallback to a public proxy or an unconfigured direct fetch.
- No silent stale import. Saved-profile use must be explicit and bounded by retention.
- Keep account secrets out of artifacts/logs. Use the authenticated account `73b79217378198a0ca6b30ad7dcf05cc`.
- Tests cover actual transport/state/UI outcomes; mock only external boundaries. Read installed Next guides before code changes.
- Work only in `.worktrees/warmane-relay` from `b323ed2`; other worktrees and original checkout are unrelated work.

## Task 1: Worker and coordinated profile retrieval

Files: extract `src/server/warmane/profile.ts`; create `workers/warmane-armory/{package.json,wrangler.jsonc,tsconfig.json,src/*.ts,test/*.test.ts}`. Do not edit `src/server/warmane/armory.ts` (root owns client integration). Consume shared import types in `src/features/import/warmane.ts` and diagnostics.

- [x] Extract parser unchanged through `parseWarmaneProfile`; expose `WarmaneError` with same semantics.
- [x] Write runtime tests: missing/wrong auth must not fetch; valid cold profile yields normalized gear; concurrent same-character imports produce one upstream fetch; fresh reads return original retrievedAt; explicit refresh fetches; errors preserve good snapshot; saved reads and expiry; 429 cooldown survives new object session; no retry on denied/not-found/invalid page; a transient response can recover once; bounded response/deadline.
- [x] Run tests red using isolated worker test runtime/dependencies. Implement Worker `GET /import` with bearer secret `RELAY_SECRET`, DO `PROFILES`, mode and contract from spec. Pin compatible test packages from current docs; generate Env types with Wrangler.
- [x] Run Worker tests, typecheck and deploy dry run. Report exact evidence and changed files for independent review.

## Task 2: Next API transport

Files: `src/server/warmane/armory.ts`, new `relay.test.ts`, `src/app/api/import/warmane/route.ts`, shared metadata types, diagnostics JSON in both locales.

- [x] Write tests showing configured relay URL and secret are used, malformed/mismatched profiles are rejected, metadata/errors/saved suggestions round-trip, no secret/error internals reach clients, and missing production configuration fails closed.
- [x] Implement `lookupWarmaneCharacter(input, mode = "auto")` returning full envelope. Keep `importWarmaneCharacter(input)` compatibility wrapper returning character. Preserve `parseWarmaneProfile` and `WarmaneError` re-exports for original tests. Direct fetch only for explicitly unconfigured development, with logged failure details.
- [x] API passes validated mode and returns structured result/errors with no-store and request/retry identifiers.
- [x] Run new transport tests and existing parser tests.

## Task 3: Import review recovery controls

Files: `src/features/import/ImportPanel.tsx`, focused new UI component/tests as needed, `import-form-draft.ts`, `messages/{en-US,pt-BR}/import.json`, `tests/e2e/warmane-import.spec.ts`.

- [x] Write UI tests that failed live import offers saved profile without applying it; explicit use sends `mode=saved`; changed lookup clears suggestion; fresh/cache/saved source age is visible; refresh failure preserves accepted character, bags and preset; saved metadata survives draft restoration.
- [x] Implement controls using existing Button/Alert components and current layout; no infrastructure terms in user-visible flow.
- [x] Run focused UI and browser checks in both locales with controlled API responses; report evidence for review.

## Task 4: Release and verify

- [x] Independently review Worker/API and UI changes; resolve material findings.
- [x] Enable the Worker with a generated secret via protected temporary stdin/file, and set the matching server-only Vercel variables `WARMANE_RELAY_URL` and `WARMANE_RELAY_SECRET`.
- [x] Verify cold profile import from owned Worker for supported realms; no invented fixtures counted as live success. Verify unauthorized access denied. Enable and verify cache and refresh.
- [ ] Run app unit/UI suite, typecheck, lint and relevant Playwright checks; build preview and verify own Worker through preview API.
- [ ] Deploy production only after successful evidence. Test real import and refresh into review from production, plus cache/error response privacy. Do not submit simulations.
- [ ] Record exact deployment versions/URLs and verification in `docs/engineering/warmane-relay-operations.md`; commit scoped changes. Publish current branch/release under existing repository workflow as authorized.
