# Gear Lab Purchase Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline unless the user explicitly authorizes delegation.

**Goal:** Let a player enter T9/T10 resources, compare affordable complete gear sets, and see the purchases and upgrades needed for the selected result.

**Architecture:** Introduce a pure purchase domain that derives candidates from a versioned recipe catalog and proves joint affordability during gear enumeration. Keep the submitted wallet separate from owned inventory, run the same bounded analysis in a browser worker and at server admission, and freeze acquisition metadata in the existing job plan/report JSONB. Extend the current Gear Lab and report components with the approved Paper surfaces.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript 5.9.3, Base UI 1.8.0, Zod 4.5.4, next-intl 4.14.2, PostgreSQL, Trigger.dev, Vitest, and Playwright; existing native Wrath simulator.

**Spec:** [Gear Lab: tokens and purchase planning](../../design/tokens-purchase-planning.md). Read the spec and this plan before implementation. [Approved Paper page](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/10-0).

## Global Constraints

- Plan and implement within the existing Next.js 16.3.4, React 19.2.8, TypeScript 5.9.3, Base UI 1.8.0, Zod 4.5.4, and next-intl 4.14.2 stack; use Node 24.x and pnpm 10.33.0.
- Read the installed Next.js guides before writing framework code; do not upgrade dependencies for this feature.
- Support both `original` and `classic` item profiles and both `en-US` and `pt-BR` locales.
- Keep existing inventory selection, four slot filters, per-slot Add custom item, item enhancement editing, and full report gear/stat comparisons.
- Reuse shared Dialog, Button, and NumberInput components and the existing CSS tokens; do not introduce a separate visual theme.
- Enforce the current server WorkPolicy; do not increase simulation allowances or native simulator iterations to accommodate purchases.
- Treat entered balances as simulation inputs scoped to a draft, never as an account wallet or an actual purchase operation.
- Preserve legacy drafts, requests, and reports that have no purchase inputs.
- Keep reports reproducible using frozen purchase inputs, recipes, and acquisition details; never reprice a stored report from the current wallet.
- Do not let hypothetical custom items satisfy physical upgrade prerequisites or bypass purchase costs for tier rewards controlled by this planner.

## Scope and repository evidence

This is one deliverable with nine reviewable tasks, ordered by dependency. Tasks 1–4 establish the shared domain; Task 5 integrates execution; Tasks 6–8 implement the user flow; Task 9 verifies the complete feature. Do not ship a wallet that generates unconstrained gear combinations.

The proposed scope excludes arbitrary manual item groups, real purchases, account wallets, and native simulator changes. Remove the Advanced item groups affordance from the production version of these designs until that feature exists. The spec explicitly records the proposed handling of manually added tier candidates and equivalent-cost path ordering; implement those rules consistently rather than inventing different behavior in the UI and server.

Current integration points, inspected September 12, 2026:

| Existing file | Relevant behavior and planned change |
| --- | --- |
| `src/domain/top-gear/model.ts` | Add optional purchase inputs and frozen report/plan metadata; derived purchase source is internal only |
| `src/domain/top-gear/request-schema.ts` | Preserve legacy decoding; validate wallet inputs; reject client-generated inventory and costs |
| `src/domain/equipment/catalog.ts` | Item IDs, restrictions, and profile support; no existing purchase price/upgrade graph |
| `src/domain/equipment/enumerate.ts` | Currently estimates raw products and deduplicates legal gear before resource checks; add bounded constraint hooks |
| `src/domain/equipment/validate.ts` | Keep equipment legality; extend generated-item eligibility checks to include faction/profession rules |
| `src/domain/equipment/item-enhancements.ts` | Existing physical-instance overrides; wrap for generated reward overrides |
| `src/server/jobs/admit.ts` | Currently reserves from an unconstrained estimate; use server purchase analysis and persist its plan |
| `src/server/jobs/work.ts` | Currently reconstructs a plan if absent; hydrate purchase snapshots from frozen plan before evaluation |
| `src/server/reports/projection.ts` | Rank with hydrated inventory and attach frozen acquisition data to each row |
| `src/server/reports/read.ts` | Preserve acquisition fields through pagination and pinned rows |
| `src/features/inventory/TopGearApp.tsx` | Owns draft edits, allowance, and submission; coordinate resource state and latest worker analysis |
| `src/features/inventory/InventorySelector.tsx` | Retain four filters, rows, and Add custom item; merge derived purchase rows |
| `src/features/inventory/RunSetup.tsx` | Compact wallet summary, current allowance state, compare action |
| `src/features/reports/ReportView.tsx` | Selected combination and Edit flow; show selected purchase plan and restore original inputs |
| `src/features/import/draft-store.ts` | Existing local draft key and equality-based cleanup; extend round-trip tests without changing storage key |

No migration is required: `tg_jobs.request`, `plan`, and `report` already use JSONB (`drizzle/0000_top_gear.sql`). Do not bump `data/wotlk/versions.json` merely to add optional purchase inputs; its exact global-version validation would invalidate unrelated drafts. Use a purchase-specific schema and recipe revision.

Before framework changes, read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. Keep the catalog and solver free of server-only imports so they can execute in a browser worker.

## Shared contracts

Task 1 creates `src/domain/purchases/model.ts`. Later tasks consume these exact types. Import `ItemVersion`, `ItemInstance`, `ItemEnhancementOverride`, `Loadout`, `Snapshot`, `Selection`, `TopGearRequest`, `RunPlan`, `Allowance`, `Diagnostic`, and `WorkPolicy` from their existing domain modules where needed. All persisted collections below are JSON-compatible; runtime catalog indexes may use Maps.

```ts
export type TokenFamily = "vanquisher" | "protector" | "conqueror";
export type ResourceId =
  | "frost" | "triumph" | "trophy"
  | `regalia:${TokenFamily}`
  | `mark:normal:${TokenFamily}`
  | `mark:heroic:${TokenFamily}`;
export type ResourceAmounts = Partial<Record<ResourceId, number>>;
export type PurchaseInputs = {
  version: 1;
  recipeRevision: string;
  balances: ResourceAmounts;
  excludedItemIds: Partial<Record<ItemVersion, number[]>>;
  itemEnhancements: Partial<Record<ItemVersion,
    Record<string, ItemEnhancementOverride>>>; // decimal reward item IDs
};
export type PurchaseRecipe = {
  id: string; // e.g. t10-dk-dps-shoulder-264
  itemId: number;
  tier: 9 | 10;
  itemLevel: 232 | 245 | 258 | 251 | 264 | 277;
  setVariant: string; // stable class + variant, never a translated name
  slot: "head" | "shoulder" | "chest" | "hands" | "legs";
  classId: number;
  faction: "alliance" | "horde" | "both";
  profiles: ItemVersion[];
  cost: ResourceAmounts;
  prerequisiteItemId?: number;
  sourceUrls: string[];
};
export type PurchaseCatalog = {
  revision: string;
  recipes: readonly PurchaseRecipe[];
  byItemId: ReadonlyMap<number, PurchaseRecipe>;
};
export type AcquisitionStep = {
  recipeId: string;
  itemId: number;
  resultId: string; // generated final ID or stable intermediate step ID
  prerequisite?: { itemId: number; instanceId?: string; stepId?: string };
  cost: ResourceAmounts;
};
export type PurchasePlan = {
  steps: AcquisitionStep[]; // topological order, prerequisites first
  spent: ResourceAmounts;
  remaining: ResourceAmounts;
  consumedInstanceIds: string[];
};
export type PurchaseCandidate = {
  instance: ItemInstance; // source purchase, stable ID, no equippedSlot
  recipeId: string;
  included: boolean;
  available: boolean;
  missing: Array<{ resourceId?: ResourceId; itemId?: number; quantity: number }>;
  paths: PurchasePlan[]; // individually affordable, nondominated paths
};
export type PreparedPurchases = {
  snapshot: Snapshot;
  selection: Selection;
  inputs: PurchaseInputs;
  candidates: PurchaseCandidate[];
  catalog: PurchaseCatalog;
};
export type FrozenPurchases = {
  version: 1;
  recipeRevision: string;
  inputs: PurchaseInputs;
  recipes: PurchaseRecipe[]; // recipes referenced by candidates/steps only
  generatedItems: ItemInstance[];
  effectiveEnhancements: Record<string, ItemEnhancementOverride>;
  plansByLoadoutKey: Record<string, PurchasePlan>;
};
export type PurchaseAnalysis =
  | { status: "complete"; plan: RunPlan; visitedNodes: number;
      excludedByEnhancements: number; diagnostics: Diagnostic[] }
  | { status: "no-legal-sets"; visitedNodes: number; diagnostics: Diagnostic[] }
  | { status: "over-limit"; allowance: Allowance; visitedNodes: number }
  | { status: "search-limit"; visitedNodes: number }
  | { status: "catalog-changed"; currentRevision: string };
```

