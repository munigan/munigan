# Product analytics

PostHog US Cloud project 610630 measures production usage of munigan.app. The organization uses the capped Free plan (1 million product analytics events per monthly cycle); no credit card or paid upgrades. Localhost and preview domains never initialize the SDK.

## Events

| Event | Meaning |
| --- | --- |
| `$pageview` | Initial page and completed pathname changes; report URLs normalized to `/reports/:token`. |
| `gear_import_completed` | User accepts the character import review. Includes spec and item version. |
| `gear_run_requested` | A new simulation submission is attempted. |
| `gear_run_accepted` | The API successfully admits the job; this does not mean simulation completed. Stable event UUID derives from job ID for retries. |
| `pro_dialog_opened` | PRO dialog explicitly opened; `source` is `header`, `gear_limit`, or `iterations_limit`. |
| `pro_discord_signin_clicked` | User starts Discord authentication from the PRO dialog. |
| `pro_launch_joined` | API confirms membership. Stable event UUID derives from membership identity and creation date. |

Successful API events run using Next.js `after`, with bounded SDK transport and swallowed analytics failures. Delivery is best-effort, not an accounting ledger; the jobs and membership tables remain authoritative. Browser blocking or Do Not Track also excludes server analytics because those requests omit the analytics header. Completion/failure of background simulation workers is not tracked in this first release.

## Privacy and identity

Anonymous SDK IDs persist in local storage. Signed-in events use `account:<internal account ID>`; logout/account invalidation resets the identity. No names, emails, Discord identifiers, import JSON, inventory contents, report capability tokens, query strings, hashes, or arbitrary URL paths are sent. Referrers retain origin only. An event/property allowlist strips extra SDK fields, including person-profile properties. The public PostHog ingestion token is deliberately retained because ingestion requires it.

Autocapture, session replay, heatmaps, surveys, feature flag requests and exception capture are disabled. GeoIP enrichment is disabled. `navigator.doNotTrack === '1'` disables tracking. No proxy is used to circumvent blockers.

## Configuration

Production Vercel config: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (public write-only ingestion token). Host is fixed to `https://us.i.posthog.com`. No personal/management API key is used by the app. Server capture additionally requires `VERCEL_ENV=production`. Removing the variable and rebuilding disables tracking.

## Validation

Run `pnpm exec vitest run --project unit --project ui src/lib/analytics`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and the PRO Playwright suite. A production-build browser smoke test must inspect actual `/e/` batch bodies and verify that a private query and report capability are absent. PostHog intentionally excludes automated browser fingerprints, so the local smoke harness models a normal browser without changing production bot exclusion.
