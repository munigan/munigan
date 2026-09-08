# Top Gear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work inline unless the user explicitly requests delegation.

**Goal:** Deliver anonymous Top Gear for Warmane 3.3.5a: import equipped and carried-bag equipment, select and lock owned items within a visible work allowance, simulate legal complete combinations, and rank the resulting sets with exact swaps and gains versus equipped gear.

**Architecture:** Next.js handles imports, configuration, bounded admission and reports; PostgreSQL stores frozen snapshots, jobs, work and budgets. Trigger.dev runs candidate generation and the pinned native Poli93 CLI under one fixed shared concurrency limit. Pure inventory, equipment, allowance and result modules are independent of React and Trigger.dev.

**Tech Stack:** TypeScript, Next.js/React, Tailwind v4 Paper tokens, Zod, PostgreSQL/Drizzle, Trigger.dev v4, pinned Go simulator/protobufs, Vitest, Testing Library and Playwright. Retain Node 24 as the planned local/worker runtime; resolve exact compatible package versions at execution and commit the lockfile.

**Spec:** [Product and architecture specification](../specs/2026-09-08-wotlk-droptimizer-design.md), specifically §§1–3, 5–8 and Top Gear acceptance in §10. [Design handoff](../../design/handoff.md), [interactions](../../design/interactions.md) and [screen index](../../design/screens.json) supply the UI contract. This plan is the active first delivery slice of the [broader code roadmap](2026-09-08-code-implementation.md).

**Status:** Local Top Gear implementation delivered on `codex/top-gear`, authorized by “You can start the implementation.” The user subsequently directed: “Configure Trigger.dev after local implementation.” See the [execution record](../../engineering/top-gear-execution.md) for implemented milestones, verification and remaining release gates. Original task checklists below retain the broader acceptance criteria; unchecked compound items must not be interpreted as completed cloud/client validation.

## Global constraints

- “The first public release covers every DPS specialization supported by the pinned simulator.” Build incrementally with representative fixtures, but do not silently reduce the public-release support promise to Fury.
- “Free tools must remain usable without sign-in.” Top Gear has no account, checkout or payment dependency.
- “Owned items retain their existing enhancements, including empty sockets and missing enchants.” No gem, enchant, talent or cap optimization.
- “The currently equipped set must remain available as a reference.” All gain values compare to that frozen reference, including after changing a gear-difference view.
- “A work budget interruption does not silently become a completed exhaustive search.” Preserve partial results and report coverage honestly.
- “Every CPU-consuming work unit uses an explicit shared global simulation queue and concurrency cap.” Lightweight bounded input validation may run in the web application; expensive search and every simulation run on Trigger.dev.
- Use Warmane-compatible 3.3.5a mechanics. Realm is display metadata only and never a selector or a mechanical cache key.
- Use simulator candidate pin `563e4a08cb15729f1fdcbcf68e6d68224553bfef` and exporter pin `e69635092425bf4beadca22570fc7b975a73c95e`; record and verify any necessary pin change.
- Preserve quantities, item-instance identity, paired-slot order, professions, enhancement legality, meta activation and existing tier set bonuses. Lower armor types remain eligible when legally usable.
- Planning has concluded. The user's coding authorization is recorded for the revision 4 Top Gear subset in `approval.json`; unrelated tools remain pending. Local application setup and simulator builds are authorized. Trigger project configuration and cloud deployment are deferred until after local implementation.

## Delivery decisions

The first working path is **Import → Review → Settings → Select owned gear → Review allowance → Simulate → Compare complete sets**. Use the existing exporter and two paste fields for character and bags. Missing bags means equipped-only, explicitly labeled; full simulator JSON/profile links remain an alternate input. No new exporter addon is planned unless verified incompatibilities require a separately reviewed adapter change.

Use uniform sampling for the initial bounded search: every admitted candidate and the equipped reference receive the same configured iteration count, with distinct deterministic seed streams per mechanical loadout. Persist all evaluated combinations and paginate the list. This is the recommended simplification for this focused plan: adaptive coarse screening, survivor selection and finalist refinement from the broader roadmap are deferred. The report shows the actual sampling policy and cannot claim a refinement stage that did not run. Benchmark-driven uniform iteration and workload limits are selected before public admission; the design's 5,000 units per set is an accounting example, not that selection.

Other approaches considered: porting the full staged optimizer immediately adds statistical, persistence and retry complexity before the first useful report; a one-slot-at-a-time optimizer is smaller but misses interacting upgrades and does not satisfy Top Gear. Exhaustive search within the admitted limit meets the requested full-set behavior with fewer moving parts.

Keep the first release's navigation focused on Top Gear. Do not ship inactive Boss/Raid tabs or “Use in Droptimizer” actions. Retain Copy set and explicitly Use this set as a new Top Gear reference; preserve the original inventory and original immutable report. This scoped navigation adaptation and uniform-sampling progress copy must be reviewed with the Top Gear Paper subset before coding those controls. Future tools can reuse the inventory/simulator modules without adding speculative acquisition or billing types now.

Out of scope: boss/raid catalogs, drop comparisons, token redemption/resources, new-loot gem policies, bank scans, Armory, billing, account systems, automatic cap repair and multi-drop planning. Already owned tier pieces still produce their real set bonuses through the engine.

## Milestones and design references

| Milestone | Tasks | Reviewable result |
| --- | --- | --- |
| Import and real engine | T0–T3 | Approved Top Gear design subset; preserved equipped/bag import; actual native DPS for a canonical character |
| Correct optimization | T4–T5 | Legal bounded enumeration, honest allowance and ranked complete sets using real CLI output |
| Durable execution | T6–T7 | Anonymous admission, fixed Trigger workers, progress, retry, cancellation and immutable report API |
| Public experience | T8–T9 | Paper-based end-to-end UI with complete-set comparison and recovery |
| Release evidence | T10 | All-spec/client parity, measured budget, accessibility, staging and operational checks |