Add `purchases?: PurchaseInputs` to `TopGearRequest`, `purchases?: FrozenPurchases` to `RunPlan`, and `purchasePlan?: PurchasePlan` to `SetRow`. Reports add `purchases?: { inputs: PurchaseInputs; recipeRevision: string; recipes: PurchaseRecipe[]; originalSnapshot: Snapshot }`. `originalSnapshot` records the input inventory and overrides before candidate generation; encode/decode its protobuf settings exactly as for the report snapshot. Add `"purchase"` to the internal `ItemInstance.source` union, but **not** to the request inventory source enum. Keep these imports type-only to avoid runtime cycles.

## Task 1: Add the verified tier purchase catalog and contracts

**Files**

- Create: `src/domain/purchases/model.ts`, `src/domain/purchases/catalog.ts`, `src/domain/purchases/catalog.test.ts`.
- Create: `data/wotlk/purchases.json`, `tools/data/purchases.ts`, `docs/design/tier-purchase-data.md`.
- Modify: `tools/data/generate.ts`, `src/domain/top-gear/model.ts`.
- Modify source-union consumers: `src/components/items/ItemSourceIcon.tsx`, `src/features/inventory/Item.tsx`, `messages/en-US/inventory.json`, `messages/pt-BR/inventory.json`.
- Create test support: `tests/support/purchase-fixtures.ts`.

**Interfaces**

- Produces `getPurchaseCatalog(version: ItemVersion): PurchaseCatalog` and `tokenFamilyForClass(classId: number): TokenFamily` in `catalog.ts`.
- Produces `purchaseFixture(balances?: ResourceAmounts): TopGearRequest` and `purchasePolicy: WorkPolicy` in test support.
- Consumes existing `getCatalog(version)`, `defaultSettings(id)`, `listSpecs()`, `emptyLoadout()`, and `itemVersions`.

- [x] **1. Write catalog contract tests and the deterministic fixture.** Build the fixture from the deathknight preset whose name matches `/frost/i`, `defaultSettings`, and `Race.RaceOrc`; import current versions and profile revision. Inventory contains `owned-legs` (item 48504, source equipped, slot legs, no gems/enchant), `equipped = { ...emptyLoadout(), legs: "owned-legs" }`, and selection contains that ID. This intentionally small fixture is for domain tests, not native DPS realism. Default profile is `original`, default balances `{}`, and purchase revision comes from the catalog. Export policy `{version:"purchase-test", unitsPerSet:20, maxUnits:20000, iterationsPerSet:20, maxSearchNodes:100000, maxJobSeconds:60, maxAttempts:1}`.

```ts
import { expect, it } from "vitest";
import { getPurchaseCatalog, tokenFamilyForClass } from "./catalog";

it.each(["original", "classic"] as const)("keeps exact DK shoulder chains in %s", (v) => {
  const c = getPurchaseCatalog(v);
  expect(c.byItemId.get(50098)?.cost).toEqual({ frost: 60 });
  expect(c.byItemId.get(51125)?.prerequisiteItemId).toBe(50098);
  expect(c.byItemId.get(51314)?.prerequisiteItemId).toBe(51125);
  expect(c.byItemId.get(51130)?.prerequisiteItemId).toBe(50853);
  expect(c.byItemId.get(51309)?.prerequisiteItemId).toBe(51130);
  expect(c.byItemId.get(48494)?.cost).toEqual({ "regalia:vanquisher": 1 });
  expect(c.byItemId.get(48494)?.prerequisiteItemId).toBeUndefined();
  expect(tokenFamilyForClass(10)).toBe("vanquisher");
});
```

- [x] **2. Run the red test.** `pnpm exec vitest run --project unit src/domain/purchases/catalog.test.ts` must fail because the catalog module is absent, before implementation.
- [x] **3. Add the shared types and catalog loader.** Load the JSON manifest once, index recipes by item ID for each supported profile, and reject duplicate recipe/item IDs, missing catalog items, invalid/negative costs, unknown resources, cycles, wrong slot/class/variant predecessors, and incorrect faction/profile membership. Require prerequisite chains to be complete. Token-family lookup rejects unsupported classes rather than defaulting to a family. When adding the internal purchase source, add its shared source icon and both locale labels, and make Item's source description explicit; these union consumers must compile in this task before the wallet UI exists. Keep the incoming request source enum unchanged.
- [x] **4. Create the explicit manifest with provenance.** Record every supported T9/T10 class, faction, set variant, slot, and quality; audit item-specific vendor costs and upgrade requirements. Use the spec's resource table as the expected matrix, not a substitute for item evidence. Record source URL, checked date, item ID, cost, predecessor ID, and any excluded unsupported ID in `tier-purchase-data.md`. Use existing catalog IDs and generated restrictions; the pinned upstream database intentionally excludes some duplicate T9 IDs. Do not infer a chain from names alone or assume five total rewards per class.
- [x] **5. Add deterministic data validation to generation.** `tools/data/purchases.ts` exports `validatePurchaseManifest(): void`; `tools/data/generate.ts` calls it after refreshing the base data. Keep the manifest an explicit reviewed input. Compute a recipe revision from normalized manifest content, excluding source check dates, so changed prices/IDs change the revision. Runtime performs no vendor network requests.

```ts
// Within validatePurchaseManifest, for every supported profile and recipe:
const item = getCatalog(profile).items.get(recipe.itemId);
if (!item) throw new Error(`Missing ${profile} purchase item ${recipe.itemId}`);
if (recipe.prerequisiteItemId !== undefined) {
  const previous = catalog.byItemId.get(recipe.prerequisiteItemId);
  if (!previous || previous.slot !== recipe.slot ||
      previous.classId !== recipe.classId || previous.setVariant !== recipe.setVariant)
    throw new Error(`Invalid predecessor for ${recipe.id}`);
}
```

