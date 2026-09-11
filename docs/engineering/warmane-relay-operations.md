# Warmane relay operations

## Request path

The browser calls the existing `/api/import/warmane` endpoint. In production, Next.js calls the application-owned Cloudflare Worker using a server-only bearer secret. The Worker retrieves the fixed Warmane profile URL and runs the application's shared strict parser. No third-party proxy or browser-held secret is involved.

- Worker: `wow-droptimizer-warmane-armory`.
- Origin: `https://wow-droptimizer-warmane-armory.diego-encoder.workers.dev`.
- Cloudflare account: `73b79217378198a0ca6b30ad7dcf05cc`.
- Durable Object binding/class: `PROFILES` / `WarmaneProfile`; SQLite migration `v1`.
- Vercel server variables: `WARMANE_RELAY_URL` and sensitive `WARMANE_RELAY_SECRET`.
- Worker secret: `RELAY_SECRET`, matching the Vercel secret.

Production fails closed if configuration is missing. An unconfigured development server can still fetch Warmane directly. The main web deployment excludes the nested Worker package, generated Worker runtime declarations, local environment files and temporary deployment artifacts.

## Freshness and recovery

`mode=auto` reuses a validated snapshot for 60 seconds, then fetches a fresh profile. `mode=refresh` bypasses freshness subject to the 10-second fetch cooldown. Concurrent requests for the same normalized realm/name share one upstream request. Profiles are eligible for explicit saved use for 24 hours; expired snapshots are deleted when next accessed.

`mode=saved` only reads the stored profile. Failures can include its retrieval time, but the UI applies it only after the user chooses **Use saved profile**. The review shows source, absolute retrieval time and relative age. A failed refresh preserves the existing character, bags and preset. Older saved drafts without retrieval metadata remain loadable.

Warmane remains an external dependency: its outages or access restrictions can still prevent a fresh import, and a first-time character has no saved fallback. This service improves the request path and recovery; it does not guarantee fresh availability.

## Limits and diagnostics

Only the four supported realms and validated character names are accepted. Upstream redirects are rejected; HTML and relay JSON are limited to 512,000 bytes. The Worker allows at most two attempts for selected transient network/5xx failures within one 12-second deadline. It does not retry denied, missing or invalid profiles. Warmane Retry-After cooldowns survive object eviction.

Responses are `no-store`, contain a request ID and use distinct rate-limit, timeout, denied, network, invalid-profile and relay-unavailable diagnostics. Structured Worker logs include upstream status, elapsed time, attempts and cache outcome. Next.js logs correlate its request ID with the Worker ID. Secrets and raw profile bodies are excluded from these logs.

For a failure, record the response's `X-Request-Id`, diagnostic code, retrieval time (if offered) and `Retry-After`. Inspect the matching Vercel relay event and Cloudflare Worker logs. A `warmaneBusy` immediately after refresh is the local cooldown; `warmaneRateLimited` denotes an upstream rate-limit response. Do not repeatedly force refresh during either cooldown.

## Development and release

Install root dependencies with `pnpm install --frozen-lockfile`, then run `npm ci` in `workers/warmane-armory`. The nested package pins its compatible Workers test runtime separately from the app's Vitest version.

From `workers/warmane-armory`, run `npm test`, `npm run typecheck`, `npm run types -- --check` and `npm run dry-run`. The CI `warmane-relay` job runs the same checks. Generate declarations with `npm run types` when bindings change; do not manually edit `worker-configuration.d.ts`.

Deploy the Worker with authenticated Wrangler. Supply secrets through Wrangler's protected secret input or a temporary, ignored file, never command arguments or source control. Set the matching production Vercel variables before deploying the web app. Subsequent Worker deployments retain the existing secret when no replacement is supplied.

Use a remote Vercel production build with `vercel deploy --prod --skip-domain --yes` to keep the live alias on the previous version during checks. Verify the deployment's import API with authenticated `vercel curl`, then use `vercel promote` and test the live browser flow. Do not build from environment files containing Vercel `[SENSITIVE]` placeholders.

Rollback the web app to its preceding ready deployment using Vercel's rollback control. The previous app version fetched Warmane directly and may reproduce the original hosted failure. Worker rollback can use Cloudflare's deployment rollback control while retaining the compatible SQLite schema and relay secret.

## Initial verification — 2026-09-11

Worker version `e60eaa62-f438-4a36-9a19-b32d574a635a` deployed successfully (401.80 KiB, 134.63 KiB gzip; 12 ms startup).

Cold authenticated imports returned HTTP 200 from all supported realms between 16:54:29 and 16:54:32 UTC:

| Character | Realm | Equipped items | Elapsed |
| --- | --- | --- | --- |
| Munigaan | Onyxia | 17 | 1,052 ms |
| Barbarius | Icecrown | 16 | 1,320 ms |
| Shamaj | Blackrock | 17 | 982 ms |
| Sarulyn | Lordaeron | 17 | 1,029 ms |

Unauthenticated access returned 401. Sequential auto and saved reads reused the exact retrieval timestamp with `cache` and `saved` sources. An immediate refresh returned 429 / `warmaneBusy`; refresh after the cooldown returned a new `live` timestamp at 16:59:54.761 UTC.

Actual Workers-runtime tests cover authentication, request coalescing, fresh/cache/saved semantics, snapshot preservation and expiry, persisted cooldowns, Retry-After, retries, response limits and the real elapsed deadline: 20 passed. Worker production/test typechecks, generated types and deploy dry-run passed. Independent backend and UI reviews found two issues (local failure request IDs and restoring a draft during an in-flight request); both were fixed with regression tests and approved on re-review.

See [the request-path investigation](warmane-import-reliability-investigation.md) for the poli93 comparison and the limits of the original upstream diagnosis.

## Production web release

- Application source: `0e6435e`, based on production `b323ed2`.
- Vercel deployment: `dpl_4zhmAS6jie4QGRega4yhnaAKp17G`, [deployment inspection](https://vercel.com/diego-fernandes-projects/wow-droptimizer/4zhmAS6jie4QGRega4yhnaAKp17G).
- Deployment URL: `https://wow-droptimizer-8rn32tmrc-diego-fernandes-projects.vercel.app`; promoted to [munigan.app](https://munigan.app).
- Previous ready live deployment observed before promotion: `dpl_BcLKsWU3Jctp24qXAAeeKraZpL7w` (`wow-droptimizer-pqyl361rw-diego-fernandes-projects.vercel.app`).
- Remote production build passed. The staged API returned fresh Munigaan/Onyxia gear, then cached and explicit saved results with the same `2026-09-11T17:06:13.005Z` retrieval time.
- A real browser on munigan.app imported Munigaan/Onyxia into review with 17 equipped items at `17:07:19.937Z`, then refreshed successfully at `17:07:31.807Z`. Retrieval metadata changed as expected. English desktop and Portuguese 390px mobile review controls were verified; no horizontal overflow or browser runtime errors. No simulation submitted.
- The live saved API returned `source=saved`, and invalid realm input returned 422 with a safe diagnostic, matching request ID/header and `Cache-Control: no-store`.
- Final app validation: **74 files / 406 unit and UI tests**, TypeScript, full ESLint, design/spec checks, three focused Warmane browser checks and the remote production build passed. Worker validation: **20 runtime tests**, both typechecks, current generated declarations and dry-run passed. Controlled browser/API tests exercise outages and explicit saved recovery; those outages were not induced on production.

Temporary secret files used for deployment were removed after verification. The active secret remains in Cloudflare and Vercel secret storage.
