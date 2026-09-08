# WotLK Optimizer Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Work inline unless the user explicitly requests delegation.

**Goal:** Implement the public WotLK optimizer using the approved Paper design, Poli93's CLI mechanics, and bounded Trigger.dev execution.

**Architecture:** A Next.js application owns import/configuration, admission, and report presentation; PostgreSQL owns durable snapshots, work, budgets, and reports. Trigger.dev coordinates and executes native CLI simulations under a shared concurrency cap. Pure equipment and comparison modules remain independent of React, the database, and Trigger.dev.

**Tech Stack:** TypeScript, Next.js App Router/React, Tailwind CSS v4 using exported Paper tokens, Zod, PostgreSQL with Drizzle/node-postgres, Trigger.dev v4, pinned Poli93 Go simulator and protobuf schemas, Vitest, Testing Library, Playwright. Use Node 24 with Trigger's `node-24` runtime; resolve compatible exact package patches at C1 and commit the lockfile. These are concrete planning defaults, not software already installed.

**Spec:** [Approved product specification](../specs/2026-09-08-wotlk-droptimizer-design.md).

**Design dependency:** [Paper implementation plan](2026-09-08-paper-design.md), especially D8. References below are stable design keys that D8 maps to real Paper nodes. Revision 4 handoff now exists at `docs/design/handoff.md`, with `screens.json`, `coverage.md`, `component-map.json`, exported screenshots and interaction contracts. It is a reviewed draft with approval still pending. Read `approval.json` at C0; the existence of these artifacts is not authorization to begin coding.

## Global constraints

- "All three are initially free and anonymous."
- "Free tools must remain usable without sign-in."
- "The first public release covers every DPS specialization supported by the pinned simulator."
- "Owned items retain their existing enhancements, including empty sockets and missing enchants."
- "Evaluate one new drop independently at a time. Never sum gains to predict a complete future set."
- "If candidate exploration discovers a better owned baseline, update and re-evaluate affected comparisons before final publication; provisional rankings are labeled provisional."
- "Every CPU-consuming work unit uses an explicit shared global simulation queue and concurrency cap."
- "A work budget interruption does not silently become a completed exhaustive search."
- Complete and refine the Paper design before all code tasks, including simulator/backend work. C0 is a read-only gate, not permission to bypass design approval.
- No billing integration, mandatory sign-in, new full addon, talent search, enhancement search, Armory, or multiple-future-drop optimization.
- Preserve existing repository documents. At code execution, use the worktree skill if isolation is needed; use `codex/` for a newly created branch.
- Use upstream commit `563e4a08cb15729f1fdcbcf68e6d68224553bfef` and exporter commit `e69635092425bf4beadca22570fc7b975a73c95e` as compatibility candidates. Record any justified pin change and rerun parity checks.

## Execution order and deliverable gates

| Stage | Tasks | Independently reviewable outcome |
| --- | --- | --- |
| Approved design | C0 | Exact design contract verified |
| Foundation | C1–C5 | App shell, normalized imports/presets, native CLI parity |
| Optimization | C6–C8 | Legal combinations, correct baselines, drop/token evaluation |
| Durable jobs | C9–C11 | Admission, bounded execution, recoverable reports |
| Product flows | C12–C14 | Functional approved UI for all three tools |
| Release evidence | C15 | All-spec parity, measured limits, accessibility and integration checks |

Each task contains a meaningful acceptance test. Follow red → minimal implementation → green for behavior; do not add tests that merely repeat static CSS or configuration. Commit each task after its checks. If a task's experiment disproves an integration assumption, update the affected plan contract before coding dependent tasks; do not silently change the product scope.

## File and module map

All paths are relative to the repository root. Tests sit beside pure modules or in `tests/integration` / `tests/e2e`. Generated upstream files are isolated from authored business logic.

| Path | Responsibility |
| --- | --- |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | Site shell, landing, approved theme |
| `src/app/top-gear/page.tsx`, `src/app/droptimizer/boss/page.tsx`, `src/app/droptimizer/raid/page.tsx` | Thin tool route compositions |
| `src/app/reports/[token]/page.tsx` | Read-only report and progress view |
| `src/features/shell/` | AppShell, CharacterSummary, tool navigation |
| `src/features/import/` | Export parsing, provenance, ImportPanel, persisted draft |
| `src/features/settings/` | Preset registry, category patching, PresetPanel |
| `src/features/inventory/` | Selection/locks, InventorySelector, RunSummary |
| `src/features/loot/` | Catalog queries, LootSelector, TokenOptions |
| `src/features/reports/` | Report projection, ResultList, EquipmentDiff, JobProgress |
| `src/domain/model.ts`, `src/domain/request-schema.ts` | Shared domain and validation contracts |
| `src/domain/equipment/` | Item legality, recipes, deterministic loadout enumeration |
| `src/domain/comparison/` | Baseline search, independent drop evaluation, uncertainty |
| `src/generated/wotlk/`, `data/wotlk/` | Versioned protobuf types, items, presets, acquisition catalog |
| `src/server/simulator/` | Canonical input, CLI subprocess, structured output |
| `src/server/jobs/`, `src/server/db/` | Admission, persistence, budget, outbox, report capabilities |
| `src/trigger/` | Coordinator, bounded simulation work, maintenance tasks |
| `tools/simulator/`, `tools/data/`, `scripts/` | Reproducible builds/data extraction and checks |
| `tests/fixtures/`, `tests/support/` | Mechanical fixtures and meaningful test infrastructure |
| `docs/engineering/` | Compatibility, catalog provenance, benchmarks, operations evidence |

Do not make a generic service layer with one file for the whole application. Keep serializers, rules, transport, and presentation separate. The specific files for each task follow.

## Shared types and APIs

C1 creates the domain types. C2 generates imported protobuf types and updates the TypeScript imports. A spec ID is a registry key, not an unrestricted promise that arbitrary specs work.

```ts
type Tool = 'top-gear' | 'boss' | 'raid';
type Slot = 'head' | 'neck' | 'shoulder' | 'back' | 'chest' | 'wrist'
  | 'hands' | 'waist' | 'legs' | 'feet' | 'finger1' | 'finger2'
  | 'trinket1' | 'trinket2' | 'mainHand' | 'offHand' | 'ranged';
type ItemInstance = {
  instanceId: string; itemId: number; enchantId: number; gemIds: number[];
  source: 'equipped' | 'bag' | 'drop'; equippedSlot?: Slot;
};
type Loadout = Partial<Record<Slot, ItemInstance>>;
type Diagnostic = {
  code: string; path: string; severity: 'error' | 'warning'; message: string;
};
type Provenance = Record<string, 'imported' | 'preset' | 'edited'>;
type VersionSet = {
  engine: string; schema: string; presets: string; catalog: string; optimizer: string;
};
type Metric = {mean: number; stdev: number; iterations: number};
type SimResult = {
  metric: Metric; stats: number[]; sets: string[]; inputHash: string;
  seed: string; loadout: Loadout;
};
type SearchBudget = {maxCombinations: number; maxIterations: number; maxSeconds: number};
type Coverage = {
  estimated: number; tested: number; exhaustive: boolean;
  termination: 'complete' | 'budget' | 'canceled';
};
type SearchResult = {best: SimResult; alternatives: SimResult[]; coverage: Coverage};
type AllowancePolicy = {version: string; maxUnits: number; unitsPerSet: number};
type AllowanceEstimate = {combinationCount: number; countKind: 'exact'|'upper-bound';
  usedUnits: number; maxUnits: number; overLimit: boolean};
type ResourceCount = {id: string; quantity: number | null};
type Acquisition = {
  id: string; sourceIds: string[]; reward: ItemInstance;
  consumesItems: Array<{itemId: number; quantity: number}>;
  consumesResources: Array<{id: string; quantity: number}>;
};
type EnhancementChoice = {itemId: number; enchantId: number; gemIds: number[]};
type JobStatus = 'pending' | 'queued' | 'baseline' | 'comparing' | 'refining'
  | 'complete' | 'partial' | 'failed' | 'canceled' | 'expired';
```