Read current Paper nodes using the manifest, not guessed IDs. Relevant screen families: IMPORT, PROFILE-IMPORT, IMPORT-REVIEW, SETTINGS, TG-SELECT, JOB, TG-RESULT, FULL-SET in desktop/mobile; RUN-SUMMARY.mobile; IMPORT-FOCUS.mobile; import narrow/zoom references; COMPONENTS.v4; import/settings/selection/item/job/report/detail/coverage state boards. Reuse the raid narrow/zoom board only for wrapping conventions, not loot-specific UI. Review subset approval without requiring implementation of the deferred tools.

## Module and file map

| Paths | Responsibility |
| --- | --- |
| `src/domain/top-gear/model.ts`, `request-schema.ts` | Versioned input, item instances, loadouts, selection and report contracts |
| `src/features/import/{parse-export,profile-link,normalize,draft-store}.ts` | Export decoding, provenance, inventory replacement and local draft storage |
| `src/features/settings/{registry,resolve}.ts` | Pinned spec presets, category patches, automatic rotation policy |
| `src/domain/equipment/{catalog,validate,enumerate,loadout-key}.ts` | Legal complete equipment and canonical mechanical identity |
| `src/domain/top-gear/{allowance,plan,statistics,report}.ts` | Bounded work plan, fair sampling, deltas, ranking and coverage |
| `src/server/simulator/{cli,input,result}.ts`, `tools/simulator/` | Reproducible CLI, process lifecycle, canonical input/output |
| `tools/data/{generate,extract-presets,item-icons}.ts`, `data/wotlk/` | Pinned mechanical catalog, registry and optional cached artwork metadata |
| `src/server/db/{client,schema}.ts`, `drizzle/` | Durable snapshots, jobs, work, budgets, outbox and report access |
| `src/server/jobs/{admit,capabilities,dispatch,work,finalize,reconcile}.ts` | Admission, ownership, idempotent work and publication |
| `src/trigger/{queues,top-gear,maintenance}.ts`, `trigger.config.ts` | Bounded native work and cleanup |
| `src/features/inventory/{InventorySelector,RunSummary,ItemDetails}.tsx` | Instance selection, locks, allowance, accessible metadata |
| `src/features/reports/{JobProgress,CombinationList,EquipmentDiff,FullSet}.tsx` | Complete-set reports and all slots |
| `src/app/top-gear/page.tsx`, `src/app/reports/[token]/page.tsx` | Thin route composition |
| `tests/fixtures/`, `tests/support/`, `tests/integration/`, `tests/e2e/` | Source fixtures, pure test builders, native/DB/cloud and browser evidence |
| `docs/engineering/top-gear-*.md` | Compatibility, benchmark, operations and release evidence |

## Shared contracts

Create these in T2 with generated protobuf types; T1 does not depend on domain types or generated schemas. Do not invent a second player/settings schema.

```ts
import type { IndividualSimSettings } from '@/generated/wotlk/ui';
export type Slot = 'head'|'neck'|'shoulder'|'back'|'chest'|'wrist'|'hands'
  |'waist'|'legs'|'feet'|'finger1'|'finger2'|'trinket1'|'trinket2'
  |'mainHand'|'offHand'|'ranged';
export type ItemInstance = {
  instanceId:string; itemId:number; enchantId:number; gemIds:number[];
  source:'equipped'|'bag'; equippedSlot?:Slot;
};
export type Loadout = Record<Slot,string|null>; // instance IDs; explicit empty slots
export type Versions = {
  engine:string; schema:string; presets:string; catalog:string; optimizer:string;
};
export type Snapshot = {
  id:string; specId:string; versions:Versions;
  settings:IndividualSimSettings; inventory:ItemInstance[]; equipped:Loadout;
  provenance:Record<string,'imported'|'preset'|'edited'>;
};
export type Selection = {
  selectedInstanceIds:string[];
  acknowledgedExclusions:string[]; // unsupported bag instance IDs explicitly excluded
  lockedSlots:Partial<Record<Slot,string|null>>;
};
export type TopGearRequest = {
  tool:'top-gear'; snapshot:Snapshot; selection:Selection; precision:'standard';
};
export type Diagnostic = {
  code:string; path:string; severity:'error'|'warning'; message:string;
};
export type Metric = {mean:number; stdev:number|null; iterations:number};
export type SimulationResult = {
  loadout:Loadout; inputHash:string; metric:Metric; stats:number[];
};
export type WorkPolicy = {
  version:string; unitsPerSet:number; maxUnits:number; iterationsPerSet:number;
  maxSearchNodes:number; maxJobSeconds:number; maxAttempts:number;
};
export type Allowance = {
  count:number; countKind:'exact'|'upper-bound'|'over-limit';
  units:number; allowed:boolean; policyVersion:string;
};
export type RunPlan = {
  candidateLoadouts:Loadout[]; reference:Loadout;
  simulations:Array<{key:string; loadout:Loadout; seed:string; iterations:number}>;
  allowance:Allowance;
};
export type SetRow = {
  id:string; loadout:Loadout; dps:number; gain:number|null; percent:number|null;
  swaps:number; eligible:boolean; isEquipped:boolean; tiedToHighest:boolean|null;
  iterations:number; inputHash:string;
};
export type TopGearReport = {
  token:string; status:'queued'|'running'|'complete'|'partial'|'failed'|'canceled';
  phase:'planning'|'equipped'|'combinations'|'complete';
  snapshot:Snapshot; selection:Selection; policy:WorkPolicy;
  rows:SetRow[]; equippedId:string; highestId:string|null; recommendedId:string|null;
  coverage:{planned:number|null; succeeded:number; failed:number;
    returned:number; exhaustive:boolean};
  termination:'complete'|'runtime-limit'|'search-limit'|'canceled'|'failed'|null;
  expiresAt:string;
};
```