- [x] **6. Add full-matrix invariants and run green.** Assert all registered supported variants have the intended slots/qualities, both factions where appropriate, no cross-family costs, correct T9 direct purchases, and exact T10 predecessor IDs. Run the Task 1 test and `pnpm typecheck`; inspect the manifest diff without rewriting unrelated generated data.
- [x] **7. Commit this deliverable.** Stage only Task 1 files and commit `feat: add verified tier purchase catalog`.

## Task 2: Add validated wallet inputs and draft state operations

**Files**

- Create: `src/domain/purchases/state.ts`, `src/domain/purchases/state.test.ts`, `src/domain/purchases/schema.ts`.
- Modify: `src/domain/top-gear/request-schema.ts`, `src/domain/top-gear/request-schema.test.ts`, `src/features/import/draft-store.test.tsx`.
- Modify: `messages/en-US/diagnostics.json`, `messages/pt-BR/diagnostics.json`.

**Interfaces**

- Consumes Task 1 contracts/catalog and existing `encodeRequest`, `decodeDraft`, `validateRequest`.
- Produces `setResourceBalance(request: TopGearRequest, id: ResourceId, quantity: number): TopGearRequest`.
- Produces `removeResource(request: TopGearRequest, id: ResourceId): TopGearRequest`.
- Produces `setPurchaseExcluded(request: TopGearRequest, itemId: number, excluded: boolean): TopGearRequest`.
- Produces `revalidatePurchaseInputs(request: TopGearRequest): { request: TopGearRequest; removedItemIds: number[] }` for explicit acknowledgment of a changed catalog.

- [x] **1. Write the state and wire boundary tests.** Cover replace-versus-increment, removal of the final entry, profile-specific exclusions, legacy requests, recipe revision retention during draft decode, forged purchase items, and quantity limits.

```ts
import { expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { setResourceBalance } from "./state";
import { decodeDraft, encodeRequest, validateRequest } from "@/domain/top-gear/request-schema";

it("replaces a balance and preserves purchase inputs through a draft", () => {
  const request = purchaseFixture({ frost: 100 });
  const edited = setResourceBalance(request, "frost", 60);
  expect(edited.purchases?.balances.frost).toBe(60);
  expect(request.purchases?.balances.frost).toBe(100);
  expect(decodeDraft(encodeRequest(edited)).purchases).toEqual(edited.purchases);
});
it.each([-1, 1.5, 1_000_001, Infinity])("rejects invalid quantity %s", (quantity) => {
  const wire = encodeRequest(purchaseFixture({ frost: quantity }));
  expect(() => validateRequest(wire)).toThrow();
});
```

- [x] **2. Run red.** `pnpm exec vitest run --project unit src/domain/purchases/state.test.ts src/domain/top-gear/request-schema.test.ts` must fail on the new purchase assertions.
- [x] **3. Implement strict purchase input parsing.** Use Zod 4: exactly the 12 ResourceId keys, integer quantities 0–1,000,000, at most 1,000 distinct excluded IDs and 1,000 override entries per profile, bounded positive decimal item IDs, existing enhancement shape validation, and a bounded recipe revision string. Current-revision submission validates ID membership against the purchase manifest; stale draft decoding retains structurally valid retired IDs so revalidation can explain their removal. Reject additional fields such as `spent`, `price`, or a client plan. Reject generated IDs in submitted selected/equipped/locked/override inventory references. Retain existing imported/custom inventory limits. Zero is a valid saved balance; an empty resource map removes `request.purchases`.
- [x] **4. Implement immutable state transitions.** Preserve balances on profile/settings changes, write exclusions against `itemVersionOf(request.snapshot)`, and sort/deduplicate stable collections before encoding. Do not mutate the request passed to a state function. New character import already constructs a new request: ensure it omits purchases. A stale recipe revision may decode for editing; submission rejects it with a localized catalog-change diagnostic until `revalidatePurchaseInputs` reconciles IDs and updates the revision.

```ts
// Core update within setResourceBalance, after quantity and family validation:
const current = request.purchases ?? {
  version: 1 as const,
  recipeRevision: getPurchaseCatalog(itemVersionOf(request.snapshot)).revision,
  balances: {}, excludedItemIds: {}, itemEnhancements: {},
};
return { ...request, purchases: {
  ...current, balances: { ...current.balances, [id]: quantity },
} };
```

- [x] **5. Run green and regression checks.** Run the Task 2 unit files, `pnpm exec vitest run --project ui src/features/import/draft-store.test.tsx`, and `pnpm exec vitest run --project unit src/i18n/messages.test.ts`. Verify the legacy encoded request still omits the purchase property.
- [x] **6. Commit.** Stage Task 2 files and commit `feat: persist validated gear lab resource inputs`.

## Task 3: Derive candidates and solve acquisition paths

**Files**

- Create: `src/domain/purchases/candidates.ts`, `src/domain/purchases/acquisition.ts`, `src/domain/purchases/enhancements.ts`.
- Create tests: `src/domain/purchases/candidates.test.ts`, `src/domain/purchases/acquisition.test.ts`, `src/domain/purchases/enhancements.test.ts`.
- Create: `src/domain/equipment/search-budget.ts`, `src/domain/equipment/search-budget.test.ts`.
- Modify: `src/domain/equipment/validate.ts`.
- Create test: `src/domain/equipment/purchase-eligibility.test.ts`.

**Interfaces**

- Produces `createSearchBudget(maxNodes: number): SearchBudget`, `SearchLimitError`, and `SearchBudget = { readonly visitedNodes: number; visit(): void }`.
- Produces `preparePurchases(request: TopGearRequest, budget: SearchBudget): PreparedPurchases`; requires purchase inputs.
- Produces `solveAcquisition(prepared: PreparedPurchases, loadout: Loadout, budget: SearchBudget): PurchasePlan | null`.
- Produces `comparePurchasePlans(a: PurchasePlan, b: PurchasePlan): number` for equivalent final gear.
- Produces `setPurchaseEnhancements(request: TopGearRequest, itemId: number, override: ItemEnhancementOverride): TopGearRequest`.
- Consumes existing catalog equipment eligibility, `validateItemEnhancements`, and Task 2 input state.

- [x] **1. Write exact acquisition tests.** Cover A3–A9 and A12, including both owned and bought prerequisite paths, simultaneous final pieces, consuming one instance once, faction and alternate set variants. The following test proves the initial T10 purchase plus upgrade is charged together:

```ts
import { expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { preparePurchases } from "./candidates";
import { solveAcquisition } from "./acquisition";
import { createSearchBudget } from "@/domain/equipment/search-budget";

it("buys a base shoulder before using a normal Mark", () => {
  const budget = createSearchBudget(100000);
  const prepared = preparePurchases(purchaseFixture({
    frost: 60, "mark:normal:vanquisher": 1,
  }), budget);
  const plan = solveAcquisition(prepared, {
    ...prepared.snapshot.equipped, shoulder: "purchase-original-51125",
  }, budget);
  expect(plan?.steps.map((s) => s.itemId)).toEqual([50098, 51125]);
  expect(plan?.spent).toEqual({ frost: 60, "mark:normal:vanquisher": 1 });
  expect(plan?.remaining).toEqual({ frost: 0, "mark:normal:vanquisher": 0 });
});
```

