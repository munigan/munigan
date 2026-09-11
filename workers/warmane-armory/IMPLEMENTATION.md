# Warmane relay implementation evidence

Implemented in the `warmane-relay` worktree. Deployment is coordinated by the root task; this worker task performs no remote mutations.

## Contract and storage

- Authenticated `GET /import?name=...&realm=...&mode=auto|refresh|saved`; omitted mode defaults to `auto`.
- Required `RELAY_SECRET` is generated into `Env` from Wrangler's `secrets.required`; unset secret fails closed (503), invalid/missing bearer returns 401. Authentication precedes lookup and all outbound requests. Comparison uses Workers `crypto.subtle.timingSafeEqual` after length comparison.
- `PROFILES` uses SQLite Durable Objects, deterministically named as lowercase normalized `realm:name`. The existing validator canonicalizes names and allowlists realms.
- Snapshots contain only successfully parsed normalized character JSON. Freshness is 60 seconds, saved eligibility 24 hours; expired snapshots are deleted when read. The original parser and `WarmaneError` are extracted into `src/server/warmane/profile.ts` with the parsing behavior unchanged.
- A per-object in-flight promise coalesces live work; each caller retains its own generated request ID. A persisted 10-second request cooldown prevents repeated refreshes and repeated stale misses. Auto still serves a fresh snapshot; saved reads never fetch.
- Upstream Retry-After seconds and HTTP dates persist across object eviction. Public delay/header values cap at 86,400 seconds to fit the app contract, while the full cooldown remains stored, preventing early upstream retries. No automatic stale success occurs: failures offer only saved retrieval metadata.
- Fetches use only the fixed HTTPS Warmane character endpoint and manual redirect rejection. Streaming and content-length limits are 512,000 bytes. One 250ms-delayed retry is permitted for network failures or status 500/502/503/504 without a positive Retry-After; no retries for invalid profiles, 403/404, redirect, 429, or timeout. A single 12-second abort deadline covers both attempts and body reading.
- Structured upstream logs record request ID, status, elapsed time, attempt, retry count, diagnostic reason, and cache outcome; no secret, raw exception, or HTML is logged. Responses have `Cache-Control: no-store`, `X-Request-Id`, and appropriate `Retry-After` when applicable.

## Verification

Commands run from `workers/warmane-armory`:

- `npm test`: **20 passed**, actual Workers runtime and SQLite DO boundary; 14.33 seconds. External fetch alone is mocked, with responses created inside the DO request context. Covers missing/wrong/unconfigured auth and zero outbound requests, input/mode validation, cold parser normalization/gem positions, fresh timestamp reuse, explicit saved reads, 5-way request coalescing, refresh bypass/cooldown, good snapshot preservation after invalid HTML/403, 24-hour expiry, eviction persistence, 403/404/redirect no-retry, 503/network recovery, retry bound, numeric/date Retry-After, full persisted cooldown with public cap, advertised/streamed size caps, and real elapsed 12-second timeout.
- Red assertions were observed against an unimplemented Worker (501 vs required 401/400). Runtime failures also exposed cross-request stream ownership in initial test mocks; corrected by constructing the mocked response in the DO request context.
- `npm run typecheck`: production and test TypeScript both pass.
- `npm run types -- --check`: generated types current.
- `npm run dry-run`: successful, **401.80 KiB uploaded / 134.63 KiB gzip**. No deployment performed.

The test runner emits dependency source-map warnings from Cheerio's transitive packages and a local missing-required-secret warning because the test binding comes from Miniflare config; authentication tests confirm the test binding is effective. These do not affect assertions or deployment bundling.

## Dependencies and current references

Nested package and lockfile isolate `@cloudflare/vitest-plugin` 1.1.8, Vitest 4.1.11, Wrangler 4.131.1, and TypeScript 5.9.3 from the application's Vitest 5. Root dependencies supply the shared parser's existing Cheerio dependency. No root package changes are needed. The application tsconfig/test discovery should exclude `workers/**`; the generated Cloudflare runtime types are Worker-only.

Current documentation consulted:

- https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/
- https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/
- https://developers.cloudflare.com/workers/testing/vitest-integration/mock-outbound-requests/
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

The current recommended test package is `@cloudflare/vitest-plugin`, with `cloudflare:workers` exports and `cloudflare:test` DO helpers. It replaces older `@cloudflare/vitest-pool-workers`/`fetchMock` guidance.