C2/C3 add `Snapshot` with `id`, `specId`, protobuf `player: Player`, `raid: Raid`, `encounter: Encounter`, `simOptions: SimOptions`, `inventory: ItemInstance[]`, `provenance: Provenance`, and `versions: VersionSet`. The raid contains the selected player in a documented fixed location; no arbitrary multi-player raid execution is accepted by the public API. UI raid buffs still apply through the canonical raid settings.

`ComparisonRequest` contains `snapshot: Snapshot`, `tool: Tool`, `selectedInstanceIds: string[]`, `locks: Partial<Record<Slot,string>>`, `acquisitionIds: string[]`, `resources: ResourceCount[]`, `enhancements: EnhancementChoice[]`, and `budget: SearchBudget`. The server resolves canonical acquisition data and budgets; client values never establish ownership of a paid entitlement or authoritative item stats.

`Evaluate = (loadout: Loadout, iterations: number, seed: string, signal: AbortSignal) => Promise<SimResult>`. A local CLI evaluator is used by integration tests; durable orchestration submits bounded work for the same contract. Domain search must not import Trigger.dev.

`DropEvaluation` is a discriminated union: `ready` includes `acquisitionId`, `best`, `gainDps`, `gainPct: number|null`, `effect: 'upgrade'|'tied'|'no-improvement'`, and `coverage`; `conditional` includes `acquisitionId`, `missing: string[]`, and an optional explicitly conditional result; `failed` includes `acquisitionId` and `errorCode`. A failure has no numeric gain.

## C0. Verify the approved Paper handoff

**Files:** Read `docs/design/approval.json`, `screens.json`, `tokens.css`, `interactions.md`, `handoff.md`; update `docs/engineering/design-consumption.md` only after approval exists.

**Interfaces:** Consumes D8 handoff. Produces a recorded approved revision and component/screen mapping for every UI task.

- [ ] Check the explicit final user approval and matching handoff revision. If pending, continue the Paper refinement plan and do not start C1 or backend work.
- [ ] Use Paper `get_guide`, open the exact handoff file, and read `get_basic_info`. Resolve screen keys from `screens.json`; never use the unrelated currently open file by accident.
- [ ] Read exact component JSX/styles/tokens via `get_jsx`, `get_computed_styles`, `get_tokens`, and relevant fill assets. Use screenshots for visual review only.
- [ ] Record the consumed revision and all UI task references; if a screen lacks approved state behavior, resolve that design gap before implementing it.

Acceptance: approved status and real matching Paper references exist; no guessed design assets or nodes. This task needs no automated test.

## C1. Establish the application and public shell

**Files:** Create `package.json`, `pnpm-lock.yaml`, `.node-version`, `README.md`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `src/domain/model.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/features/shell/AppShell.tsx`, `tests/setup.ts`, `tests/e2e/navigation.spec.ts`.

**Design:** HOME.desktop, COMPONENTS; use D8 token values.

**Interfaces:** Produces route shell and shared types above. AppShell accepts `{children: React.ReactNode, activeTool?: Tool}`; it never requires a session.

- [ ] Initialize dependencies after checking exact compatible stable releases: Next 16, React 19, Tailwind 4, Zod 4, Drizzle, pg, Trigger 4; use exact versions and a committed pnpm lockfile. Add Vitest/Testing Library/Playwright/ESLint/TypeScript and `tsx`. Pin the pnpm package-manager version used. Record runtime choices in `.node-version` and README.
- [ ] Add scripts `dev: next dev`, `build: next build`, `start: next start`, `lint: eslint .`, `typecheck: tsc --noEmit`, `test: vitest run`, and `test:e2e: playwright test`. Configure `@/*` to `src/*`; exclude reference JSX under `docs/design/exports` from compilation. Configure jsdom for component tests, Node for domain/integration tests, and `tests/setup.ts` with Testing Library cleanup and jest-dom matchers. Keep Playwright files outside Vitest discovery.
- [ ] Write the navigation acceptance test before route implementation:

```ts
import {test, expect} from '@playwright/test';
test('public tools are discoverable without signing in', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('link', {name:'Top Gear', exact:true})).toBeVisible();
  await expect(page.getByRole('link', {name:'Boss Droptimizer', exact:true})).toBeVisible();
  await expect(page.getByRole('link', {name:'Raid Droptimizer', exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:/sign in to continue/i})).toHaveCount(0);
});
```

- [ ] Run `pnpm exec playwright test tests/e2e/navigation.spec.ts`; expect missing public navigation until implemented. Configure Playwright to start `pnpm dev` locally.
- [ ] Implement the approved shell, accessible navigation, landing copy, and token import. Translate exported JSX into reusable React; do not paste whole artboards as one component.
- [ ] Run the navigation test, `pnpm typecheck`, `pnpm lint`, and `pnpm build`; expect success. Commit `feat: add approved public application shell`.

## C2. Build a reproducible simulator and detailed CLI adapter

**Files:** Create `tools/simulator/source.lock.json`, `tools/simulator/build.sh`, `tools/simulator/overlay/json_sim.go`, `tools/simulator/overlay/json_sim_test.go`, `tools/data/generate.ts`, `src/generated/wotlk/`, `data/wotlk/versions.json`, `src/server/simulator/cli.ts`, `src/server/simulator/canonical.ts`, `tests/integration/cli.test.ts`, `tests/fixtures/builders.ts`, `tests/fixtures/sim/`, `docs/engineering/simulator-compatibility.md`.

**Interfaces:** `runCli(input: RaidSimRequest, options: {binary:string; signal:AbortSignal; maxSeconds:number}): Promise<{raidResult: RaidSimResult; statsResult: ComputeStatsResult}>`; `canonicalHash(input: unknown): string`. Generated protobuf types come from the pinned source. `makeRequest(overrides?: Partial<ComparisonRequest>): ComparisonRequest` in test builders loads the checked-in smallest valid fixture then applies top-level overrides; `fakeResult(loadout:Loadout, mean:number, iterations?:number): SimResult` creates deterministic test-only output with stdev 0 and iterations default 1000.

- [ ] Fetch the exact upstream commit into ignored `.cache/wotlk`, verify HEAD, and record the Go/protoc/plugin versions used. Upstream declares Go 1.23.0/toolchain 1.23.4; use a supported compatible toolchain and record the exact build environment. Generate Go and TypeScript protobuf output and reuse the pinned database assets. Do not run the full upstream web-server build just to obtain a CLI.
- [ ] Preserve original `sim` and `bulk` commands. Add a thin `json-sim` command in an overlay copied into `cmd/wowsimcli/cmd` during build. Register it using `rootCmd.AddCommand` from `init`. It accepts `--infile` and `--outfile`, returns structured JSON for DPS and final stats, and does not alter combat mechanics.

```go
func evaluate(request *proto.RaidSimRequest) ([]byte, error) {
    result := core.RunRaidSim(request)
    if result.ErrorResult != "" { return nil, fmt.Errorf("simulation: %s", result.ErrorResult) }
    stats := core.ComputeStats(&proto.ComputeStatsRequest{Raid: request.Raid, Encounter: request.Encounter})
    if stats.ErrorResult != "" { return nil, fmt.Errorf("stats: %s", stats.ErrorResult) }
    simJSON, err := protojson.Marshal(result)
    if err != nil { return nil, err }
    statsJSON, err := protojson.Marshal(stats)
    if err != nil { return nil, err }
    return json.Marshal(struct {
        Raid json.RawMessage `json:"raidResult"`
        Stats json.RawMessage `json:"statsResult"`
    }{simJSON, statsJSON})
}
```