- [x] **2. Run red.** `pnpm exec vitest run --project unit src/domain/purchases/acquisition.test.ts src/domain/purchases/candidates.test.ts` fails before implementing the modules.
- [x] **3. Build candidate derivation.** Filter by profile/class/faction and existing equipment restrictions. Keep all compatible variants in review, including unavailable rewards with structured missing-resource/prerequisite reasons. Add only available, included candidates to the effective selection; retain original inventory in the input request. Use `purchase-${profile}-${itemId}`, zero gems/enchant, source purchase, and no equipped slot. An excluded final reward may still appear as a prerequisite step. Use owned items from the entire imported inventory for acquisition, including unchecked bag/equipped items.
- [x] **4. Handle custom/owned duplicates visibly.** When planning is active, replace selected custom tier reward alternatives in the effective selection with their costed representation. Keep their original draft entries intact for editing and disabling the wallet. Map their enhancement intent to the costed candidate unless an explicit purchase override exists. Physical imported items remain independent zero-cost alternatives; do not remove them merely because their item ID equals a reward. Generated items must pass faction checks currently applied to custom items as well as class/slot legality.
- [x] **5. Implement the bounded joint solver.** Resolve each final purchase through its recipe DAG. At each node branch between eligible owned predecessors and recursively purchased predecessors. Reserve every final equipped physical ID before resolving prerequisites. Track spent resource vectors, consumed physical IDs, intermediate steps, and stable final IDs. Prune a branch as soon as a resource exceeds its balance. Memoization keys must include remaining resources, unresolved rewards, and reserved/consumed ownership identities; never memoize only by reward ID. Keep incomparable resource/ownership states, and apply the spec tie-break only after proving complete affordability. Every branch expansion calls the shared budget meter.

```ts
// Shared feasibility invariant inside branch expansion:
for (const [resource, amount] of Object.entries(nextSpent)) {
  if (amount > (prepared.inputs.balances[resource as ResourceId] ?? 0))
    return; // discard this branch, retain other acquisition paths
}
// A physical predecessor cannot survive in the final loadout:
if (Object.values(loadout).includes(predecessor.instanceId)) return;
if (consumedInstanceIds.has(predecessor.instanceId)) return;
```

- [x] **6. Implement purchase enhancement overrides.** Derive the target item in a temporary effective snapshot, validate with existing enhancement rules, normalize the override, and persist it under profile + decimal item ID in PurchaseInputs. The effective snapshot merges that override onto the generated instance ID. Do not copy gems/enchant from a consumed prerequisite. Keep automatic gem/enchant policies in the existing enumeration/evaluation path.
- [x] **7. Run green.** Run all three new purchase tests, the search-budget test, the purchase-eligibility test, and `src/domain/equipment/item-enhancements.test.ts`. Assert preparation/solving never changes the encoded input request and that a zero-spend plan has `steps: []`, `spent: {}`, and every entered balance in `remaining`.
- [x] **8. Commit.** Stage Task 3 files and commit `feat: solve affordable tier purchase and upgrade paths`.

## Task 4: Integrate resource constraints into bounded combination planning

**Files**

- Modify: `src/domain/equipment/enumerate.ts`, `src/domain/equipment/enumerate.test.ts`.
- Create: `src/domain/purchases/analysis.ts`, `src/domain/purchases/analysis.test.ts`, `src/domain/purchases/frozen.ts`, `src/domain/purchases/frozen.test.ts`.

**Interfaces**

- Add an optional sixth argument to `enumerateLoadouts`: `options?: { budget?: SearchBudget; deduplicate?: boolean; acceptPartial?: (loadout: Loadout, assignedSlots: readonly Slot[]) => boolean; acceptComplete?: (loadout: Loadout) => boolean }`. Defaults preserve every current caller's behavior.
- Produces `analyzePurchaseSelection(request: TopGearRequest, policy: WorkPolicy, onPrepared?: (prepared: PreparedPurchases) => void): PurchaseAnalysis`. The optional callback lets the browser return candidate review data without running preparation twice; the server omits it.
- Produces `hydratePurchaseSnapshot(original: Snapshot, frozen: FrozenPurchases): Snapshot` in `frozen.ts`.
- Consumes Task 3 preparation/solver/budget, `loadoutKey`, `allowanceForCount`, existing gem/enchant analysis, and `alignPairedSlots`.

- [x] **1. Add a regression proving that the raw product is not the purchase allowance.** Add tests for zero spend, 100 versus 120 Frost, deduplication after affordability, duplicate ownership paths, no legal final sets, baseline exactly once, exact node limits, and enhancement-invalid sets.

```ts
import { expect, it } from "vitest";
import { purchaseFixture, purchasePolicy } from "../../../tests/support/purchase-fixtures";
import { analyzePurchaseSelection } from "./analysis";

it("never combines two new 60-Frost purchases with a 100-Frost wallet", () => {
  const result = analyzePurchaseSelection(purchaseFixture({ frost: 100 }), purchasePolicy);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(result.status);
  const plans = Object.values(result.plan.purchases!.plansByLoadoutKey);
  expect(plans.some((p) => p.spent.frost === 60)).toBe(true);
  expect(plans.every((p) => (p.spent.frost ?? 0) <= 100)).toBe(true);
  expect(result.plan.allowance.count).toBe(result.plan.simulations.length);
  expect(new Set(result.plan.simulations.map((s) => s.key)).size)
    .toBe(result.plan.simulations.length);
});
```

- [x] **2. Run red.** `pnpm exec vitest run --project unit src/domain/purchases/analysis.test.ts src/domain/equipment/enumerate.test.ts` fails on the new analyzer assertions.
- [x] **3. Add bounded enumeration hooks without changing legacy ordering or keys.** Use the passed budget for DFS visits; call partial checks only with assigned slots so stale/unassigned slot values cannot cause incorrect pruning. Check complete affordability after equipment/enhancement legality but before `seen.add(key)`. Purchase analysis sets `deduplicate: false` and chooses the best feasible acquisition plan in its own map keyed by `loadoutKey`; replace the representative loadout and its acquisition explanation together so consumed-instance IDs still match the actual simulated arrangement. Legacy enumeration still deduplicates normally. Partial checks use only sound lower bounds: never reject a state because one greedy acquisition path failed.
- [x] **4. Build the purchase analyzer.** Share one search-node budget across candidate preparation, acquisition branching, and gear DFS. Count distinct affordable simulations including the reference exactly once. Preserve current seeds, iteration policy, baseline enhancement behavior, and full-set native simulation. Stop as soon as the number of distinct required simulations exceeds `floor(policy.maxUnits / policy.unitsPerSet)`, or the search meter reaches its bound. At completion produce a normal RunPlan with purchase metadata. Do not call the legacy unconstrained `planRun` inside this branch: its preliminary estimate can wrongly reject the request.

```ts
// Budget states have different meanings and must remain distinct:
if (distinctSimulationCount > Math.floor(policy.maxUnits / policy.unitsPerSet)) {
  return { status: "over-limit", visitedNodes: budget.visitedNodes,
    allowance: allowanceForCount(distinctSimulationCount, policy, "over-limit") };
}
// Catch only the typed budget error; propagate programming/data errors.
if (error instanceof SearchLimitError)
  return { status: "search-limit", visitedNodes: budget.visitedNodes };
```