The public report is a sanitized projection of this normalized snapshot: remove display identifiers beyond chosen character name, diagnostic raw payloads, owner credentials and provider secrets. Server validation rebuilds mechanics using the pinned catalog and settings schema; never trust client-submitted DPS, work counts, policy prices or catalog definitions. Unsupported bag records stay visible in the snapshot; submission requires their IDs in acknowledgedExclusions and outside the selected instances. Recompute their diagnostic reasons on the server. Invalid equipped items cannot be acknowledged away.

**Reference versus eligibility:** simulate C exactly once. If C satisfies the selection/locks, it is also an eligible ranked candidate. Otherwise retain it visibly as a reference-only set; it cannot become the recommended eligible result or bypass a lock. Charge it once in the allowance either way. Selected combinations may all be below C, so negative candidate gains are valid; do not clamp Top Gear gains to zero. Canonical deduplication may combine identical mechanical inputs while retaining their legal instance mapping. Never discard paired-slot order without validated equivalence.

## T0. Confirm the Top Gear design contract

**Files:** Modify `docs/design/approval.json`, `docs/design/handoff.md`, `docs/design/interactions.md` only when actual review/approval warrants it; create `docs/engineering/top-gear-design-contract.md` during execution.

**Consumes/produces:** Existing revision 4 and scope above → recorded approved Top Gear screen subset plus actual source references.

- [ ] Read the spec, this plan, design manifest and current approval record.
- [ ] Review the scoped navigation, chosen-set reuse within Top Gear, uniform-sampling phases, and reference-only equipped state against Paper. Make targeted design changes where needed; keep the deferred tool boards available as future designs.
- [ ] Record actual approval of this subset with revision, screen keys and exact user message; do not mark unrelated screens approved. Existing full-design pending status can remain while an explicitly scoped Top Gear approval is recorded separately in the contract.
- [ ] Export affected nodes/tokens and record the revision that implementation will consume.

Acceptance: either explicit matching scoped/full approval exists, or execution remains in design refinement. Planning may continue without changing approval state.

## T1. Establish a testable Top Gear shell and fixture harness

**Files:** Create `package.json`, `pnpm-lock.yaml`, `.node-version`, `.gitignore`, `.env.example`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `README.md`, `src/app/{layout.tsx,page.tsx,globals.css}`, `src/features/shell/AppShell.tsx`, `src/app/top-gear/page.tsx`, `tests/setup.ts`, `tests/e2e/navigation.spec.ts`.

**Consumes/produces:** T0 design → anonymous shell, tool route and test commands. `AppShell({children:React.ReactNode})` exposes Top Gear navigation only.

- [ ] Resolve compatible exact stable dependency versions from official docs/package registries, including the pinned pnpm package manager. Configure `@/*`, Node/jsdom Vitest projects, Playwright dev server and exclusion of `docs/design/exports` from application compilation. Unit tests use project `unit` with `src/**/*.test.ts`, UI tests use `ui` with `src/**/*.test.tsx`; `integration` includes `tests/integration/**/*.test.ts` except `cli`, `top-gear-sim` and `spec-parity`; those three belong to project `simulator`. Exclude Playwright files from every Vitest project. Keep T1 limited to the shell and a labeled import entry; T2 introduces generated settings and the domain contract before any dependent feature compiles.
- [ ] Add scripts: `dev: next dev`, `build: next build`, `start: next start`, `lint: eslint .`, `typecheck: tsc --noEmit`, `test: vitest run --project unit --project ui`, `test:integration: vitest run --project integration`, `test:e2e: playwright test`, `test:sim: vitest run --project simulator`, `sim:build: bash tools/simulator/build.sh`, and `data:generate: tsx tools/data/generate.ts`. Configure native/DB prerequisites explicitly; the default fast test suite does not run them.
- [ ] Write and run the navigation regression before implementing the shell:

```ts
import {test,expect} from '@playwright/test';
test('opens Top Gear without an account', async ({page}) => {
  await page.goto('/');
  await page.getByRole('link',{name:'Top Gear',exact:true}).first().click();
  await expect(page).toHaveURL(/\/top-gear$/);
  await expect(page.getByLabel('Character export')).toBeVisible();
  await expect(page.getByRole('button',{name:/sign in/i})).toHaveCount(0);
});
```

- [ ] Implement the scoped shell, import entry and exact Paper token/font roles. Preserve upstream font licenses and simulator attribution. The initial form can await the parser, but no fake successful import or fake DPS appears in product UI.
- [ ] Run `pnpm exec playwright test tests/e2e/navigation.spec.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. Commit `feat: add public Top Gear shell` after passing checks.

## T2. Produce canonical settings, catalog and a real native evaluator

**Files:** Create `tools/simulator/{source.lock.json,build.sh,overlay/json_sim.go,overlay/json_sim_test.go}`, `tools/data/{generate,extract-presets}.ts`, `data/wotlk/{versions,specs,presets,items}.json`, `src/generated/wotlk/`, `src/domain/top-gear/model.ts`, `src/server/simulator/{cli,input,result}.ts`, `src/features/settings/registry.ts`, `tests/fixtures/sim/`, `tests/integration/cli.test.ts`, `docs/engineering/top-gear-compatibility.md`.

**Interfaces:** `runCli(input:RaidSimRequest, options:{binary:string;signal:AbortSignal;maxSeconds:number}):Promise<{raidResult:RaidSimResult;statsResult:ComputeStatsResult}>`; `evaluate(snapshot:Snapshot, loadout:Loadout, iterations:number, seed:string, signal:AbortSignal):Promise<SimulationResult>`. Generated types come from the same engine pin. `listSpecs()` returns registry IDs with preset and fixture paths.

- [ ] Fetch the exact pin into ignored `.cache/wotlk`, verify HEAD and record toolchain/protobuf generator versions. Generate the schema, item rules and every supported DPS variant's presets without importing a browser DOM into worker code. Record explicit class/spec/profession/unique restrictions; missing rules cannot be silently treated as unrestricted.
- [ ] Store a minimal valid original-simulator input and same-seed output as a native parity fixture. Label its origin and versions. Write a failing adapter test comparing wrapped and original output; do not substitute design numbers.
- [ ] Preserve upstream commands; add the thin `json-sim` overlay already described in broader task C2. It invokes `core.RunRaidSim` and `core.ComputeStats`, returns both using protobuf JSON, and surfaces engine errors. Keep combat mechanics unchanged and clone protobuf inputs for independent parity checks.
- [ ] Build host and Linux target binaries with embedded DB, validate target architecture and checksum, keep binaries out of git. The Linux build command in the prepared checkout is:

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -tags=with_db -o dist/wowsimcli ./cmd/wowsimcli
```

