# Local Top Gear execution record

Implemented on 2026-09-08 on `codex/top-gear`. Scope: equipped + carried-bag Top Gear, using real pinned native simulations. The user authorized implementation and then explicitly deferred Trigger.dev configuration until after local implementation.

## Milestone coverage

| Plan tasks | Local result | Remaining evidence or differences |
| --- | --- | --- |
| T0–T1 | Scoped revision 4 approval, anonymous Paper-based shell, pinned dependencies and test harness | Full design approval for deferred tools remains pending |
| T2 | Native host/Linux builds, protobuf adapter, 40 presets across 13 DPS modules, generated automatic rotations and catalog | In-game/client parity remains a release gate |
| T3 | Character/bag JSON, full simulator JSON and profile links; physical copies/enhancements; defaults, category edits, draft restore | Fixtures are source-derived; named glyph import currently expects English |
| T4–T5 | Legal complete enumeration, conservative allowance, exact reference deduplication, actual uniform sampling, all results ranked against equipped | Public precision and cost limits require production benchmarks |
| T6 | Transactional admission, budgets, quotas, capabilities and durable state | Explicit SQL via `pg` is used instead of the proposed Drizzle ORM; migration SQL is in `drizzle/` |
| T7 | Separate local workers, cap two, fenced leases, cancellation, retries, outbox recovery, expiry, immutable report API; Trigger integration code included | Trigger account setup, packaging and staging execution intentionally deferred |
| T8 | Import/review, presets, equipment icons, physical-copy selection and locks, explicit bag exclusions, allowance and draft recovery | Fine-grained settings use category JSON editors alongside presets; full reimport replaces the selection |
| T9 | Progress, complete-set rankings and details, pagination, readonly sharing, copy/reuse/edit, partial states, visibility-aware polling | Native CLI cancellation and DB recovery are tested locally; provider interruption awaits staging |
| T10 | Automated tests, native preset matrix, local benchmark, desktop/mobile checks, reproducible setup and CI configuration | Manual screen-reader/zoom review, real client exports, Trigger staging and production calibration remain open |

The implementation consolidates some proposed files into deeper modules: enumeration/allowance/planning share `src/domain/equipment/enumerate.ts`; ranking/statistics share `src/domain/top-gear/report.ts`; work/finalization share `src/server/jobs/work.ts`. No raid, boss, token, billing or cap-optimization features were added.

## Local verification

- 24 unit/UI tests: imports, explicit protobuf defaults, talent legality, item categories, quantity/selection/reference rules, ranking and polling lifecycle.
- 10 PostgreSQL integration tests: concurrent idempotency, no budget overspend, full queue rejection without reservation/outbox writes, ownership, persisted work, cancellation, retry, queue expiry and dispatch-generation fencing.
- 45 native simulator tests: original/wrapped parity, finite statistics, deterministic execution, process cancellation/timeouts and all 40 exported presets.
- Three browser flows: anonymous navigation; import/exclusion/settings/restore/admission-error recovery; real web→database→separate worker→report, shared readonly access, unchanged gains when switching differences, new reference draft and immutable source report.
- Report overflow checks at 320, 390, 768 and 1440 pixels. Desktop and mobile screenshots were reviewed against the Paper exports. These checks do not replace manual accessibility testing.
- TypeScript, ESLint, scoped design and spec coverage checks pass. Production compilation passes locally. The CI workflow is configured; no remote CI run is claimed.
- `pnpm setup:local` reruns successfully against the isolated local PostgreSQL cluster.

## Review fixes

Independent read-only review identified explicit proto3 defaults being replaced by presets, provider busy claims being acknowledged, queued reservations not settling without CPU capacity, and transient work failures not retrying. Follow-up review identified encounter defaults and a stale dispatch acknowledgement racing a new generation. Each was fixed with a regression check. The final pass also preserves the original job deadline across worker recovery, validates returned native stats, and pauses hidden report polling while stopping expired/missing links.

## Next release stage

Review the running local application first. Then configure the user's Trigger project and execute the bounded staging checklist in [compatibility](top-gear-compatibility.md). No credentials, project reference, cloud deployment, public precision guarantee or successful Warmane client test is implied by this local implementation.