- [x] **5. Freeze and hydrate purchase metadata.** Freeze original input balances/revision, referenced recipe details, generated instances, effective overrides, and canonical-key acquisition plans. Baseline metadata is zero spend. If there are no legal candidates, return `no-legal-sets` even though an equipped reference exists. `hydratePurchaseSnapshot` merges generated items and overrides into a new snapshot without reading the current purchase catalog; reject duplicate generated IDs in persisted metadata rather than overwriting physical inventory.
- [x] **6. Run green and bounded stress cases.** Run the Task 4 tests plus `src/domain/equipment/item-enhancements.test.ts` and `src/domain/top-gear/report.test.ts`. Use deterministic counters, not fragile wall-clock assertions: assert `visitedNodes <= maxSearchNodes` and safe termination for many gear choices. For the raw-product regression, analyze the 100-Frost fixture with the generous test policy, then rerun with `maxUnits = complete.plan.simulations.length * unitsPerSet`; assert completion at exactly that limit while the legacy estimate of its prepared candidate pool exceeds it. Ensure reports without purchases preserve their existing simulation keys and ordering.
- [x] **7. Commit.** Stage Task 4 files and commit `feat: enumerate gear sets within shared resource budgets`.

## Task 5: Admit, execute, and project frozen purchase runs

**Files**

- Modify: `src/server/jobs/admit.ts`, `src/server/jobs/work.ts`, `src/server/reports/projection.ts`, `src/server/reports/read.ts`.
- Modify: `src/server/http/api.ts`, `src/server/http/api.test.ts`.
- Modify: `src/features/inventory/admission-attempt.ts`, `src/features/inventory/admission-attempt.test.ts`.
- Create: `tests/integration/purchase-admission.test.ts`, `tests/integration/purchase-work.test.ts`.
- Modify: `messages/en-US/diagnostics.json`, `messages/pt-BR/diagnostics.json`.

**Interfaces**

- Consumes `analyzePurchaseSelection`, `hydratePurchaseSnapshot`, frozen RunPlan metadata, and existing `admitJob`, `projectReport`, `rankResults`, `loadoutKey`, `encodeSnapshot`, and `decodeSnapshot`.
- Preserves the existing public `admitJob` signature and response. Its purchase branch persists a complete plan at admission; legacy jobs retain their current path.
- Extends `AdmissionError` with an optional third argument `diagnostic?: { code: DiagnosticCode; params?: Record<string, string | number> }`, using `DiagnosticCode` from `src/i18n/error.ts`. `failure` in `src/server/http/api.ts` preserves the existing HTTP status and emits this structured diagnostic when supplied.
- Report encoding handles the optional nested `purchases.originalSnapshot`; report reading never reconstructs resource costs from the current catalog.

- [x] **1. Write admission and frozen-execution tests.** Use `createTestDatabase`/`dropTestDatabase` from `tests/support/database.ts`, the test pool, and the existing admission test lifecycle. Set the test capability key and truncate only inside that isolated test database. Assert the persisted plan contains actual affordable simulation count and metadata before work starts.

```ts
// In purchase-admission.test.ts, with the existing isolated DB lifecycle:
it("freezes costs before reserving the purchase run", async () => {
  const admitted = await admitJob({
    request: encodeRequest(purchaseFixture({ frost: 100 })),
    ownerKey: randomUUID(), idempotencyKey: randomUUID(),
  });
  const { rows: [job] } = await pool.query(
    "SELECT request,plan FROM tg_jobs WHERE id=$1", [admitted.jobId],
  );
  expect(job.request.snapshot.inventory.some((i: ItemInstance) => i.source === "purchase"))
    .toBe(false);
  expect(job.plan.purchases.inputs.balances).toEqual({ frost: 100 });
  expect(job.plan.allowance.count).toBe(job.plan.simulations.length);
});
```

- [x] **2. Run red.** `pnpm exec vitest run --project integration tests/integration/purchase-admission.test.ts tests/integration/purchase-work.test.ts` fails on absent frozen purchase metadata.
- [x] **3. Integrate admission.** For new purchase runs, validate and analyze on the server before budget reservation. Convert non-complete states to localized 422 diagnostics: `purchaseNoLegalSets`, `purchaseAllowanceExceeded`, `purchaseSearchLimit`, `purchaseCatalogChanged`. Reserve exactly `analysis.plan.allowance.units * policy.maxAttempts` through the existing atomic account/concurrency/budget transaction. Insert the validated original request and frozen plan together; do not trust browser analysis or replace resource quantities with client-reported costs. Keep the legacy estimate path when purchases are absent. Extend the browser admission-attempt definitive initial 422 code list for the new purchase validation/analysis diagnostics; a later rejection must never unlock an earlier uncertain submission. Add regression cases for initial rejection versus a network-uncertain retry.

```ts
// Inside the purchase branch, after ownership/idempotency handling:
const analysis = analyzePurchaseSelection(request, policy);
if (analysis.status === "search-limit") {
  throw new AdmissionError("Purchase search limit reached", 422, {
    code: "purchaseSearchLimit",
  });
}
// Match every other non-complete status explicitly before reading analysis.plan.
```

- [x] **4. Preserve idempotency and retries across catalog changes.** Perform bounded structural parsing and authorized existing-intent/prior-job lookup before requiring the current recipe revision. For an exact existing intent, return its stored admission response; do not reject it merely because a later deployment changed recipes. For an authorized retry with the same original inputs, reuse the persisted purchase plan and resource explanation. Changed balances, exclusions, profile, or overrides create a fresh plan; they cannot reuse stale purchase metadata. Keep existing permission, expiration, same-request, iteration, and result-identity checks. Do not accept an arbitrary stale new request under the retry exception. If the current WorkPolicy differs, retain the frozen gear/acquisition space but recompute allowance and the simulation schedule for the current iteration/unit policy before reserving; reuse results only when the existing compatibility checks still pass. A retry cannot bypass a reduced current allowance by copying an old allowed flag.
- [x] **5. Hydrate worker evaluation.** For a purchase job, require `job.plan.purchases`; use `hydratePurchaseSnapshot(request.snapshot, job.plan.purchases)` for all item resolution, simulation inputs, gem/enchant preparation, and canonical keys. Continue with the stored plan after interruption and use the existing leases, cancellation, and retry machinery. Never regenerate candidates from a mutable wallet or a new price catalog mid-run. A malformed persisted purchase plan fails explicitly rather than falling back to unconstrained `planRun`.
- [x] **6. Project and store purchase reports.** Rank the existing results with the hydrated snapshot and frozen candidate loadouts. Attach each row's plan using `loadoutKey(hydrated, row.loadout, row.isEquipped)` with the same reference treatment used when the plan was built. Store original input snapshot, purchase inputs, and referenced recipes on the report. Preserve row metadata through `projectStoredReport` legacy reranking, pagination, and pinned rows. Never add resources to the simulation input hash or alter the DPS/recommendation comparator.
- [x] **7. Run green with lifecycle regressions.** Cover unchanged idempotency after a catalog revision, changed-wallet intent conflict, retry/resume, baseline exactly once, rejected forged requests with no budget reservation, partial report costs, selected-page/pinned-row metadata, and report encoding of both snapshots. Run Task 5 integration files, `tests/integration/admission.test.ts`, `tests/integration/orchestration.test.ts`, `tests/integration/parallel-work.test.ts`, and `src/server/http/api.test.ts` in their respective projects.
- [x] **8. Commit.** Stage Task 5 files and commit `feat: execute and retain reproducible purchase plans`.

## Task 6: Build the wallet and resource dialog using existing controls

**Files**