- [ ] Implement the Node boundary using `spawn` with `shell:false`, private temp files, bounded output, process-group cancellation where supported, TERM→KILL timeout and cleanup. Reject nonfinite metrics, absent player output and engine errors. Use the upstream player's DPS aggregate so pets are counted exactly once; inspect schema meaning before extracting variance.
- [ ] Map all equipment slots and preserve complete settings. Resolve auto rotation from the fixed upstream policy for each loadout when gear affects it. `ComputeStats` receives an unmutated cloned request. Hash mechanical settings, versions, slots, enhancements, seed and iteration count; exclude display-only name/realm.
- [ ] Run `pnpm sim:build`, `pnpm data:generate`, `pnpm test:sim`. Compare original and wrapped output with identical seeds, plus malformed input, timeout and cancellation tests. Commit `feat: integrate pinned Top Gear simulator`.

## T3. Preserve character exports, bag instances and presets

**Files:** Create `src/features/import/{parse-export,profile-link,normalize}.ts`, `src/features/settings/resolve.ts`, `src/domain/top-gear/request-schema.ts`, corresponding `*.test.ts`, `tests/fixtures/import/`, `tests/support/fixtures.ts`, `docs/engineering/top-gear-imports.md`.

**Interfaces:** `parseExport(text:string,kind:'character'|'bags'|'profile'):ImportDraft`; `ImportDraft={settings:Partial<IndividualSimSettings>;inventory:ItemInstance[];providedPaths:string[];diagnostics:Diagnostic[]}`. `resolveSnapshot(draft:ImportDraft,presetId:string):{snapshot:Snapshot;diagnostics:Diagnostic[]}`; `applyBagImport(snapshot:Snapshot,items:ItemInstance[]):Snapshot`; `applySettingsPatch(snapshot:Snapshot,category:SettingsCategory,patch:unknown):Snapshot`. Categories: talents/glyphs, rotation, consumes, buffs/debuffs, encounter, spec options. `fixtureSnapshot(name:string):Snapshot` loads a versioned normalized test fixture from this task.

- [ ] Capture source-derived character/bag/profile fixtures from the pinned exporter/importer; record format, locale and limitations. Add authentic in-game fixtures when available; source fixtures do not establish client compatibility. Limit both compressed/decompressed profile sizes and parse nesting, decode supported links locally, and reject unsupported hosts rather than fetching arbitrary URLs.
- [ ] Write preservation tests before parser implementation:

```ts
import {expect,it} from 'vitest';
import {parseExport} from '@/features/import/parse-export';
import {applyBagImport} from '@/features/import/normalize';
import {fixtureSnapshot} from '../../../tests/support/fixtures';
it('replaces bag snapshots without multiplying enhanced copies', () => {
  const text='{"items":[{"id":100,"enchant":0,"gems":[0]},{"id":100,"enchant":9,"gems":[7]}]}';
  const parsed=parseExport(text,'bags'); // synthetic IDs; catalog validation is separate
  expect(parsed.inventory.map(i=>i.enchantId)).toEqual([0,9]);
  const once=applyBagImport(fixtureSnapshot('warrior'),parsed.inventory);
  expect(applyBagImport(once,parsed.inventory).inventory).toEqual(once.inventory);
  expect(once.inventory.filter(i=>i.source==='bag')).toHaveLength(2);
});
```

- [ ] Implement occurrence-based identities scoped to the character/bag snapshot. Separate character import from bag replacement; repeating the same bag payload is idempotent. Two real identical copies stay two copies; socket/enchant variations stay distinct. Reimport never appends blindly or infers shared physical identity from an item ID.
- [ ] Preserve zero/false/empty enhancements, race, talents, glyphs, professions and supported settings. Supplied values override defaults; edits override the targeted category only. Unknown localized glyphs and ambiguous specs remain review diagnostics; invalid equipped data blocks Run, unknown bag records require explicit exclusion. Detect incompatible schemas/expansion evidence, without claiming heuristic detection of every foreign export.
- [ ] Test category preset changes preserve unrelated imported fields and never import preset gear. Add missing bags, bag-only input in character field, malformed profile, explicit empty slots, reimport, every supported spec's defaults and auto-rotation fixtures.
- [ ] Run `pnpm test src/features/import src/features/settings src/domain/top-gear/request-schema.test.ts` and typecheck. Commit `feat: import equipped and bag gear with preserved settings`.

## T4. Enumerate legal complete sets and calculate allowance

**Files:** Create `src/domain/equipment/{catalog,validate,enumerate,loadout-key}.ts`, `src/domain/top-gear/{allowance,plan}.ts`, corresponding `*.test.ts`, `tests/support/equipment-fixtures.ts`.

**Interfaces:** `validateLoadout(snapshot:Snapshot,loadout:Loadout):Diagnostic[]`; `enumerateLoadouts(snapshot:Snapshot,selection:Selection):Generator<Loadout>`; `estimateAllowance(request:TopGearRequest,policy:WorkPolicy):Allowance`; `planRun(request:TopGearRequest,policy:WorkPolicy):RunPlan`. `loadoutKey(snapshot,loadout):string` preserves ordered mechanical input. `miniInventory()` returns a valid synthetic equipped set plus two alternative heads and two alternative chests; its other slots are fixed and paired slots deliberately locked.

