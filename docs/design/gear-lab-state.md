# Gear Lab state ownership

Each mounted `TopGearApp` owns one vanilla Zustand store. `GearLabProvider`
creates it once and provides a stable context; `useGearLabSelector` subscribes
React components to a primitive, a stable branch, or a cached projection.
`useGearLabStore` is for event-time reads and lifecycle adapters. There is no
module-global editable session or React copy of the active `TopGearRequest`.

## Owners and APIs

All state modules live in `src/features/inventory/state/`.

| Owner | Responsibility and public boundary |
| --- | --- |
| `gear-lab-store.ts` | `createGearLabStore`, `GearLabState`, `GearLabActions`: normalized editable `draft`, replacement `epoch`, stable domain commands |
| `GearLabProvider.tsx` | `GearLabProvider`, `useGearLabStore`, `useGearLabSelector`: session scope and React subscriptions |
| `gear-lab-selectors.ts` | `createAnalysisInputSelector`, `createInventorySelector`, `createNonPurchaseSelector`, `createRowPresentationSelector`, wallet selectors: bounded latest-input caches |
| `GearLabRuntime.tsx` | `createGearLabRuntime`, `GearLabRuntimeProvider`, `useAnalysisView`, `useInventoryView`: shared analysis session and inventory projection |
| `gear-lab-analysis.ts` | `createAnalysisController`: worker transport, monotonic revisions, newest pending input, preview publication and retry |
| `useGearLabAnalysis.ts` | `createAnalysisSession`: store/policy subscription and controller lifetime, including React effect replay |
| `gear-lab-persistence.ts` | `createDraftPersistence`: debounced draft writes, `flush`, `cancel`, `discard`, `complete`, `dispose` |
| `useGearLabSession.ts` | Import/restore/start navigation, policy and eligibility, persistence lifecycle, account recovery UI |
| `useGearLabAdmission.ts` | Event-time draft read, current-analysis guard, immutable admission attempt, duplicate-submit guard, report navigation |

Ordinary controls dispatch intent: `toggleItem`, `setPurchaseIncluded`,
`setIterations`, `saveResource`, enhancement commands, `applySettings`, and
`setItemVersion`. Commands read current state and preserve unchanged references;
no-op edits do not notify. `replaceDraft` is reserved for import, restore, and
session transitions and increments `epoch`. Settings commit only spec/settings/
provenance/profession fields. Resource save is one atomic command. Local React
state holds open dialogs, filters, focus targets, and unsaved modal edits.

## Dependencies

| Consumer/work | Invalidating inputs | Inputs that do not invalidate it |
| --- | --- | --- |
| Shell | Draft presence, spec, item version, lifecycle/admission UI | Ordinary precision and checkbox edits |
| Run setup | Snapshot, iterations, resource-type count, purchase presence, current allowance/readiness | Unrelated request branches; memoized configuration also ignores precision |
| Purchase dialog | Snapshot, purchase inputs, analysis view, open state | Iterations and owned selection directly; resulting analysis may update it |
| Purchase analysis | Epoch, snapshot, selection, purchase intent and normalized legality policy | Iterations and selectable precision range |
| Nonpurchase allowance/enhancement analysis | Same legality inputs, with no purchase intent | Iterations and selectable precision range |
| Inventory grouping/validation/previews | Relevant item/profile/spec/settings/profession/enhancement inputs and candidate preview | Precision; selection-only edits retain unrelated rows and grouping references |
| Inventory row | That row's item, checked/disabled state, preview and presentation dependencies | Unrelated row changes |
| Wallet images/controls | Snapshot, balances, gear variant; image presentation excludes balances | Precision and exclusions; included-count summary subscribes separately |
| Draft persistence | Editable draft reference or replacement epoch | Analysis-only publications and transient UI |

Wallet selectors retain a request-shaped presentation value but compare only
fields their consumers read. Do not read new fields from such a value without
extending its cache dependencies. Other connected controls use explicit branch
selectors; none subscribes directly to the whole draft. Generated inventory is
a projection, not editable state: current exclusions/overrides determine intent
while worker availability catches up. Physical owned duplicates and existing
generated-item deduplication rules remain in the domain/projection pipeline.