- Create: `src/features/inventory/purchases/ResourceWallet.tsx`, `src/features/inventory/purchases/ResourceDialog.tsx`, `src/features/inventory/purchases/resource-labels.ts`, `src/features/inventory/purchases/purchases.css`.
- Create tests: `src/features/inventory/purchases/ResourceWallet.test.tsx`, `src/features/inventory/purchases/ResourceDialog.test.tsx`.
- Modify: `messages/en-US/inventory.json`, `messages/pt-BR/inventory.json`.
- Reference without redesign: `src/components/ui/Dialog.tsx`, `src/components/ui/NumberInput.tsx`, `src/components/ui/Button.tsx`, `src/features/inventory/custom-items/custom-items.css`, `src/app/tokens.css`.

**Interfaces**

- Produces `ResourceWallet({ request, onChange, onReview }: { request: TopGearRequest; onChange: (request: TopGearRequest) => void; onReview: () => void })`.
- Produces `ResourceDialog({ request, resourceId, open, onOpenChange, onChange }: { request: TopGearRequest; resourceId?: ResourceId; open: boolean; onOpenChange: (open: boolean) => void; onChange: (request: TopGearRequest) => void })`.
- Consumes Task 2 state operations and Task 1 token family lookup. Resource labels and tier/quality grouping live in `inventory.purchases`, with exact locale key parity.

- [x] **1. Write dialog interaction tests.** Test atomic Save, Cancel/Escape discard, focus return, editing an existing resource without duplication, integer quantity behavior, T9/T10 quality descriptions, family filtering, zero quantity, removal, and locale changes while open. Wrap UI tests with `NextIntlClientProvider` using inventory/common/diagnostics JSON, and `ToastProvider` where needed, as in CustomItemPicker tests.

```tsx
// Inside ResourceDialog.test.tsx with the locale/provider wrapper:
it("does not apply an edited quantity until Save", async () => {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en-US"
      messages={{ inventory: enInventory, common: enCommon, diagnostics: enDiagnostics }}>
      <ResourceDialog request={purchaseFixture({ frost: 100 })}
        resourceId="frost" open onOpenChange={vi.fn()} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  const quantity = screen.getByRole("spinbutton", { name: "Quantity" });
  await userEvent.clear(quantity);
  await userEvent.type(quantity, "60");
  await userEvent.tab();
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Save resource" }));
  expect(onChange.mock.calls[0][0].purchases.balances.frost).toBe(60);
});
```

- [x] **2. Run red.** `pnpm exec vitest run --project ui src/features/inventory/purchases/ResourceDialog.test.tsx src/features/inventory/purchases/ResourceWallet.test.tsx` fails before the components exist.
- [x] **3. Build the resource selector and wallet.** Show T10 Frost/normal Mark/heroic Mark and T9 Triumph/Trophy/heroic Regalia with their reward item levels and prerequisite helper text. Currency quantity means emblems, token quantity means individual tokens. Resolve the family from the character instead of offering incompatible tokens. Use one shared Triumph resource entry. Selecting an already present resource loads its balance for replacement; do not add another wallet row. Keep unsaved dialog state local and call `onChange` once on Save.

```tsx
<NumberInput label={t("purchases.quantity")} value={quantity}
  onValueChange={setQuantity} min={0} max={1_000_000} step={1} />
<Button onClick={() => {
  onChange(setResourceBalance(request, selectedResource, quantity));
  onOpenChange(false);
}}>{t("purchases.saveResource")}</Button>
```

- [x] **4. Apply the approved responsive layout.** Use a 720px desktop resource dialog, 24px padding, shared 8px/4px radii, 44px controls, and 46px primary footer action. Reuse the custom-picker viewport/flex/overflow pattern; at mobile width fill the viewport, and retain a short-height escape hatch for keyboard/landscape. Match current app colors rather than Paper's older generic blue tokens. Use accessible labels for edit/remove and field validation; selected quality cannot be communicated only by color.
- [x] **5. Run green and locale checks.** Run Task 6 UI tests and `pnpm exec vitest run --project unit src/i18n/messages.test.ts`. Visually compare the component in the integrated Gear Lab in Task 7 against Paper boards TZ1-0, U4M-0, U6B-0, UBU-0, and UBV-0; do not add a permanent demo route.
- [x] **6. Commit.** Stage Task 6 files and commit `feat: add gear lab resource wallet and dialog`.

## Task 7: Integrate purchase review, enhancement editing, and asynchronous analysis

**Files**

- Create: `src/features/inventory/purchases/PurchasableItemsDialog.tsx`, `src/features/inventory/purchases/purchase-worker-contract.ts`, `src/features/inventory/purchases/purchase-analysis.worker.ts`, `src/features/inventory/purchases/usePurchaseAnalysis.ts`.
- Create tests: `src/features/inventory/purchases/PurchasableItemsDialog.test.tsx`, `src/features/inventory/purchases/usePurchaseAnalysis.test.tsx`.
- Modify: `src/features/inventory/TopGearApp.tsx`, `src/features/inventory/InventorySelector.tsx`, `src/features/inventory/InventoryItemRow.tsx`, `src/features/inventory/RunSetup.tsx`, `src/features/inventory/RunAllowance.tsx`, `src/features/inventory/purchases/purchases.css`.
- Modify tests: `src/features/inventory/InventorySelector.test.tsx`, `src/features/inventory/RunAllowance.test.tsx`, `src/features/inventory/TopGearApp.admission.test.tsx`.
- Modify: `messages/en-US/inventory.json`, `messages/pt-BR/inventory.json`.

**Interfaces**

- Produces `PurchasePreview = { snapshot: Snapshot; selection: Selection; candidates: PurchaseCandidate[] }`.
- Produces `PurchaseAnalysisState = { status: "idle" | "loading" } | { status: "ready"; analysis: PurchaseAnalysis; preview: PurchasePreview | null } | { status: "error"; diagnostic: Diagnostic }`.
- Produces `usePurchaseAnalysis(request: TopGearRequest | null, policy: WorkPolicy | null): PurchaseAnalysisState`.
- Produces `PurchasableItemsDialog({ request, preview, open, onOpenChange, onChange }: { request: TopGearRequest; preview: PurchasePreview | null; open: boolean; onOpenChange: (open: boolean) => void; onChange: (request: TopGearRequest) => void })`.
- Worker request: `{ revision: number; request: ReturnType<typeof encodeRequest>; policy: WorkPolicy }`. Worker reply echoes `revision`, contains `analysis` and nullable preview with `snapshot: ReturnType<typeof encodeSnapshot>`, or a structured diagnostic error. Encode/decode protobuf settings across the worker boundary; do not structured-clone a protobuf object and assume its prototype survived.
- Consumes Task 4 `onPrepared` callback to capture preview once and Task 3 purchase enhancement mutator. No new HTTP endpoint is required.

- [x] **1. Write stale-analysis and review tests.** Mock Worker in the hook test. Send replies out of order and prove only the newest request can enable Compare. Test worker termination on replacement/unmount; errors and search limits are not perpetual loading states. Review tests cover exclusions, unavailable exact upgrade paths, re-inclusion, per-profile overrides, consumed-item helper text, and custom tier rows marked Uses resources.

```tsx
// Core assertion in the mocked-worker hook test, after replies for revisions 1 and 2:
expect(result.current.status).toBe("ready");
if (result.current.status !== "ready") throw new Error("Expected current analysis");
expect(result.current.analysis).toEqual(secondReply.analysis);
expect(result.current.analysis).not.toEqual(firstReply.analysis);
expect(firstWorker.terminate).toHaveBeenCalled();
```