- [ ] Write a Go test using one real fixture to compare `evaluate`'s raid result with `core.RunRaidSim` under the same seed, using independent protobuf clones of the request. Add malformed input and nonempty engine-error cases. Run focused Go tests before adding the command; expect missing adapter symbol first, then exact deterministic parity.
- [ ] Build both local-native and Linux amd64 artifacts with `-tags=with_db`, keeping binaries out of git. The core build command in the prepared checkout is `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -tags=with_db -o dist/wowsimcli ./cmd/wowsimcli`; verify target compatibility with Trigger's actual machine before deployment. Copy the Linux artifact to repository-root `dist/simulator/wowsimcli` for C10, and the separately built host artifact to `dist/simulator/local/wowsimcli` for local tests. Set `SIM_BINARY` to the appropriate absolute path. Preserve license notices.
- [ ] Implement `runCli` with `spawn(binary, ['json-sim','--infile',inputPath,'--outfile',outputPath], {shell:false})`, private temporary directory, restricted file permissions, bounded stdout/stderr, timeout, signal-driven SIGTERM then SIGKILL, and cleanup in `finally`. Detect exit code, invalid JSON, engine error, and missing player result separately. Keep raw exports out of errors sent to clients.
- [ ] Assert canonical hashes ignore object key ordering but preserve array/slot order and all mechanical values. Reject nonfinite numbers before hashing. Hash the seed, iteration count, and versions with the request.
- [ ] Run original `sim --infile ... --outfile ...` and `json-sim` on the same stored fixture and seed; compare original and wrapped DPS distribution and record proof. Add scripts `sim:build: bash tools/simulator/build.sh`, `data:generate: tsx tools/data/generate.ts`, and `test:sim: vitest run tests/integration/cli.test.ts`; load the configured local `SIM_BINARY` in integration setup.
- [ ] Run `pnpm sim:build`, `pnpm data:generate`, and `pnpm test:sim`. Expect real native execution and structured stats, not stubbed DPS. Commit `feat: integrate pinned simulator CLI with structured results`.

**Revision 3 dependency for C2/C13/C14:** Follow `docs/design/wowhead-item-assets.md` for icon metadata, CDN images, optional Wowhead tooltips, and graceful failure. Add `data/wotlk/item-icons.json`, an optional bounded metadata enrichment step in `tools/data/`, and an accessible `ItemIcon`/item-details component. Use expansion + item ID for artwork lookup, never as a replacement for item-instance identity. The simulator catalog remains authoritative for mechanics. Verify image failure, duplicate enhancement variants, focus/tap details, and blocked external script behavior. No per-row runtime metadata fetching. Do not treat the observed JSON endpoint as a guaranteed public API.

**Revision 3 visual contract for C13/C14:** Use the latest approved descendants of the compact Paper direction screens: one-line gear selection, small character/preset/allowance panel, full-width report, 17-slot set preview, and compact ranked complete-set rows with changed-slot icon labels. Row selection updates the preview; exact DPS ranking and original gain reference remain unchanged. Details/menus carry long descriptions. Raid results retain item/boss/gain columns and expandable swaps. Reference `docs/design/exports/CombinationRow.reference.tsx` and `ResultRow.reference.tsx` only as draft Paper exports until D8 approves the design.

## C3. Normalize exports without losing inventory data

**Files:** Create `src/features/import/parse-export.ts`, `src/features/import/profile-link.ts`, `src/features/import/normalize.ts`, `src/features/import/parse-export.test.ts`, `src/domain/request-schema.ts`, `tests/fixtures/import/`.

**Interfaces:** `parseExport(text:string, kind:'character'|'bags'|'profile'): ImportDraft`; `decodeProfileLink(url:string): IndividualSimSettings`. `ImportDraft` contains `player: Partial<Player>`, `inventory: ItemInstance[]`, optional `settings: IndividualSimSettings`, `providedPaths:string[]`, `diagnostics:Diagnostic[]`. `applyBagImport(snapshot:Snapshot, items:ItemInstance[]): Snapshot` replaces only bag-origin records. Domain schema validates requests after C4 fills required settings.

- [ ] Capture fixtures from the pinned exporter source and user-provided in-game output when available. Preserve complete outputs, replace personal display identifiers, and record source/version/locale. Source-derived fixtures are not proof of in-game behavior.
- [ ] Write this regression test using minimal bag data, plus character fixtures for glyph/talent/profession mapping:

```ts
it('preserves copies and empty enhancement state without duplicating a repaste', () => {
  const draft = parseExport('{"items":[{"id":100,"enchant":0,"gems":[0]},{"id":100,"enchant":9,"gems":[7]}]}','bags');
  expect(draft.inventory).toHaveLength(2);
  expect(draft.inventory.map(x => x.enchantId)).toEqual([0,9]);
  const once = applyBagImport(makeRequest().snapshot, draft.inventory);
  const twice = applyBagImport(once, draft.inventory);
  expect(twice.inventory).toEqual(once.inventory);
});
```

- [ ] Run `pnpm test src/features/import/parse-export.test.ts`; expect missing parser initially. Implement source occurrence-based instance identity, numeric-ID parsing, preserved zeroes, explicit field provenance, and replacement semantics. Catalog validation runs separately so parser tests can use synthetic IDs.
- [ ] Parse simulator JSON and profile links locally; limit compressed/decompressed bytes and nesting, use upstream protobuf/category semantics, and reject foreign hosts/unsupported formats without server-side fetching. Respect category selection on shared profiles and retain unknown supported fields only where the pinned schema accepts them.
- [ ] Add tests for malformed JSON, level/expansion mismatch, bag-only data in a character field, localized/unknown glyph names, duplicate entries, empty sockets, and invalid equipped IDs. Detect unsupported catalog entries without silently deleting them.
- [ ] Run parser tests and typecheck; expect all preservation/rejection assertions to pass. Commit `feat: preserve character and bag export data`.

## C4. Reuse all supported-spec defaults and presets

**Files:** Create `tools/data/extract-presets.ts`, `data/wotlk/specs.json`, `data/wotlk/presets.json`, `src/features/settings/presets.ts`, `src/features/settings/resolve.ts`, `src/features/settings/resolve.test.ts`, `src/features/settings/registry.test.ts`, `docs/engineering/spec-coverage.md`.

**Interfaces:** `listPresets(specId:string): Preset[]`; `resolveSnapshot(draft:ImportDraft, presetId:string): {snapshot:Snapshot; diagnostics:Diagnostic[]}`; `applySettingsPatch(snapshot:Snapshot, category:SettingsCategory, patch:unknown): Snapshot`. Define `SettingsCategory = 'talents'|'rotation'|'consumes'|'external'|'encounter'|'specOptions'`; `Preset` contains `id`, `specId`, `name`, `category`, and typed protobuf-compatible `value`.

- [ ] Enumerate every DPS specialization/variant in the pinned upstream registry and its presets, including variants sharing a simulator module. Build a manifest with exact adapter/default/rotation mappings and corresponding fixture paths. Exclude healing/survival-only simulators explicitly.
- [ ] Extract static presets and automatic rotation-resolution logic without loading a browser DOM in the worker. Reuse upstream logic where possible; when adaptation is needed, create per-spec golden tests for the adapted resolver, including gear-dependent auto rotations.
- [ ] Test import precedence and category isolation:

```ts
it('changes encounter only and retains owned enhancements', () => {
  const before = makeRequest().snapshot;
  const after = applySettingsPatch(before,'encounter',{duration:180});
  expect(after.encounter.duration).toBe(180);
  expect(after.inventory).toEqual(before.inventory);
  expect(after.player.talentsString).toBe(before.player.talentsString);
  expect(after.player.profession1).toBe(before.player.profession1);
});
```

- [ ] Run `pnpm test src/features/settings`; implement explicit missing-field/default resolution, imported/preset/edited provenance, and compatible preset filtering. Never apply preset gear to inventory or silently override supplied false/zero values.
- [ ] Add a registry test requiring every advertised spec to have at least one valid preset and executable simulation fixture. Ambiguous spec or missing essential data remains a submission error, not a guessed build.
- [ ] Run generation plus settings tests; commit `feat: provide versioned presets for every supported DPS spec`.

## C5. Assemble and validate complete simulation inputs

**Files:** Create `src/server/simulator/input.ts`, `src/server/simulator/input.test.ts`, `src/server/simulator/result.ts`, `src/server/simulator/result.test.ts`; update C2 integration fixtures.

**Interfaces:** `toSimRequest(snapshot:Snapshot, loadout:Loadout, iterations:number, seed:string): RaidSimRequest`; `readSimResult(output, loadout:Loadout, inputHash:string, seed:string, iterations:number): SimResult`, where `output` is the `runCli` return type. These functions power `Evaluate`.

- [ ] Write a test assembling the same fixture in two gear variants; assert buffs, glyphs, talents, consumes, encounter, and rotation configuration are unchanged and only intended equipment differs. Treat a configured auto-rotation policy as fixed even when upstream resolves its actions from gear.
- [ ] Write result tests for mean/stdev/iteration accounting, pets included exactly once through upstream player metrics, invalid/absent actor output, and nonfinite values. Use original simulator fixture results as truth, not manually summed ability damage.
- [ ] Implement exact protobuf slot mapping (including ranged/relic slot), one-player raid assembly, actor indexing, and generated-schema validation before CLI invocation. Use exported buffs and defaults; do not turn all raid buffs on independently of preset choices.
- [ ] Connect the native evaluator and run fixture parity:

```ts
const input = toSimRequest(snapshot, loadout, 1000, '1001');
const raw = await runCli(input, {binary, signal, maxSeconds:60});
const result = readSimResult(raw, loadout, canonicalHash(input), '1001', 1000);
expect(result.metric.mean).toBeGreaterThan(0);
expect(result.stats.every(Number.isFinite)).toBe(true);
```

Here `snapshot`/`loadout` come from `makeRequest()`, `binary` from `SIM_BINARY`, and `signal` from a test AbortController; no real-server work is scheduled by this test.

- [ ] Run `pnpm test src/server/simulator` and `pnpm test:sim`; commit `feat: validate complete simulation configurations`.

## C6. Generate legal owned-equipment combinations

**Files:** Create `src/domain/equipment/catalog.ts`, `src/domain/equipment/validate.ts`, `src/domain/equipment/enumerate.ts`, `src/domain/equipment/enumerate.test.ts`, `src/domain/equipment/enhancements.ts`, `src/domain/equipment/enhancements.test.ts`; extend test builders.

**Interfaces:** `RuleContext` contains `snapshot`, selected instances, locks, and validated item catalog; `validateLoadout(loadout:Loadout, context:RuleContext): Diagnostic[]`; `enumerateLoadouts(context:RuleContext): Generator<Loadout>`; `estimateCombinations(context:RuleContext): number` is a safe upper bound; `applyEnhancements(item:ItemInstance, choice:EnhancementChoice): ItemInstance`. `makeRuleContext(items:ItemInstance[], overrides?:Partial<RuleContext>):RuleContext` in test builders starts with a complete valid equipped fixture, adds supplied candidates, and uses explicit synthetic catalog entries (item 100 is a ring in the quantity test). Each test sets the specific rules it exercises.

- [ ] Add tests for a single ring instance never occupying both slots, two legitimate identical copies where legal, distinct gem/enchant copies, unique-equipped categories, item locks, empty legal off-hand, dual-wield two-hand rules, profession sockets, and meta activation. Include lower armor types that the class can equip.

```ts
it('never equips one owned copy twice', () => {
  const ring: ItemInstance = {instanceId:'ring-a',itemId:100,enchantId:0,
    gemIds:[],source:'bag'};
  const context = makeRuleContext([ring]);
  const loadouts = [...enumerateLoadouts(context)];
  expect(loadouts.length).toBeGreaterThan(0);
  for (const loadout of loadouts) {
    const ids = Object.values(loadout).map(x => x.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  }
});
```

- [ ] Run focused equipment tests; implement a deterministic lazy backtracking enumerator over actual slots and item instances. Reject reuse of an instance and invalid partial combinations early. Keep original enhancement configuration attached to the instance.
- [ ] Retain paired-slot permutations where effects may depend on position. Deduplicate only proven-equivalent full mechanical inputs, not item names or unordered ID lists.
- [ ] Separate legal-but-inactive set/meta effects from illegal equipment. Use canonical stats evaluation for effects; do not suppress a legal combination merely because it falls below hit/expertise caps.
- [ ] Test `applyEnhancements` applies exactly the selected new-loot configuration and rejects impossible socket/enchant/profession choices. It is never applied to owned instances automatically.
- [ ] Validate a small fixture with a manually enumerated exact set of legal loadouts, including assertions that at least one legal result exists in the quantity test. Check count estimates cannot understate actual generated work.
- [ ] Run `pnpm test src/domain/equipment`; commit `feat: enumerate valid owned equipment combinations`.

## C7. Implement budgeted optimization and honest uncertainty

**Files:** Create `src/domain/comparison/search.ts`, `src/domain/comparison/statistics.ts`, `src/domain/comparison/search.test.ts`, `src/domain/comparison/statistics.test.ts`, `src/domain/comparison/cache-key.ts`, `src/domain/comparison/cache-key.test.ts`.

**Interfaces:** `optimizeOwned(request:ComparisonRequest, evaluate:Evaluate, signal:AbortSignal): Promise<SearchResult>`; `compareMetrics(candidate:Metric, baseline:Metric): {delta:number; percent:number|null; indistinguishable:boolean}`; `simulationKey(versions:VersionSet, input:RaidSimRequest):string`. Export `planStage(loadouts:Loadout[], stage:number, budget:SearchBudget)` and `selectSurvivors(results:SimResult[]):SimResult[]` for orchestration; their outputs are finite sets of loadout/iteration/seed work, never Trigger tasks. `SearchResult.alternatives` holds complete distinct loadouts, not isolated item gains. Persist all evaluated work results with stage/iteration metadata; return paginated ranked projections rather than discarding everything except the winner.

- [ ] Define deterministic synthetic evaluator fixtures with two individually weak items that jointly outperform the baseline. Test full-combination search finds the pair; this catches greedy one-slot search that would miss it.
- [ ] Test known optimum, all-equivalent results, budget stop, cancellation, and stable baseline retention. Record explicit estimated/tested counts and coverage; a partial search cannot return exhaustive true.
- [ ] Add a six-loadout fixture that returns all six distinct complete sets, including equipped, ordered by exact DPS. Test a near-tied second set with fewer swaps changes the recommendation only, never numerical ranking. Retain a configured number of leading alternatives through refinement, not solely statistically plausible winners; distinguish less-refined results and report truncation/pagination. Include alternative refinement in actual work budgets.
- [ ] Implement full lazy enumeration for admitted small inventories and staged direct simulations for larger admitted inventories. Run a coarse stage for all accepted candidates, retain statistically plausible contenders plus baseline, refine survivors within budget, and finish with fresh independent-seed validation of finalists. Do not prune using item level or static stat weights.
- [ ] Use Welford/pooled variance for merging disjoint batches when necessary; never average standard deviations. Distinct stages/seeds are not double-counted as additional independent samples. Record the final iteration counts used for uncertainty.
- [ ] Implement uncertainty for independent validation means:

```ts
export function compareMetrics(a:Metric, b:Metric) {
  const delta = a.mean - b.mean;
  const se = Math.sqrt(a.stdev ** 2 / a.iterations + b.stdev ** 2 / b.iterations);
  return {delta, percent:b.mean === 0 ? null : 100 * delta / b.mean,
    indistinguishable:Math.abs(delta) <= 1.96 * se};
}
```

Reject invalid iteration counts/nonfinite input. This is a pairwise uncertainty indicator, not a guarantee after selecting the maximum among thousands of candidates. Do not use it for correlated paired-seed outputs without a paired-difference calculation.

```ts
it('uses uncertainty of the mean and handles zero baseline', () => {
  expect(compareMetrics({mean:10001,stdev:100,iterations:1000},
    {mean:10000,stdev:100,iterations:1000}).indistinguishable).toBe(true);
  expect(compareMetrics({mean:1,stdev:0,iterations:100},
    {mean:0,stdev:0,iterations:100}).percent).toBeNull();
});
```

- [ ] Add hash tests changing one enchant, a trinket position, encounter duration, seed, precision, or engine version; each invalidates reuse. A display name change may reuse the internal simulation but not the owner's report.
- [ ] Run `pnpm test src/domain/comparison`; commit `feat: optimize owned gear with bounded refinement`.

## C8. Build audited loot catalogs and independent acquisition comparisons

**Files:** Create `tools/data/extract-loot.ts`, `data/wotlk/raids.json`, `data/wotlk/acquisitions.json`, `src/features/loot/catalog.ts`, `src/features/loot/catalog.test.ts`, `src/domain/equipment/redeem.ts`, `src/domain/equipment/redeem.test.ts`, `src/domain/comparison/drop.ts`, `src/domain/comparison/drop.test.ts`, `docs/engineering/loot-provenance.md`; extend test builders.

**Interfaces:** `listAcquisitions({raidId,difficultyId,bossId?,specId}): Acquisition[]`; `redeem(acquisition:Acquisition, inventory:ItemInstance[], resources:ResourceCount[]): {kind:'ready'; branches:Array<{inventory:ItemInstance[]; consumedInstanceIds:string[]}>}|{kind:'conditional'; missing:string[]}`; `evaluateDrop(request:ComparisonRequest, baseline:SearchResult, acquisition:Acquisition, evaluate:Evaluate, signal:AbortSignal):Promise<DropEvaluation>`. Each ready branch represents a distinct feasible choice of prerequisite copies. Test helper `makeAcquisition(overrides?:Partial<Acquisition>)` creates one synthetic eligible reward with no consumption by default.

- [ ] Extract upstream source metadata and audit raid mappings against primary/maintainer sources. Catalog raid coverage explicitly for Naxxramas, Obsidian Sanctum, Eye of Eternity, Ulduar, Trial of the Crusader, Onyxia's Lair, Icecrown Citadel, Ruby Sanctum, and Vault of Archavon wherever supported in the pinned data. Record actual supported sizes, difficulties/hard modes, faction variants, trash drops, and token recipes rather than assuming every raid offers the same modes.
- [ ] Validate no advertised boss/difficulty lacks a reviewed complete loot list. Unreviewed combinations stay unavailable; report exact coverage at launch. Item presence alone is not source evidence.
- [ ] Test consumption: insufficient currency is conditional, unknown is not owned, eligible class matters, one recipe consumes its prerequisite item, and alternative token redemptions never grant each other. Enumerate eligible prerequisite-copy choices when copies have different enhancements so consumption does not arbitrarily destroy the best remaining option.
- [ ] Implement recipes as explicit inventory transformations and retain source associations when identical reward simulations are deduplicated. A token reward is not merely appended while its consumed precursor remains usable.
- [ ] Test attribution with owned baseline mean 10,200 and drop outcome 10,350:

```ts
it('attributes only the drop gain over optimized owned gear', async () => {
  const request = makeRequest();
  const baseline = {best:fakeResult({},10200), alternatives:[],
    coverage:{estimated:1,tested:1,exhaustive:true,termination:'complete' as const}};
  const result = await evaluateDrop(request,baseline,makeAcquisition(),
    async loadout => fakeResult(loadout,10350),new AbortController().signal);
  expect(result.kind).toBe('ready');
  if (result.kind === 'ready') expect(result.gainDps).toBe(150);
});
```

- [ ] Add a regression fixture where a drop only improves DPS with an owned hit item swapped in. Add tests proving each acquisition sees only its own new reward, failed simulation is not zero gain, optional acquisition can retain the baseline, and baseline improvements trigger re-evaluation of affected drop outcomes.
- [ ] Implement drop comparisons by transforming inventory for each recipe branch, applying its chosen enhancements, optimizing under the same constraints, and comparing with the shared baseline. Group token rows by best feasible redemption; keep conditional outcomes separate. Never sum gains or fabricate loot probabilities.
- [ ] Run catalog, redemption, and drop tests plus one real-CLI end-to-end fixture; commit `feat: compare boss raid and tier acquisitions`.

## C9. Persist anonymous jobs with atomic budgets and idempotent admission

**Files:** Create `src/server/db/client.ts`, `src/server/db/schema.ts`, `drizzle.config.ts`, `drizzle/0000_jobs.sql`, `compose.yaml`, `src/server/jobs/policy.ts`, `src/server/jobs/admit.ts`, `src/server/jobs/repository.ts`, `src/server/jobs/capabilities.ts`, `tests/support/db.ts`, `tests/integration/admission.test.ts`.

**Interfaces:** `admitJob({request,ownerKey,idempotencyKey}):Promise<Admission>` where `Admission` is `{kind:'accepted';jobId:string;reportToken:string}` or `{kind:'denied';code:'invalid'|'quota'|'capacity'|'entitlement';retryAfterSeconds?:number}`. `accessFor(tool:Tool, principal:{paid:boolean}, raidPaid:boolean):boolean`; `getReport(token:string):Promise<Report|null>`; `cancelJob(jobId:string,ownerKey:string):Promise<boolean>`. `Report` contains id, tool, status, snapshot version summary, reference result, result rows, coverage, and expiry. A read token never reveals raw exports, owner credentials, or database IDs usable for management.

- [ ] Create local PostgreSQL through compose and configure a separate test database. Store snapshots, jobs, work units, internal simulation cache, report projections, admission budgets, and an outbox. JSONB holds validated versioned snapshots/results; indexed typed columns hold ownership, state, version, expiry, and idempotency fields.
- [ ] Define unique `(owner_key,idempotency_key)` admission and `(job_id,work_key)` work constraints. Store hashed report/owner capabilities and use crypto-random tokens. Retain the original admission response in an encrypted envelope for the idempotency window so concurrent/retried requests receive the same report token without storing plaintext capabilities. Keep encryption keys in server configuration. Keep the anonymous owner in a same-site HttpOnly cookie; changing a report URL must not grant management rights.
- [ ] Create `withTestDb(fn)` in `tests/support/db.ts` to reset only the dedicated test schema, run the callback, and clean up. Provide `seedBudget({units:number})` and `countJobs()` helpers scoped to that test schema.
- [ ] Test concurrent repeated submissions:

