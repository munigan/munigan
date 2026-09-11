# Discord authentication operations

Enrollment and report saving are disabled by default. Release is blocked until the real Discord checklist below is completed on the exact configured origin. Local automated tests use a controlled provider with the real Better Auth handler, signed state, cookies and PostgreSQL sessions; they do not verify real Discord consent or credentials.

## Configuration

| Variable | Role |
| --- | --- |
| `BETTER_AUTH_SECRET` | Stable, strong server secret for signing sessions/state and encrypting OAuth credentials. Provision once; do not casually rotate. |
| `BETTER_AUTH_URL` | Exact web origin used for OAuth callbacks. |
| `DISCORD_CLIENT_ID` | Discord application's client identifier. |
| `DISCORD_CLIENT_SECRET` | Server-only Discord application credential. |
| `AUTH_ENROLLMENT_ENABLED` | `false` by default; enables new Discord account enrollment when `true`. Existing linked accounts can still sign in when false. |
| `REPORT_SAVING_ENABLED` | `false` by default; enables new saving associations/intents when true. Existing account-associated in-flight jobs and intents still complete when disabled. |
| `APP_ORIGIN` | Exact trusted origin; must agree with the web origin. |
| `DATABASE_URL` | Runtime PostgreSQL connection, possibly pooled. |
| `DATABASE_URL_UNPOOLED` | Direct PostgreSQL URL for migration session advisory locks. Required with a Neon pooler runtime URL. |
| `CAPABILITY_KEY` | Existing report encryption key. Preserve it unchanged: rotation breaks historic report links. |

The migration CLI uses a dedicated pool of one connection and holds its session through migration completion. It accepts an explicitly direct `DATABASE_URL` as fallback and refuses recognized `-pooler` hosts without printing connection strings. Neon uses transaction pooling, which cannot hold session advisory locks reliably: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

The Trigger worker/recovery requires its existing job, DB and capability configuration, not Discord credentials. Missing auth credentials must fail sign-in safely while anonymous work and static homepage builds remain available. Never put server credentials in `NEXT_PUBLIC_*` variables.

Register these exact Discord redirect URIs:

- `https://munigan.app/api/auth/callback/discord`
- `http://127.0.0.1:3000/api/auth/callback/discord`
- For staging, the exact `/api/auth/callback/discord` URL on one fixed staging origin agreed before testing. No arbitrary preview wildcard.

Discord permission scope is exactly `identify`. There is no email login, account linking, bot access or guild access. Phone-only accounts use a synthetic unverified email internally. OAuth tokens are encrypted and never exposed by application DTOs.

## Deployment order

1. Back up and verify the current schema/version. Run the versioned additive migrations through the direct migration URL. Do not rotate `CAPABILITY_KEY` or rewrite historical jobs.
2. Deploy the retention-aware Trigger worker and recovery/cleanup version before enabling web saving. Verify one old anonymous job and one newly account-associated test job, including terminal publication and cleanup behavior.
3. Deploy the web with both new enrollment and saving disabled. Check anonymous import/run, an old report link, localized homepages and no-store report/private APIs.
4. Configure the Discord application and exact callbacks above. Provision stable auth credentials and matching trusted origins.
5. On the configured test origin, enable enrollment and saving and complete the real-provider release gate. Enable production only after its outcome is reviewed.

Saved nonempty reports have no automatic age-based expiry; they remain publicly readable through their capability links until explicit report/account deletion. My Library is private. Anonymous access expires after seven days, followed by the existing 30-day physical-deletion grace period. Empty/failed runs are not indefinitely retained merely because they have an account association.

## Real-provider release gate

Record date, deployed commit, fixed test origin, tester and pass/fail for each action below. Do not attach profile/token screenshots, capability URLs or imported snapshots. **Current status: pending, real Discord credentials/consent not exercised by the local harness. No deployment performed.**

- Real Discord consent and cancellation, including a successful retry.
- Signed-in simulation and terminal report publication.
- Account A My Library from a fresh second browser/device; Account B isolation.
- Explicit anonymous claim from its original browser after completion, and refusal without original-browser ownership.
- Public read-only viewer, sign-out and revocation.
- Individual report deletion and fresh-session same-account reconfirmation for account deletion; verify capability revocation and eventual physical erasure.

## Rollback drill and monitoring

Disable **new** enrollment and saving. Retain existing-account login, sessions, My Library, additive schema and retention-aware worker/recovery. Existing saved data, account-associated in-flight jobs and issued intents must finish correctly. Never roll cleanup back to the legacy bulk-delete behavior. Re-run one old saved public link and its owner's library after the flags are off.

Monitor sanitized authentication/save/publication failures, cleanup lag and failed passes, retained row/byte growth, outstanding deletion age, and migration/worker version. Do not log capability URLs, owner cookies, intent/provider/session tokens, credentials or imported snapshots. A signing-secret rotation requires a separate controlled migration/recovery plan because encrypted provider data also depends on it.

## Local verification

`pnpm test:e2e:oauth` owns a dedicated application on `127.0.0.1:3100` and a random validated `tg_oauth_e2e_*` schema on local PostgreSQL `127.0.0.1:55435/wow_top_gear`. It never uses an exported runtime DB URL or an existing server. Browser consent is fulfilled at `https://discord.com` so callbacks are actually cross-site. The guarded Node preload handles only the pinned token and userinfo endpoints and records only endpoint kinds. Test fixtures never manufacture sessions or OAuth state. Traces/video are disabled for this suite because they would capture capabilities. Its runner removes only its own schema and marker files on normal shutdown. A force-killed runner may leave a random schema requiring local manual cleanup.

Run browser servers sequentially. Full release sequence: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm test:sim`, `pnpm test:e2e`, `pnpm build`, then `AUTH_CONTROLS_PRODUCTION=1 pnpm test:e2e:auth`. The last command checks production cache headers; Next dev intentionally overwrites page cache headers. Inspect `.next/prerender-manifest.json` for both homepage locales and inspect built server/client output for test-only provider markers and credential canaries. Do not mistake test-provider success for the real-provider release gate.