Define the test's `firstReply`/`secondReply` by calling `analyzePurchaseSelection` on `purchaseFixture({ frost: 100 })` and `purchaseFixture({ frost: 120 })` with `purchasePolicy`; capture callbacks in a mock Worker class and invoke its `onmessage` in reverse order with those revision numbers. Use `renderHook` and `act` from Testing Library. This tests observable cancellation behavior, not a duplicate of the solver.

- [x] **2. Run red.** Run the two new UI files plus the three modified UI test files with `pnpm exec vitest run --project ui` and explicit file paths.
- [x] **3. Implement the worker and hook.** Create the worker with `new Worker(new URL("./purchase-analysis.worker.ts", import.meta.url), { type: "module" })`. On every effective request/policy change invalidate the prior result immediately, terminate prior work, and issue a new revision. Run bounded preparation and analysis off the main thread. Decode the request using draft-safe parsing, preserve catalog-changed states, and return candidate preview from `onPrepared` even when enumeration later reaches a search limit. Reject a mismatched reply revision. A failed worker produces an actionable localized error and retry on the next edit, not silent synchronous main-thread search.

```ts
// Hook lifecycle: generation is a useRef<number>, worker belongs to this effect.
const revision = ++generation.current;
worker.onmessage = (event) => {
  if (event.data.revision !== generation.current) return;
  // Decode the preview snapshot, then publish this reply's state.
};
return () => worker.terminate();
```

- [x] **4. Integrate with TopGearApp.** Keep the original request as the saved/submitted source of truth. Pass preview snapshot/selection only to display and enhancement preview; use resource/exclusion/enhancement mutators to write back to the original request. For purchase runs derive allowance/readiness from the current worker result. Preserve the legacy synchronous allowance/enhancement path when purchases are absent. Do not run the old 10,000-node enhancement analysis as a second, contradictory gate on the generated pool; purchase analysis already includes enhancement legality and diagnostics. Invalidate the displayed preview and discard only definitively rejected admission attempts when resource inputs change. Preserve an unresolved attempt’s original payload/key: retry resolves that original run, while newer wallet edits remain a separate saved draft. Do not silently submit a second run after network uncertainty. Pending-intent recovery must not validate or overwrite the newer draft as if it were the original submitted request.
- [x] **5. Merge candidates into inventory and build review.** Keep the four current slot filters and per-slot Add custom item rows. Purchased candidates have a resource source indicator and route selection toggles to per-profile exclusions. Open the existing enhancement editor using the effective item; route Save through `setPurchaseEnhancements`. The review dialog lists all compatible rewards with direct costs, chained costs, availability, exact owned prerequisites, and missing amounts. Do not confuse individual availability with affordable simultaneous selection. Preserve exclusions when temporarily unaffordable; explain that excluding a final item still allows it as a prerequisite.
- [x] **6. Connect wallet summary and readiness states.** Place ResourceWallet above slot groups and use the current RunSettingRow pattern for the compact run summary. Extend RunAllowance to distinguish calculating, exact feasible count, no legal sets, over-limit, search-limit, and catalog-changed states. A search-limit count is incomplete and cannot be labeled exact or upper-bound. Compare is enabled only for current complete allowed analysis plus existing submission readiness. Keep the dynamic WorkPolicy values, not the sample Paper counts. The catalog-change action calls `revalidatePurchaseInputs`, describes removed choices, and reruns analysis.
- [x] **7. Run green and verify in browser.** Run Task 7 tests, existing custom item/enhancement tests, locale parity, and typecheck. Inspect desktop 1440px, 900px layout transition, 390px mobile, and short mobile viewport against boards 01–04, 06–07, and 09. Verify Escape/focus return, keyboard stepper entry, slot filters, custom item addition, unavailable review states, and no horizontal overflow.
- [x] **8. Commit.** Stage Task 7 files and commit `feat: integrate affordable purchases into gear selection`.

## Task 8: Show the selected purchase plan and restore editable inputs

**Files**

- Create: `src/features/reports/PurchasePlanPanel.tsx`, `src/features/reports/PurchasePlanPanel.test.tsx`, `src/features/reports/purchase-plan.css`.
- Create: `src/domain/purchases/report-draft.ts`, `src/domain/purchases/report-draft.test.ts`.
- Modify: `src/features/reports/ReportView.tsx`, `src/features/reports/ReportView.test.tsx`, `src/features/reports/CombinationTable.tsx`.
- Modify: `messages/en-US/reports.json`, `messages/pt-BR/reports.json`.

**Interfaces**

- Produces `PurchasePlanPanel({ report, row }: { report: TopGearReport; row: SetRow })`.
- Produces `requestFromReport(report: TopGearReport): TopGearRequest` in `report-draft.ts`.
- Consumes frozen report metadata and row.purchasePlan from Task 5. All displayed costs derive from the report, not the current PurchaseCatalog or a local draft wallet.

- [x] **1. Write report selection and restoration tests.** Extend the existing ReportView fetch fixtures with two rows spending different resources and a zero-spend baseline. Assert panel changes with selected rows across pagination/pinned rows and locale changes, full gear/stat content remains, and legacy reports render without a purchase panel.

```ts
// In report-draft.test.ts, report is a complete in-memory TopGearReport fixture
// whose snapshot is hydrated and purchases.originalSnapshot is the input snapshot:
it("restores inputs without making generated rewards owned", () => {
  const draft = requestFromReport(report);
  expect(draft.snapshot).toEqual(report.purchases!.originalSnapshot);
  expect(draft.purchases).toEqual(report.purchases!.inputs);
  expect(draft.snapshot.inventory.some((i) => i.source === "purchase")).toBe(false);
  expect(draft.selection).toEqual(report.selection);
  expect(decodeDraft(encodeRequest(draft)).purchases).toEqual(draft.purchases);
});
```

Build this report fixture from `purchaseFixture({ frost: 100 })`, a complete `analyzePurchaseSelection` result, and `hydratePurchaseSnapshot`. Use an empty `rows` array for this restoration test and the existing report contract's status/coverage/policy fields; it does not require fake simulator results. For UI tests use the existing ReportView fixture pattern with explicit SetRows.

- [x] **2. Run red.** `pnpm exec vitest run --project unit src/domain/purchases/report-draft.test.ts` and `pnpm exec vitest run --project ui src/features/reports/PurchasePlanPanel.test.tsx src/features/reports/ReportView.test.tsx` fail on the new behavior.
- [x] **3. Build purchase explanations.** Display final reward item links and ordered prerequisite steps, each step's cost, owned pieces consumed, resource totals, and balances remaining. The summary uses selected-row purchasePlan; baseline and owned-only rows show No purchases needed. Avoid implying a partial report proved the global optimum. Keep existing recommendation/highest IDs and all whole-set comparisons. Do not replace native DPS ranking with a spending score or a sum of item gains.

```ts
// requestFromReport preserves the exact original inputs, not generated inventory:
return {
  tool: "top-gear", precision: "standard",
  snapshot: report.purchases?.originalSnapshot ?? report.snapshot,
  selection: report.selection,
  ...(report.purchases ? { purchases: report.purchases.inputs } : {}),
};
```