```ts
it('reserves work once for concurrent duplicate submissions', async () => {
  await withTestDb(async () => {
    await seedBudget({units:1000});
    const input = {request:makeRequest(),ownerKey:'test-owner',idempotencyKey:'same'};
    const results = await Promise.all([admitJob(input),admitJob(input)]);
    expect(results[0]).toEqual(results[1]);
    expect(await countJobs()).toBe(1);
  });
});
```

- [ ] Run integration tests against PostgreSQL, not a mocked transaction. Implement serializable/locked-row budget reservation with bounded serialization retries, uniqueness-safe idempotency, and one transactional outbox event alongside the job. Never call Trigger.dev inside a DB transaction.
- [ ] Enforce server-owned search ceilings, payload limits, version/schema validation, anonymous session/IP limits, global outstanding-work cap, queue TTL, and configured total budget. Use safe combinatorial bounds for synchronous admission; exhaustive generation occurs in workers. Missing production limits deny new jobs.
- [ ] Add `src/domain/comparison/allowance.ts` and `allowance.test.ts` with `estimateAllowance(combinationCount:number, countKind:AllowanceEstimate['countKind'], policy:AllowancePolicy):AllowanceEstimate`. Use overflow-safe arithmetic. For the provisional fixture policy (300,000 units, 5,000 per set), assert 60 sets are accepted, 61 denied, and a client-supplied cheaper policy cannot alter admission. The server counts/deduplicates canonical loadouts, includes a separate equipped reference once, and resolves policy/precision itself. An upper-bound estimate is labeled and can conservatively require narrower selection; never claim it is an exact count. Allowance units are distinct from actual iteration limits in SearchBudget. Persist the resolved policy version with the job.
- [ ] Implement launch access `!raidPaid || tool !== 'raid' || principal.paid`; test all launch tools allow anonymous and future raid-paid denies before job/outbox insertion. Derive `raidPaid` from server configuration, never a request property. No checkout/account UI is added.
- [ ] Test different owners cannot cancel each other's jobs, two separate requests cannot overspend the same budget, unknown report tokens return not found, and expired tokens return an explicit expired projection. Commit `feat: admit anonymous simulation jobs safely and durably`.

## C10. Run bounded, resumable work on Trigger.dev

**Files:** Create `trigger.config.ts`, `src/trigger/queues.ts`, `src/trigger/coordinate.ts`, `src/trigger/simulate.ts`, `src/trigger/maintenance.ts`, `src/server/jobs/dispatch.ts`, `src/server/jobs/work.ts`, `src/server/jobs/runtime-limits.ts`, `tests/integration/orchestration.test.ts`, `docs/engineering/trigger-validation.md`.

**Interfaces:** `dispatchPendingJobs():Promise<number>` leases outbox events; `coordinateJob(jobId:string):Promise<void>` runs pure search stages over durable work; `executeWork(workId:string,signal:AbortSignal):Promise<void>` executes a finite stage chunk; `reserveWork(jobId:string,workKey:string):Promise<'run'|'cached'|'complete'>`; `reconcileJobs():Promise<void>` handles stranded/expired work. Task payloads carry IDs, not raw export data.

- [ ] Read current Trigger.dev schemas/docs and pin SDK/build/CLI to compatible exact versions. Register one shared CPU queue and ensure every baseline, comparison, refinement, and expensive candidate-generation task explicitly uses it.

```ts
import {queue} from '@trigger.dev/sdk';
import {limits} from '@/server/jobs/runtime-limits';
export const simulationQueue = queue({
  name:'wotlk-simulation', concurrencyLimit:limits.simConcurrency,
});
```

`limits` must validate explicit positive configuration and expose `simConcurrency`, `maxSeconds`, `maxAttempts`, `queueTtlSeconds`, `chunkCombinations`, and `maxOutstandingWork`. Start local/test configuration with concurrency 2, one CLI subprocess per work task, maxAttempts 2, and finite sample budgets; production numbers are set by C15 measurements.

- [ ] Bundle `dist/simulator/wowsimcli` and version metadata with Trigger's `additionalFiles` extension. Use `runtime:'node-24'`, configured machine, maxDuration and TTL. Read `TRIGGER_PROJECT_REF` from validated environment. Match `GOMAXPROCS` to allocated CPU and bound per-task memory; a batch task may process a finite chunk sequentially, not launch unbounded subprocesses.
- [ ] Implement outbox dispatch with an expiring database lease, Trigger idempotency key derived from job/work ID and revision, and persisted run IDs. Recover from a crash after Trigger accepts work but before the DB records delivery. Provider idempotency is additional protection; durable work identity is the authority.
- [ ] Use bounded stage tasks: generate candidate chunks on the CPU queue, evaluate them, persist successes, then select refinement work. A coordinator awaits stages on its own low-cost queue and never performs unbounded CPU work. Do not hold a simulation-queue slot while waiting for child simulation tasks.
- [ ] Write orchestration tests where the adapter fails one candidate once and another succeeds. Assert the successful work is reused, retry count is bounded, duplicate task delivery cannot double-count usage, and cancellation prevents new subprocess launches. Repository claims use expiring leases so a crashed worker does not lock work forever.
- [ ] Make cancellation durable: mark cancel intent, cancel recorded Trigger runs, check the flag between chunks, and terminate live subprocesses through task cancellation/AbortSignal. Test the actual Trigger cancellation behavior in its development environment; do not assume killing the JS task also kills its child process.
- [ ] Add reconciliation for stranded outbox rows, leases, expired queued jobs, exhausted retries, budget settlement, and report expiration. Schedule the maintenance task through Trigger.dev project schedules, not a Codex automation.
- [ ] Deploy only to a configured development/staging Trigger project for validation when that environment is available. Queue multiple tiny jobs across all tool types and verify observed concurrent CPU work never exceeds the configured global cap. Record native-binary compatibility, child-queue behavior, cold start, retry, and cancellation evidence.
- [ ] Run `pnpm test tests/integration/orchestration.test.ts`, `pnpm exec trigger.dev@4 dev`, and the bounded staging validation. Commit `feat: execute resumable simulations through Trigger.dev`.

## C11. Project immutable reports and expose job APIs

**Files:** Create `src/features/reports/project.ts`, `src/features/reports/project.test.ts`, `src/server/jobs/finalize.ts`, `src/app/api/jobs/route.ts`, `src/app/api/jobs/[id]/cancel/route.ts`, `src/app/api/reports/[token]/route.ts`, `src/app/api/catalog/route.ts`, `tests/integration/report-api.test.ts`.

**Interfaces:** `projectReport(job,baseline,rows):Report`; `finalizeJob(jobId:string):Promise<Report>`. Route contracts: POST `/api/jobs` takes validated request plus an `Idempotency-Key` header and returns 202 with report URL; GET `/api/reports/:token` returns an authorized read projection; POST `/api/jobs/:id/cancel` checks owner cookie and request origin; GET `/api/catalog` returns public versioned choices.