## Worker publication and submission

The controller runs at most one analysis with one replaceable pending input.
Serialization with `encodeRequest` happens only when dispatching that input;
there are no per-render JSON worker keys. Precision is omitted from analysis
inputs because it affects simulation work, not legal combinations.

Each worker owns a `createPurchaseAnalyzer` instance. Across ordinary selection
changes it retains prepared purchase candidates, acquisition decisions, and
loadout validation/enhancement results. Snapshot, purchase intent, locks, selected
custom rewards, and search-budget changes invalidate preparation. Value comparison
happens at worker dispatch because decoded requests have fresh object identities.
Acquisition decisions retain purchase rewards and physical upgrade prerequisites
in their keys. Loadout keys preserve slot order and physical item identity.
Caches are bounded (4,096 acquisition decisions and 250,000 loadout evaluations)
and disappear with the worker; eviction affects performance, never eligibility.
Cached work charges the same logical search-node cost as fresh work so preview
and server admission agree. Selection changes still enumerate current combinations;
iterations do not trigger analysis.

Every changed analysis input increments `revision`; only the active worker's
matching revision can publish, and only the current revision can become ready.
Selection/exclusion changes retain compatible availability previews. Changed
availability inputs clear them. Errors retain the last available preview and
expose Retry; retry creates a fresh worker when needed. Replacement, removal,
disposal, and effect replay detach/terminate obsolete workers.

Run is guarded again at event time: `revision === completedRevision`, ready
complete purchase analysis and allowed work are required. The adapter reads the
current draft after any awaited auth refresh, validates it, flushes persistence,
and calls `createAttempt` in `features/inventory/admission-attempt.ts`.
The attempt's serialized body, mode, and idempotency key stay fixed across
pending/uncertain retries. It is stored separately in sessionStorage under
`munigan.top-gear.admission`. UI edits can continue without changing that body;
`submitting` prevents duplicate clicks. Rejected attempts can be replaced under
the existing recovery rules. Successful admission opens the report even if
cleanup storage fails, and preserves a newer draft.

## Storage and policy compatibility

Drafts keep localStorage key `wow-droptimizer.top-gear.v1` and the existing
`JSON.stringify(encodeRequest(request))` / `decodeDraft(JSON.parse(raw))` format
in `features/import/draft-store.ts`. There is no new storage migration.
Editable changes debounce serialization and writes by 250 ms. Session transitions,
pagehide, visibilitychange, unmount and submission flush through the persistence
owner. Discard cancels delayed writes. Completion persists current edits first
and clears only storage matching the submitted request, so an older report cannot
erase a newer setup. Storage errors follow the existing visible recovery path.
Interactive inventory controls do not write localStorage directly.

The store consumes the server's selectable iteration policy; it does not hard-code
limits. Current local policy defaults to 500 and allows 500–6000. Server admission
planning time, simulation duration/concurrency, acquisition rules and visual
design are outside this frontend refactor.

## Verification

Run from the repository root, one suite at a time:

```sh
pnpm test
pnpm exec vitest run --project integration tests/integration/purchase-admission.test.ts tests/integration/purchase-work.test.ts tests/integration/admission.test.ts
pnpm typecheck
pnpm lint
pnpm check:design
pnpm check:specs
git diff --check
```

Integration support creates a random `tg_test_<16 hex>` schema under Vitest,
sets its connection search path, and guards create/drop operations against that
pattern. Never repoint these tests at the live harness schema. While the shared
port-3100 harness is active, do not run build against its `.next` output or the
default Playwright configuration (`reuseExistingServer: false`).

Regression coverage includes stable row identity/focus, zero analysis/validation
on precision edits, current checkbox counts during worker failure, stale reply
rejection, newest-pending coalescing, batched writes, immutable retry bodies,
auth recovery and newer-draft preservation. Local evidence is saved under
`.artifacts/gear-lab-zustand/`: `verification.md`, `profile-comparison.md` and
`live-checks.md`. React Profiler/jsdom timings measure render work, not browser
input latency or server simulation time.