- [x] **4. Integrate Edit and frozen report decoding.** Replace ReportView's ad hoc draft reconstruction with `requestFromReport`; preserve the existing navigation/save behavior. Decode the optional original snapshot before passing the report to this helper. The stored catalog revision remains on the restored draft, so Task 7 can prompt for revalidation if needed. Viewing, selecting, saving, or editing a report never deducts resources. Preserve reports without optional metadata.
- [x] **5. Apply the report layout and run green.** Fit the purchase panel into the existing report structure, retaining the complete 17-slot selected set and stats. On 390px stack steps/totals as board UJC-0; on desktop follow UA6-0, and verify unused-token state UJD-0. Run Task 8 unit/UI tests, report pagination/locale regression tests, and locale parity.
- [x] **6. Commit.** Stage Task 8 files and commit `feat: explain purchase results and restore gear lab inputs`.

## Task 9: Verify the complete flow, native inputs, and design fidelity

**Files**

- Create: `tests/e2e/purchases.spec.ts`, `tests/e2e/purchase-reports.spec.ts`, `tests/integration/purchases-sim.test.ts`.
- Modify only where fixture support is needed: `tests/support/report-fixture.ts`, `tests/support/purchase-fixtures.ts`.
- Update: `docs/design/tokens-purchase-planning.md` with implementation evidence; do not overwrite the original design decisions with transient test output.

**Interfaces**

- Consumes the complete Tasks 1–8 flow, existing Playwright app/test DB setup, `fixtureRequest`, `encodeRequest`, `simulationInput`, and `evaluate`.
- No new product interfaces. Native tests use realistic full character equipment from `tests/support/fixtures.ts`; the minimal DK fixture remains limited to domain tests.

- [x] **1. Write the end-to-end purchase flow.** Import the existing warrior export, choose Fury, and enter Gear Lab using the current custom-items E2E setup. Add 100 Frost and one class-compatible Regalia through the dialog. Assert derived rows, edit replacement, one shared currency entry, review/exclusion, saved draft restoration, and submitted purchase inputs without generated inventory. Mock only the job endpoint when inspecting request shape; do not fake the browser solver. Add mobile and pt-BR coverage with actual labels.

```ts
// After importing the character and entering Gear Lab:
await page.getByRole("button", { name: "Add a resource", exact: true }).click();
const dialog = page.getByRole("dialog", { name: "Add a resource" });
await dialog.getByRole("radio", { name: "Emblem of Frost", exact: true }).check();
await dialog.getByRole("spinbutton", { name: "Quantity" }).fill("100");
await dialog.getByRole("button", { name: "Save resource" }).click();
await expect(page.getByRole("button", { name: "Review purchasable gear" })).toBeEnabled();
const saved = await page.evaluate(() => JSON.parse(
  localStorage.getItem("wow-droptimizer.top-gear.v1")!,
));
expect(saved.purchases.balances.frost).toBe(100);
expect(saved.snapshot.inventory.some((i: { source: string }) => i.source === "purchase"))
  .toBe(false);
```

- [x] **2. Write report E2E and native integration tests.** Report E2E uses two explicit acquisition plans, changes selected rows, follows a prerequisite item link, inspects remaining resources, and edits back to Gear Lab without converting generated rewards to owned gear. Native tests run both profiles using the full warrior fixture, identify compatible tier recipe IDs through the verified catalog, and plan an affordable final upgrade. Validate the request, hydrate the frozen snapshot, and call `simulationInput`/`evaluate` with the final loadout. Assert only the final upgraded item reaches the simulator, enhancement overrides apply, and mean/stats are finite. Build a candidate crossing a real two-piece or four-piece set threshold and compare native input to an equivalent ordinary gear setup; do not assert a fabricated DPS increase or reimplement the native set-bonus logic.
- [x] **3. Run red for newly added coverage.** Run the two new Playwright files and `pnpm exec vitest run --project simulator tests/integration/purchases-sim.test.ts`. A completed earlier task may already satisfy these acceptance cases; in that case record the first run as green and do not manufacture an implementation change. Fix actual integration failures in their owning modules, then rerun affected checks.
- [x] **4. Complete the acceptance matrix.** Record evidence for A1–A18 from the spec. Add deterministic solver cases for tight shared Triumph balances, multiple tokens, selected owned prerequisites, owned/custom duplicates, impossible chains, profile/faction mismatch, exact resource exhaustion, zero spend, search exhaustion, and equivalent gear deduplication if not already covered. Assert source ownership and server trust boundaries at admission, not only in the browser.
- [x] **5. Compare all nine Paper boards in the running app.** Check 1440×900, 390×844, the 900px breakpoint, and a short mobile viewport. Verify the reference Add custom item dialog and the new resource dialog share padding, typography, input/button sizes, border/fill, focus behavior, and scroll handling. Verify purchase rows use existing gear-row spacing, icons, slot headings, and filter structure. Test keyboard-only entry/edit/removal, Escape, focus return, and Portuguese wrapping. Save test screenshots under the existing artifact workflow for review; do not add baseline images merely to lock in an unreviewed layout.
- [x] **6. Run final checks once after fixes.** Use the repository's installed environment and isolated integration/E2E database. Do not run migrations or truncation against the user's app database.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm exec vitest run --project simulator tests/integration/purchases-sim.test.ts tests/integration/custom-items-sim.test.ts tests/integration/item-enhancements-sim.test.ts
pnpm exec playwright test tests/e2e/purchases.spec.ts tests/e2e/purchase-reports.spec.ts tests/e2e/custom-items.spec.ts tests/e2e/item-enhancements.spec.ts tests/e2e/draft-restore.spec.ts tests/e2e/edit-report.spec.ts
pnpm check:design
pnpm build
git diff --check
```

`pnpm check:design` is a supplemental repository design guard; it does not replace visual comparison. Existing native binaries and test database prerequisites are those used by the current test suites. Record an unavailable external prerequisite as an unrun check, never as a passing test. Broaden simulator/auth suites only if changed shared behavior or a failing check justifies it.

- [x] **7. Commit acceptance coverage and evidence.** Stage only Task 9 files plus fixes in this feature's modules; commit `test: verify gear lab purchase planning end to end`. Report which checks ran, any limitations, and the actual user-visible behavior. Do not deploy or change resources outside the simulator as part of this plan.

## Review and completion criteria

The feature is ready when server admission and browser preview agree on the affordable set space; the native simulator receives final gear with existing enhancement/set-bonus behavior; each report row retains an accurate, immutable purchase explanation; and all nine approved design surfaces are represented in the current Gear Lab/report conventions.

| Spec coverage | Implementation tasks |
| --- | --- |
| T9/T10 costs, class/faction/profile rules, variants, verified IDs | 1, 3, 9 |
| Wallet, quantity replacement, drafts, profile exclusions | 2, 6, 7 |
| Whole-set affordability, prerequisite consumption, unused resources | 3, 4, 5, 9 |
| Custom tier costs and hypothetical ownership boundary | 2, 3, 7, 9 |
| Bounded exact allowance, no illegal-product rejection, stale analysis | 4, 5, 7, 9 |
| Frozen runs, retries, idempotency, report pagination and restore | 5, 8, 9 |
| Paper boards 01–03 and 06–07 | 6, 7, 9 |
| Paper board 04 and prerequisite/editing states in 09 | 3, 7, 9 |
| Paper boards 05 and 08, unused resources in 09 | 5, 8, 9 |
| Existing custom items, enhancements, gear/stats, legacy reports | 2–9 |
| Accessibility, responsive layout, both locales | 6–9 |

Implementation completed September 12, 2026. All nine tasks and required verification checks are complete. See [implementation verification and decisions](../../design/tokens-purchase-implementation.md) for results and limitations.
