# Reliable Warmane import

Approved in conversation on 2026-09-11; the user authenticated Wrangler and authorized implementation and deployment.

## Behavior

The existing anonymous import API calls an authenticated application-owned Cloudflare Worker. The Worker fetches only the fixed Warmane HTTPS profile endpoint, parses it with the existing strict parser, and returns normalized JSON. A Durable Object per normalized realm/name coordinates in-flight requests and stores the latest valid profile. Successful snapshots are fresh for 60 seconds, retained for 24 hours, and never replaced by an error or invalid HTML.

`GET /api/import/warmane?name=...&realm=...&mode=auto|refresh|saved` defaults to `auto`. Auto reuses a fresh snapshot, otherwise fetches. Refresh bypasses freshness but respects cooldowns and shares concurrent work. Saved only reads a retained snapshot and never fetches. A failed live request offers saved metadata; using it requires an explicit user action. The review displays retrieval time/source and offers refresh. Preserve optional bags, preset choice, input, and existing review data on a failed refresh. Clear saved suggestions when lookup changes. Translate controls/errors into English and Brazilian Portuguese.

## Contract

Success: `{ character: ArmoryCharacter, meta: { retrievedAt: ISO8601, source: "live"|"cache"|"saved", requestId: string } }`.

Failure: `{ code: string, message: string, params?: Record<string,string|number>, requestId: string, retryAfterSeconds?: number, saved?: { retrievedAt: ISO8601 } }`, with an appropriate non-2xx HTTP status. Saved metadata is a suggestion, never automatic stale success. An expired/missing snapshot yields `warmaneNoSavedProfile`.

## Bounds and diagnostics

- Allowlisted four realms and existing 2–12-letter name validation; fixed HTTPS upstream, no arbitrary URLs, reject redirects and cap bodies at 512,000 bytes.
- Private Worker bearer secret, constant-time check, fail closed if unconfigured. No credentials in browser, source control, command arguments, or log output.
- One retry at most for selected transient network/5xx failures; overall live deadline at most 12 seconds. Respect Retry-After, persist cooldowns across object eviction, no retry for 403/404/invalid HTML.
- Brief refresh cooldown to prevent repeated manual refresh hammering. Shared in-flight promise is per object, never global Worker state.
- Distinct rate-limit, timeout, access-denied, network, invalid-profile, not-found, relay-unavailable diagnostics. Record request ID, upstream status, elapsed time, retry count and cache outcome without secrets or profile bodies.
- Use SQLite-backed Durable Objects and generated runtime/Env types. App-facing responses are no-store.
- Keep startup/dependency overhead low; share parser source rather than maintain two implementations. Main application builds must not load the Cloudflare runtime.

## Release

Use a new worktree from origin/main to preserve production authentication/navigation changes. Deploy a private relay and prove cold imports first, then enable caching/fallback behavior. Validate local API/UI and actual Workers runtime, review changes independently, deploy the web app, verify fresh/cache/refresh imports from production and record deployment/version identifiers. User authorization covers these deployments. Fresh availability still depends on Warmane; never claim unconditional uptime.