- [ ] Write a manually enumerated fixture expecting exactly four eligible head/chest combinations; write quantity tests preventing one ring instance in both slots, allowing two legal copies, and preserving enhanced variants. Run tests red before implementing the enumerator.
- [ ] Implement deterministic lazy backtracking using instance availability and early legal-constraint checks. Occupied slots require selected eligible equipment; empty slots are explicit, not an optimizer-wide option to strip equipment. Off-hand absence is permitted where the legal weapon configuration requires/allows it. Preserve locked empty slots. A disabled equipped candidate can still be simulated as reference C, never as an eligible candidate.
- [ ] Cover unique categories, class/race/profession rules, lower armor, weapon handedness, dual wield/Titan's Grip, ranged/relic eligibility, profession gems/sockets, meta activation and tier thresholds. Illegal enhancements fail validation; a legal inactive meta or lost socket bonus remains a possible outcome. No hit/expertise threshold removes an otherwise legal set.
- [ ] Keep paired-slot permutations until equivalence is proven. Deduplicate only identical canonical mechanical loadouts while retaining instance mappings and quantities. Never prune by item level/stat weights.
- [ ] Implement overflow-safe allowance calculations and separate-reference charging. Bounded synchronous estimates use a conservative combinatorial upper bound (including C at most once); label that bound rather than claiming an exact count. Over-limit estimates require narrowing selections. The worker performs exact legal enumeration and verifies it cannot exceed the reserved bound. No expensive enumeration endpoint runs in the web process.
- [ ] Add the exact accounting boundary test; create the helper `allowanceForCount(count:number,policy:WorkPolicy):Allowance` in `allowance.ts`:

```ts
import {it,expect} from 'vitest';
import {allowanceForCount} from './allowance';
const policy={version:'fixture',unitsPerSet:5000,maxUnits:300000,
  iterationsPerSet:1000,maxSearchNodes:10000,maxJobSeconds:60,maxAttempts:2};
it('limits complete simulation work rather than selected item count', () => {
  expect(allowanceForCount(60,policy).allowed).toBe(true);
  expect(allowanceForCount(61,policy).allowed).toBe(false);
});
```

- [ ] Test estimate never undercounts on exhaustively enumerable fixtures, exact C deduplication, overflows, many same-slot items versus multiplicative multi-slot choices, and lock/selection changes. If a worker hits the search-node/time guard, publish search-limit coverage, not exhaustive results.
- [ ] Run `pnpm test src/domain/equipment src/domain/top-gear/allowance.test.ts src/domain/top-gear/plan.test.ts`. Commit `feat: enumerate legal owned sets within the free allowance`.

## T5. Rank every evaluated set with honest uncertainty

**Files:** Create `src/domain/top-gear/{statistics,report}.ts`, `src/domain/top-gear/report.test.ts`, `src/domain/top-gear/statistics.test.ts`, `tests/integration/top-gear-sim.test.ts`.

**Interfaces:** `compareMetrics(a:Metric,b:Metric):{gain:number;percent:number|null;tied:boolean|null}`; `rankSets(snapshot:Snapshot,selection:Selection,results:SimulationResult[]):{rows:SetRow[];highestId:string|null;recommendedId:string|null}`. Sorting and recommendation are distinct. Plan keys include per-loadout seed and uniform iterations; retries reuse the same work key and seed.

- [ ] Create a pure fixture where the head-only and chest-only swaps lose DPS, but changing both wins. Test all four complete sets are retained and the joint optimum is ranked first. This rejects greedy independent-item scoring.
- [ ] Write a six-set UI projection fixture using design values; test exact numerical ordering, +200 versus 10,000, Set 02 recommendation without rank changes, full-slot diffs and equipped-only reference behavior. Keep fixture results separate from real-CLI evidence.
- [ ] Implement deltas against C, nullable percentage when C=0, failed/absent C without invented gains, deterministic tie-break ordering, and identity-aware full-slot swap counts. Choose the fewest swaps only among valid candidates whose metrics are indistinguishable from the highest eligible set; unknown uncertainty gives no tied recommendation. Exact equipped versus itself has zero gain without an independent statistical comparison.

```ts
import type {Metric} from './model';
export function compareMetrics(a:Metric,b:Metric) {
  const gain=a.mean-b.mean;
  const valid=a.stdev!==null && b.stdev!==null && a.iterations>1 && b.iterations>1;
  const se=valid ? Math.sqrt(a.stdev! ** 2 / a.iterations + b.stdev! ** 2 / b.iterations) : null;
  return {gain,percent:b.mean===0?null:100*gain/b.mean,
    tied:se===null?null:Math.abs(gain)<=1.96*se};
}
```

- [ ] Validate nonnegative finite deviations, finite means and positive integer counts before comparison. The formula assumes independent sample means; distinct seed streams must be verified with the engine. It is a pairwise uncertainty label, not a multiple-comparison guarantee that the winner is best. If independence or deviation semantics cannot be established, return unknown. Record actual iterations separately from budget units.
- [ ] Retain every evaluated loadout at uniform precision; paginate persisted rows and report planned/succeeded/failed/returned counts. No hidden top-N discard. A partial run identifies its best as “best found”; failed work stays in coverage with a reason, never zero DPS. A single eligible set still produces a useful baseline comparison.
- [ ] Run pure tests and `pnpm test:sim` including `top-gear-sim.test.ts` with a small manually enumerated real inventory. Commit `feat: rank complete Top Gear sets and explain swaps`.

## T6. Admit anonymous work atomically and persist reports

**Files:** Create `compose.yaml`, `drizzle.config.ts`, `src/server/db/{client,schema}.ts`, `drizzle/0000_top_gear.sql`, `src/server/jobs/{admit,capabilities,work}.ts`, `src/server/jobs/policy.ts`, `tests/support/db.ts`, `tests/integration/admission.test.ts`.