- [ ] Test report projection never attributes current→owned gain to a drop, never returns failed rows as zero, shows percent null for zero reference DPS, and preserves the exact snapshot/version/coverage used.
- [ ] Implement Top Gear reference C and drop reference B, conditional token grouping, no-improvement and near-tie labels, required swaps, resource consumption, and complete resulting loadouts. Compute hit/expertise context through validated rules/stat fields; when an effect cannot be established, omit a numeric cap claim and show the measured stat instead.
- [ ] Define a Top Gear projection containing ranked combination IDs, complete loadouts, exact DPS, delta from C, swap counts, refinement/uncertainty metadata, equipped/highest/recommended IDs, and evaluated/refined/displayed counts. Paginate persisted combinations. Test equipped/top-set gear-diff toggles do not change delta-from-C values, and fewer-changes preference does not reorder numeric rankings. Preserve the original owned inventory when a user explicitly reuses a selected loadout as a new reference snapshot.
- [ ] Finalize only after baseline and dependent work states are settled. If a better owned baseline is discovered, invalidate stale deltas, persist its revision, and recalculate candidates before final publication. Partial reports list all failed/unresolved acquisitions; retries update job progress while retaining prior work. Completed report snapshots are immutable.
- [ ] Implement routes with payload-size ceilings and server validation. Return 400 malformed, 403 future entitlement denial, 429 budget/rate limit with retry information where known, 503 unavailable admission, 404 unknown report, and 410 expired report. Retry a failed comparison through a new admitted retry request referencing the same snapshot and reusable work.
- [ ] Start with client polling of our report endpoint at a bounded interval (2 seconds while visible, exponential backoff on failures, pause while hidden); this avoids making report availability depend on third-party realtime connection quotas. Trigger progress remains persisted in our DB. Stop polling terminal states.
- [ ] Verify report tokens have read-only scope, responses carry no owner secrets/raw exports, and publicly shared reports are marked noindex. Run `pnpm test tests/integration/report-api.test.ts`; commit `feat: publish durable simulation reports and APIs`.

## C12. Implement approved import and settings interactions

**Files:** Create `src/features/import/ImportPanel.tsx`, `src/features/import/ImportReview.tsx`, `src/features/import/draft-store.ts`, `src/features/import/ImportPanel.test.tsx`, `src/features/settings/PresetPanel.tsx`, `src/features/settings/PresetPanel.test.tsx`, `src/features/shell/CharacterSummary.tsx`.

**Design:** IMPORT.desktop/mobile, IMPORT-REVIEW.desktop/mobile, SETTINGS.desktop/mobile and D6 stress states. Read the exact approved Paper nodes at the start of this task.

**Interfaces:** `ImportPanel({onResolved:(snapshot:Snapshot)=>void})`; `PresetPanel({snapshot,onChange})`; `draft-store` exports `loadDraft():Snapshot|null`, `saveDraft(snapshot:Snapshot):void`, and `clearDraft():void`, using a versioned localStorage key and graceful quota/unavailable-storage handling.

- [ ] Write UI tests that paste character/bag fixtures, see preserved duplicate copies, acknowledge an unsupported bag exclusion, choose a preset without replacing talents, and display a malformed-export error beside its field.

```tsx
it('explains bad input without asking for an account', async () => {
  const user = userEvent.setup();
  render(<ImportPanel onResolved={vi.fn()}/>);
  await user.type(screen.getByLabelText('Character export'), 'invalid');
  await user.click(screen.getByRole('button',{name:'Import character'}));
  expect(await screen.findByRole('alert')).toHaveTextContent(/export/i);
  expect(screen.queryByText(/sign in to continue/i)).not.toBeInTheDocument();
});
```

Use Testing Library imports and labels from the final design; if D8 changed wording, update this test's accessible names to the approved copy while preserving its behavior.

- [ ] Run focused tests before implementing. Build semantic form controls, provenance labels, exact presets, field focus/error associations, and explicit reimport replacement behavior. Collapse input into CharacterSummary after a successful import.
- [ ] Persist anonymous drafts locally with source/schema/version. On outdated/corrupt storage, show recoverable import state and retain exportable raw user input where available; do not silently run incompatible settings. No network request is needed to switch local presets.
- [ ] Use approved font assets/tokens and responsive behavior. Verify at 1440, 768, 390, and 320px; inspect screenshots, keyboard navigation, and 200% text zoom. Tests must assess behavior, not exact internal component tree shape.
- [ ] Run UI tests plus `pnpm typecheck`; commit `feat: implement Paper import and settings experience`.

## C13. Implement owned-gear and loot selection routes

**Files:** Create `src/features/inventory/InventorySelector.tsx`, `src/features/inventory/RunSummary.tsx`, `src/features/inventory/selection.ts`, `src/features/inventory/selection.test.ts`, `src/features/loot/LootSelector.tsx`, `src/features/loot/TokenOptions.tsx`, `src/features/loot/LootSelector.test.tsx`, `src/features/shell/ToolWorkspace.tsx`, `tests/support/browser.ts`, `tests/e2e/tools.spec.ts`, and the three tool route pages listed in the file map.

**Design:** TG-SELECT, BOSS-SELECT, RAID-SELECT, TOKEN-OPTIONS in desktop/mobile variants.

**Interfaces:** `ToolWorkspace({tool:Tool})` manages a `ComparisonRequest` draft using the shared snapshot; selectors accept `{request,onChange}`; `RunSummary({request,estimate,submission})` displays reference/coverage/limits. `buildSubmission(request):ComparisonRequest` includes only explicit selection and server-resolvable IDs, never arbitrary loot definitions or paid flags.

- [ ] Test selection/locks preserve instance identity, tool switching retains the same snapshot/settings, new-loot enhancements never mutate owned items, and selecting a boss narrows acquisitions without changing encounter settings.
- [ ] Implement slot groups, select-all/clear, selected-only filtering, locks, paired-slot presentation, source badges, and quantity details from Paper. Display safe preliminary search estimates and require selection reduction when limits are exceeded.
- [ ] Implement the free allowance meter from TG-SELECT/TG-LIMIT, updating on selection, locks, and precision. Disable Run over the allowance and preserve the draft on authoritative server rejection. Test within-limit, exact-boundary, over-limit, and selection reduction restoring Run; test many items in one slot versus distributed slots to prove the limit concerns combinations rather than a flat item count. Do not add a premium checkout prompt.
- [ ] Implement versioned raid/size/difficulty/boss choices, item/boss grouping, complete versus partial coverage, eligible lower-armor items, and token-resource entry with unknown separate from zero. Conditional recipes remain outside immediate rankings.
- [ ] Add submission with one stable idempotency key per intent and a disabled in-flight button. For 429/503 preserve the draft and explain the retry state; for 202 navigate to the returned report URL. No sign-in wall appears for any launch tool.

```ts
test('boss source does not alter encounter settings', async ({page}) => {
  await page.goto('/droptimizer/boss');
  // This test loads the checked-in character/profile through the import UI.
  await importFixture(page, 'warrior-profile');
  await page.getByLabel('Fight length').fill('180');
  await page.getByLabel('Raid').selectOption({label:'Icecrown Citadel'});
  await page.getByLabel('Boss').selectOption({label:'Lord Marrowgar'});
  await expect(page.getByLabel('Fight length')).toHaveValue('180');
});
```

Create `importFixture(page:Page,key:string):Promise<void>` in `tests/support/browser.ts` to paste the fixture named by the C4 manifest and complete the actual import UI; it must not inject private React state. Use these raid labels only after C8 verifies their catalog entries.

- [ ] Review approved Paper states against browser screenshots and verify keyboard/mobile selection controls. Run focused component tests and `pnpm exec playwright test tests/e2e/tools.spec.ts` after adding the scenario above there. Commit `feat: implement all three comparison setup flows`.

## C14. Implement progress, rankings, and equipment diffs

**Files:** Create `src/features/reports/JobProgress.tsx`, `src/features/reports/ResultList.tsx`, `src/features/reports/EquipmentDiff.tsx`, `src/features/reports/use-report.ts`, `src/features/reports/ResultList.test.tsx`, `src/app/reports/[token]/page.tsx`, `tests/e2e/reports.spec.ts`.

**Design:** JOB, TG-RESULT, BOSS-RESULT, RAID-RESULT, DROP-DETAIL, every state in D5 and responsive treatment in D6.

**Interfaces:** `JobProgress({report:Report,canCancel:boolean,onCancel})`; `ResultList({report:Report})`; `EquipmentDiff({before:Loadout,after:Loadout})`; `useReport(token:string)` exposes `{report,error,refresh}` with bounded polling from C11. Resolve management availability from the server, never possession of the report link alone.