**Interfaces:** `admitJob({request,ownerKey,idempotencyKey}):Promise<{jobId:string;reportToken:string}>` or typed validation/quota/capacity error. `reserveWork(jobId:string,workKey:string):Promise<'run'|'complete'>`; `cancelJob(jobId,ownerKey):Promise<boolean>`. `withTestDb(fn)` isolates only a dedicated test schema; `seedBudget(units)` and `countJobs()` operate there. `fixtureRequest()` in test support combines T3's snapshot with all eligible instances selected.

- [ ] Define tables for snapshots, jobs, canonical work, results, capacity/budget reservations, outbox and hashed owner/read capabilities. Use unique `(owner,idempotencyKey)` and `(jobId,workKey)` constraints. Freeze versions, policy and settings on admission. Store a request hash with idempotency; the same key with a different request returns conflict.
- [ ] Test with real PostgreSQL transactions before implementing admission:

```ts
import {it,expect} from 'vitest';
import {withTestDb,seedBudget,countJobs} from '../support/db';
import {fixtureRequest} from '../support/fixtures';
import {admitJob} from '@/server/jobs/admit';
it('reserves once for concurrent repeated submissions', async () => {
  await withTestDb(async () => {
    await seedBudget(1000000);
    const args={request:fixtureRequest(),ownerKey:'owner-a',idempotencyKey:'intent-a'};
    const [a,b]=await Promise.all([admitJob(args),admitJob(args)]);
    expect(a).toEqual(b);
    expect(await countJobs()).toBe(1);
  });
});
```

- [ ] Implement server schema/version validation, catalog-owned restrictions, bounded allowance, anonymous session and trusted-source IP quotas, queue/backlog cap and global budget. Resolve policy server-side. Reserve budget and create job/outbox in one locked/serializable transaction with bounded retries; do not call Trigger inside the transaction. Production without configured limits rejects new work.
- [ ] Use random read-only report tokens and a separate SameSite HttpOnly anonymous owner capability. Store hashes; retain an encrypted admission response for idempotent token replay using a server-only key. Ownership checks govern cancellation/retry; report possession grants read access only. Check Origin/CSRF for cookie-authorized mutations and cap request sizes.
- [ ] Test concurrent distinct jobs cannot overspend, forged counts/prices are ignored, unknown instance IDs fail, locks are revalidated, capacity errors create no outbox entry, different owners cannot cancel and duplicate work is not billed twice. Reconcile unused reservations and actual retry work separately; attempt ceilings prevent cost multiplication.
- [ ] Run `pnpm test:integration tests/integration/admission.test.ts`. Commit `feat: persist and admit anonymous Top Gear jobs`.

## T7. Execute bounded native work through Trigger.dev and expose APIs

**Files:** Create `trigger.config.ts`, `src/trigger/{queues,top-gear,maintenance}.ts`, `src/server/jobs/{dispatch,finalize,reconcile}.ts`, `src/app/api/top-gear/jobs/route.ts`, `src/app/api/top-gear/jobs/[id]/cancel/route.ts`, `src/app/api/top-gear/jobs/[id]/retry/route.ts`, `src/app/api/reports/[token]/route.ts`, `tests/integration/orchestration.test.ts`, `tests/integration/report-api.test.ts`, `docs/engineering/top-gear-trigger.md`.

**Interfaces:** `dispatchPendingJobs():Promise<number>` leases outbox records; `executeTopGear(jobId:string,signal:AbortSignal):Promise<void>` plans and executes bounded work; `finalizeJob(jobId):Promise<TopGearReport>`; `reconcileJobs():Promise<void>`. Task payloads contain job IDs, not exports. Initial implementation runs one native subprocess at a time within each active Top Gear task, persisting after each set; no nested task fan-out is necessary at this limit.

- [ ] Recheck the exact installed Trigger SDK, native binary packaging and cancellation hooks. Pin matching SDK/build/CLI versions and register `trigger:dev` / `trigger:deploy` scripts invoking that installed CLI; run `pnpm trigger:dev` for the bounded development checks. Define a single shared queue; do not supply a per-user concurrency key, which would create separate queue capacity. Start local/staging tests at concurrency 2, one child process per active task, and conservative validated runtime/iteration limits. Production values come from T10.

```ts
import {queue} from '@trigger.dev/sdk';
export const simulationQueue=queue({name:'wotlk-simulation',concurrencyLimit:2});
```

- [ ] Write state-transition tests: queued→planning→equipped→combinations→complete; transient retry resumes only unfinished work; baseline failure prevents numeric gains; cancellation/runtime limit retains completed rows; stale queued job expires. A deterministic fake executor tests state logic; native staging evidence separately tests the actual provider/process behavior.
- [ ] Implement outbox dispatch with a stable provider idempotency key and DB work leases with fencing. A retried/reconciled attempt must not publish after its lease is superseded. Mark results complete atomically before moving to the next set. Keep one process per task; never combine a process pool with the queue cap. Package the Linux binary through the supported build extension and verify executable permissions/architecture.
- [ ] Poll cancellation between sets and propagate provider abort/timeout to live process termination. Confirm in staging that canceling a task kills its native child. Retry only transient infrastructure faults; invalid inputs are terminal. Cap attempts and charge actual consumed work even when a run fails.
- [ ] Finalize only settled work. Completed reports are immutable; retrying missing/failed comparisons creates a new admitted report referencing the same snapshot and reusable completed work, with links back to the prior report. Implement reconciliation for outbox gaps, expired leases, queue TTL, leftover reservations and report expiry. Maintenance performs no simulations outside the CPU queue.
- [ ] Implement HTTP contracts: POST jobs + `Idempotency-Key` returns 202/report URL; GET report supports stable cursor pagination and noindex; cancel/retry require owner capability. Return 400 malformed, 422 invalid selections, 409 idempotency mismatch, 429 quota, 503 capacity, 404 unknown and 410 expired. Never return raw exports or management secrets.
- [ ] Run `pnpm test:integration tests/integration/orchestration.test.ts tests/integration/report-api.test.ts`, `pnpm test:sim`, and bounded Trigger staging tests: at least three jobs against cap 2, forced worker crash, lost dispatch acknowledgement, cancel during CLI execution and expired queue entry. Record peak subprocess count and duplicate-work behavior. Commit `feat: run resumable Top Gear simulations on Trigger`.

## T8. Implement import, presets and owned-item selection from Paper

**Files:** Create `src/features/import/{ImportPanel,ImportReview}.tsx`, `src/features/import/draft-store.ts`, `src/features/settings/PresetPanel.tsx`, `src/features/shell/CharacterSummary.tsx`, `src/features/inventory/{InventorySelector,RunSummary,ItemDetails,ItemIcon}.tsx`, `src/features/inventory/selection.ts`, `src/app/top-gear/page.tsx`, `data/wotlk/item-icons.json`, `tools/data/item-icons.ts`, related component tests, `tests/e2e/top-gear-setup.spec.ts`.

**Interfaces:** `ImportPanel({onResolved:(snapshot:Snapshot)=>void})`; `InventorySelector({request:TopGearRequest,onChange:(request:TopGearRequest)=>void})`; `RunSummary({request,allowance:Allowance,onSubmit:()=>void,pending:boolean})`. Draft storage exposes `loadDraft`, `saveDraft` and `clearDraft`, using a schema/versioned local key and handling unavailable/quota-limited storage visibly.

- [ ] Write component tests for two-paste import, explicit unknown-bag exclusion, category-only preset edits, selected/locked quantity behavior and over-limit→reduce→Run enabled. Tests use T3/T4 fixtures through public UI, not injected React state.
- [ ] Implement semantic forms and source labels, collapse resolved input into character summary, preserve defaults and inventory, require confirmation for character/bag replacement, and retain draft on invalid import. Handle JSON/profile links and equipped-only state. Inputs use accessible labels matching the approved Paper subset.
- [ ] Implement slot navigation, scoped all/clear, selected-only filtering without changing selection, instance checkboxes, paired-slot quantities, visible locks and full enhancement details. Keep metadata/details actions separate from selection. Default to all supported imported equipped/bag gear selected; over-limit imports require explicit narrowing rather than automatic pruning.
- [ ] Add icons from cached expansion/item-ID metadata following `wowhead-item-assets.md`. Pin mechanics to simulator data; no runtime per-row Wowhead JSON requests. Preserve names and accessible tap/focus details on missing artwork or blocked external tooltips.
- [ ] Implement allowance/run summary at desktop and mobile widths, indicating estimates honestly; server rejection keeps the draft. Use one idempotency key per submit intent across network retries, renewing it after edits. Do not trust an optimistic client count as admission.

```ts
import {test,expect} from '@playwright/test';
import {importOwnedFixture} from '../support/browser';
test('keeps the selection when admission is temporarily unavailable', async ({page}) => {
  await page.route('**/api/top-gear/jobs',route=>route.fulfill({status:503,
    contentType:'application/json',body:'{"code":"capacity"}'}));
  await page.goto('/top-gear');
  await importOwnedFixture(page,'warrior-small');
  await page.getByRole('button',{name:/find top gear/i}).click();
  await expect(page.getByRole('alert')).toContainText(/try again/i);
  await expect(page.getByLabel('Select bag helmet')).toBeChecked();
});
```

Create `importOwnedFixture(page:Page,name:string):Promise<void>` in `tests/support/browser.ts`: load named character/bag fixture files, paste both fields, submit and resolve required review choices through the UI. Use the approved accessible checkbox label for the fixture's bag helmet.

- [ ] Run component/setup E2E tests, typecheck and screenshot review at 1440/768/390/320px. Commit `feat: build the Paper Top Gear setup experience`.

## T9. Implement progress and ranked full-set reports

**Files:** Create `src/features/reports/{JobProgress,CombinationList,EquipmentDiff,FullSet}.tsx`, `src/features/reports/use-report.ts`, related component tests, `src/app/reports/[token]/page.tsx`, `tests/e2e/top-gear-report.spec.ts`.

**Interfaces:** `CombinationList({report:TopGearReport})`; `EquipmentDiff({snapshot:Snapshot,before:Loadout,after:Loadout})`; `useReport(token:string)` exposes report/error/refresh. Display all loadout slots using the snapshot's instance records; do not reconstruct gear from changed-item icons.

- [ ] Write regression tests for all six complete sets, exact +200 and +196 gains, selected versus recommended set, reference-only equipped, negative gains, unknown uncertainty, zero reference percentage, failed/partial/expired reports and pagination. Switching gear-difference reference must leave every numeric gain unchanged.
- [ ] Implement the Paper 17-slot preview, ranked rows, changed-slot labels, full enhancement/slot details, jump-to-equipped, fewer-swaps toggle and copy set. “Use as reference” creates a new editable Top Gear draft only after explicit action; preserve original inventory and immutable source report. No inactive Droptimizer action ships. Include measured hit/expertise and set-bonus changes in details using validated stats; avoid universal cap claims when target/attack context is insufficient.
- [ ] Show actual phase/counts and unknown ETA, public read link with copy feedback, owner-only cancel confirmation and retry. Poll our API every two seconds while visible, back off on errors, pause when hidden, stop at terminal states. Preserve last received data with a stale indicator during transient errors.
- [ ] Add an E2E assertion after creating a real small local job through the test executor:

```ts
await expect(page.getByRole('heading',{name:/gear combinations/i})).toBeVisible();
await page.getByRole('radio',{name:'Top set',exact:true}).check();
await expect(page.getByTestId('set-01-gain')).toHaveText('+200');
await page.getByRole('button',{name:/full gear details/i}).click();
await expect(page.getByRole('heading',{name:/full gear/i})).toBeVisible();
await expect(page.getByTestId('full-set-slot')).toHaveCount(17);
```