- [ ] Write tests rendering +150 over baseline 10,200, showing +1.47%, full required changes, failed candidate without numeric gain, effectively tied result, conditional token, zero-baseline percentage, and partial-search label. Use design fixtures only for UI presentation tests; real integration tests use actual simulation data.
- [ ] Implement exact Paper layout and copy, accessible aligned result bars, grouping/filtering, expandable details, set/stat changes, complete gear sets, and source links. Make long names available by wrapping/expansion rather than hover-only tooltips.
- [ ] Add `src/features/reports/CombinationList.tsx` and `CombinationList.test.tsx` for Top Gear, separate from drop-item ranking rows. Render the complete-set fixture as six ranked rows including equipped; verify disclosure exposes every required swap/full set, equipped/top-set diff toggle, jump-to-equipped, fewer-changes recommendation, and chosen-set reuse. Test more than one result exists when several valid sets finish. Wire pagination/counts and refinement labels for larger reports; no client-side fabrication of discarded sets.
- [ ] Implement visible progress phases and actual counts; update summaries when a new baseline revision arrives. Do not invent percent completion if work count is still being determined. Display expiry and read-only sharing state.
- [ ] Implement partial retry, cancellation, report not found/expired, connection loss with backoff, no-upgrade outcome, and immutable completed-report resimulation. Keep previous data visible during transient poll errors with a stale indicator.
- [ ] Run browser tests for leaving/reopening a report, mobile detail expansion, and unauthenticated access. Inspect screenshots at approved widths and verify keyboard focus plus polite progress announcements. Commit `feat: implement Paper simulation reports`.

## C15. Validate all specs, benchmark limits, and prepare release

**Files:** Create `scripts/benchmark.ts`, `scripts/check-design-handoff.ts`, `scripts/check-catalog.ts`, `tests/integration/spec-parity.test.ts`, `tests/e2e/accessibility.spec.ts`, `.github/workflows/checks.yml`, `docs/engineering/benchmarks.md`, `docs/engineering/release-checklist.md`, `docs/engineering/operations.md`; update `.env.example` and version/coverage manifests with measured evidence.

**Interfaces:** Scripts exit nonzero on incomplete approval, incomplete advertised catalog coverage, or missing per-spec parity evidence. Benchmark records contain specId, engine version, input hash, machine, combinations, iterations, wall time, peak memory, attempts, and measured compute cost basis.

- [ ] Run parity fixtures for every manifest DPS variant with fixed seeds against original and wrapped CLI, then repeated independent seeds for statistical comparison. Confirm buffs, consumes, rotation policy, pets, and item database version match. A failing advertised variant blocks release until corrected; do not quietly narrow all-spec scope.
- [ ] Collect actual in-game exporter fixtures for character and bags and supported locales. If unavailable, record that limitation and keep the public-release checkbox open; source-derived fixtures alone do not prove client compatibility.
- [ ] Benchmark representative small/large inventories and one complete raid comparison for each materially distinct simulator workload, including pets and dual wield. Compare Trigger machine sizes and cold/warm runs. Include retries and baseline overhead in cost calculations.
- [ ] Choose production concurrency, chunk sizes, max combinations, iteration ceilings, duration, queue TTL, report expiry, anonymous quotas, and global admission budget from measurements. Record the configured monthly budget supplied by the operator; no assumed budget or paid service purchase is authorized by this plan. Unconfigured production capacity remains closed for job admission.
- [ ] Verify shared concurrency and subprocess termination with real Trigger development/staging jobs. Verify retry/exhaustion/partial-report behavior and that completed work is not rerun. Test the outbox recovery window around provider acceptance.
- [ ] Implement `scripts/check-design-handoff.ts` to verify approval revision, required screen keys/exports, and mapped component coverage. Check token drift using exported values and compare rendered browser screenshots at 1440/768/390/320px. Approve visual differences only through the user refinement process, not by blindly updating snapshots.
- [ ] Add browser accessibility checks for labels, contrast, keyboard reachability, result disclosure, error navigation, focus visibility, 200% text zoom, and bottom-bar overlap. Automated checks supplement manual keyboard/screen-reader review.
- [ ] Run the final acceptance suite:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:sim
pnpm exec tsx scripts/check-design-handoff.ts
pnpm exec tsx scripts/check-catalog.ts
pnpm exec playwright test
pnpm build
```

- [ ] Configure CI for pure/unit/UI tests and a separate reproducible native/integration job. Do not expose secrets to forked PRs or run uncontrolled public cloud simulations in every CI check. Archive parity/benchmark artifacts with versions.
- [ ] Document migrations, environment validation, staging verification, pinned binary checksums, budget shutdown, data/report expiry, cleanup, rollback, upstream upgrade policy, and troubleshooting. Keep account/billing implementation outside the release.
- [ ] Prepare a reviewable staging build and release checklist. Public publishing happens only within user authorization for the chosen deployment target; this planning request is not a request to purchase hosting or publish the site.
- [ ] Commit `test: validate optimizer release readiness` only after evidence is recorded. Report any uncompleted external validation honestly.

## Design-to-code traceability

| Design outputs | Code tasks | Evidence |
| --- | --- | --- |
| D1–D2 foundations, HOME, COMPONENTS | C0–C1 | exact tokens/JSX, navigation test, screenshot comparison |
| D3 IMPORT, IMPORT-REVIEW, SETTINGS | C3–C5, C12 | data preservation, preset isolation, UI validation |
| D4 TG/BOSS/RAID-SELECT, TOKEN-OPTIONS | C6, C8, C13 | legality, recipes, coverage and selection tests |
| D5 JOB and result/detail screens | C7, C10–C11, C14 | numerical attribution, durable progress, report fixtures |
| D6 responsive and accessibility | C12–C15 | viewport/zoom/keyboard checks |
| D7–D8 refinement and handoff approval | C0, C15 | recorded approval and revision alignment |

## Specification coverage

| Spec section | Tasks |
| --- | --- |
| 1 Product, all DPS, anonymous launch | C1, C4, C9, C13, C15 |
| 2 Imports and presets | C2–C5, C12 |
| 3 Comparisons, inventory, enhancements, caps | C5–C8, C13–C14 |
| 4 Loot and tier tokens | C8, C13–C14, C15 |
| 5 Raidbots-informed experience | C0–C1, C12–C15 |
| 6 Contracts/storage/cache | C1–C5, C7, C9–C11 |
| 7 Trigger/cost control | C9–C10, C15 |
| 8 Search and uncertainty | C7–C8, C11, C14–C15 |
| 9 Future paid boundary | C9, C11, C13, C15; billing excluded |
| 10 Validation/delivery | Every task acceptance plus C15 |
| 11 Pins/research limitations | C2, C4, C8, C15 |

## Primary implementation references

- [Next.js installation and App Router](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs) for C1 setup; record actual versions at execution.
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions) for C9 atomic admission.
- [Trigger tasks](https://trigger.dev/docs/tasks/overview), [configuration/runtime](https://trigger.dev/docs/config/config-file), [queues](https://trigger.dev/docs/queue-concurrency), and [build extensions](https://trigger.dev/docs/config/extensions/overview) for C10. Runtime docs currently list `node-24`; verify deployment configuration at execution.
- [Pinned original CLI](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/cmd/wowsimcli/cmd/basic_sim.go), [core API](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/sim/core/api.go), and [makefile](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/makefile) for C2.

## Final sequencing rule

Execute the Paper plan first, refine the actual design, and obtain explicit approval of its handoff revision. Then execute C0–C15. Keep future design changes synchronized through the design manifest and review log; the website must follow the approved design rather than merely cite it.