The deterministic executor is enabled only by test configuration and supplies the six design fixture results; the product never exposes a fake-simulation mode. Native end-to-end tests use real results without hardcoding illustrative DPS.

- [ ] Test anonymous refresh/revisit, shared read-only access, cancellation preserving work, resimulation creating a new URL and browser error recovery. Review mobile stacking, long item names, copy feedback and focus return. Commit `feat: show Top Gear progress and complete-set rankings`.

## T10. Verify compatibility, measure costs and prepare a release

**Files:** Create `scripts/{benchmark-top-gear,check-top-gear-design,check-spec-coverage}.ts`, `tests/integration/spec-parity.test.ts`, `tests/e2e/accessibility.spec.ts`, `.github/workflows/checks.yml`, `docs/engineering/top-gear-{benchmarks,operations,release}.md`; update `.env.example`, source/spec manifests and deployment configuration for the selected target.

**Consumes/produces:** Working Top Gear → measured release evidence. The scripts exit nonzero when scoped design approval, required exports or any advertised spec evidence is missing. No mock result or Paper screenshot counts as engine/client validation.

- [ ] Run canonical import→native-sim parity for every advertised DPS variant using the pinned simulator's equivalent configuration. Include pets, auto rotations, dual wield, 2H/off-hand, tier bonuses, profession/meta effects and lower-armor alternatives. Record original/wrapped outputs, seeds and tolerances; a missing/failing advertised variant blocks public release.
- [ ] Validate actual Warmane 3.3.5a character and bag exports, duplicate quantities, glyph locale and item-cache behavior. If real client fixtures are unavailable, keep this release check open and request the specific missing evidence during execution; do not fabricate a successful in-game test.
- [ ] Benchmark representative small/maximum admitted inventories and expensive specs on local and Trigger machines. Record engine/input hash, combinations, actual iterations, retries, wall time, memory, peak subprocesses and compute basis. Select the uniform iteration count, allowance cost/maximum, search-node guard, chunk/job timeout, queue TTL, retry ceiling, report retention and concurrency from measurements. Record operator-approved budget separately; no paid service purchase follows from this plan.
- [ ] Confirm cancel kills native processes, restart resumes persisted work, duplicate dispatch cannot repeat committed work, unknown admission configuration stays closed, budget exhaustion refuses before CPU execution, and cleanup removes expired reports/private snapshots according to the chosen retention.
- [ ] Verify Paper fidelity and all accessible interactions at 1440/768/390/320px, 200% text/zoom, keyboard-only and manual screen-reader checks. Verify minimum touch targets, focus rings/return, error links, status announcements, reduced motion and keyboard/safe-area behavior. Automated accessibility scans supplement these checks.
- [ ] Configure isolated unit/UI CI plus an explicit native/DB integration job with pinned binaries. Cloud benchmark/staging tests run deliberately with bounded credentials, not on arbitrary forked PRs. Finish with:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:sim
pnpm exec tsx scripts/check-top-gear-design.ts
pnpm exec tsx scripts/check-spec-coverage.ts
pnpm exec playwright test
pnpm build
```

- [ ] Document environment setup, migrations, outbox reconciliation, key management, queue shutdown, version rollback, report expiry, simulator attribution and asset notices. Prepare a reviewable staging build; production target/publishing remain an execution authorization decision. Commit `test: verify Top Gear release readiness` only with recorded evidence; list unfinished external checks honestly.

## Completion and scope traceability

| Requirement | Tasks / acceptance |
| --- | --- |
| Equipped + carried bags, duplicate copies, immutable enhancements | T3, T4, T8; import and inventory preservation tests |
| All supported DPS specs and simulator defaults | T2, T3, T10; registry and real parity evidence |
| Full combinations, quantities, locks, paired slots and tier effects | T4, T5; manually enumerated and real native fixtures |
| No mandatory cap / automatic gem repair | T4, T8, T9; legal candidate inclusion and actual stat details |
| Free work limit with separate C charge | T4, T6, T8; 60/61 fixture boundary, overflow and server reservation |
| Multiple ranked complete sets, uncertainty and exact swaps | T5, T9; six-set fixture, full slots, unchanged numeric reference |
| External fixed workers, durable retry/cancel/partial reports | T6, T7, T9; DB/provider/native-process tests |
| Public anonymous mobile/desktop flow | T1, T8–T10; end-to-end and accessibility checks |
| Future loot/token/billing capabilities | Explicitly deferred; not prerequisites for Top Gear |

This focused plan supersedes the broad C0–C15 execution order for the first Top Gear release only. The broader roadmap still records future tools; its loot/acquisition/billing-policy tasks must not creep into this slice. Adaptive refinement is a future improvement after the initial uniform-sampling release is measured. No production entitlement or runtime cost is established by the illustrative design fixtures.

## Verified primary references and remaining evidence

The existing exporter has character/bag paths; its real-client behavior still requires T10 evidence. See the [pinned exporter source](https://github.com/Poli93/wowsimsexporter-wotlk-335/blob/e69635092425bf4beadca22570fc7b975a73c95e/WowSimsExporter/WowSimsExporter.lua). The native boundary is grounded in the [pinned CLI command](https://github.com/Poli93/wotlk/blob/563e4a08cb15729f1fdcbcf68e6d68224553bfef/cmd/wowsimcli/cmd/basic_sim.go); the thin overlay adds structured output without replacing the simulator.

Trigger custom queues can share a concurrency cap, but subtasks do not inherit it and per-user concurrency keys create separate queues. The plan therefore starts with one explicitly queued task and one subprocess per active task. See [Trigger concurrency documentation](https://trigger.dev/docs/queue-concurrency). Node 24 is an available worker runtime; verify the installed SDK/build extension configuration at execution using the [runtime configuration documentation](https://trigger.dev/docs/config/config-file). These sources were rechecked while planning on 2026-09-08; no native build or Trigger deployment was performed.
