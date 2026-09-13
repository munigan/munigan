# Gear Lab Zustand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gear Lab interactions update only their dependent UI and calculations while preserving purchases, draft restoration, and reliable submission.

**Architecture:** A page-scoped vanilla Zustand store owns the editable request and explicit commands. Stable selectors feed individual sections and rows; a revision-aware controller owns worker analysis, and a separate adapter batches draft writes. Admission retains its durable immutable attempt outside the editable store.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript, Zustand, Web Workers, Vitest/Testing Library, existing domain modules and localStorage serializer.

**Spec:** [Approved design](../specs/2026-09-13-gear-lab-zustand-design.md)

## Global Constraints

- “This is a frontend architecture refactor. Server admission planning, simulation concurrency, acquisition rules, and visual redesign are outside its scope.”
- “Create one vanilla Zustand store per mounted Gear Lab session, provided through a stable React context.”
- “No generic whole-request replacement callback remains in ordinary interactive controls.”
- “Use monotonic revisions and at most one active analysis plus one replaceable pending input.”
- “Retain the current draft key and `encodeRequest`/`decodeDraft` format.”
- “Subscribe to editable draft changes and debounce serialization/writes by 250 ms.”
- “Keep the durable admission attempt separate: its serialized body and idempotency key stay immutable while submission is pending or uncertain.”
- “No Redux, query library, React Compiler adoption, or state machine framework is needed for this refactor.”
- Preserve current token images, overlays, shared tooltips, button styles, variant filtering, physical owned duplicates, and generated-item deduplication.
- Preserve local default 500 iterations and selectable range through 6000; consume the server policy rather than hard-coding those limits in the store.
- Read installed Next guides before code: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `01-app/02-guides/server-and-client-boundary.md`.

## Workspace and execution safety

Work in `/Users/diegofernandes/Documents/ChatGPT/wow-droptimizer/.worktrees/purchases`, branch `codex/gear-lab-purchases`. The original checkout is a different branch. Recheck git status before edits and preserve unrelated work. Continue this existing worktree; do not create another checkout by default.

The app on port 3100 is a test harness whose shutdown drops its temporary database. Do not restart or stop that harness or its local worker. Do not run the default Playwright configuration against it: `reuseExistingServer: false` would attempt another harness on the same port. Use the available CUA browser controls for live verification. Only run automated browser suites in a separately configured isolated environment after checking its port and schema isolation.

Read `.superpowers/sdd/2026-09-10-discord-authentication/oauth-runtime.json` only when the local environment is needed; never print its database credentials. Profiling artifacts must omit cookies, admission tokens, and private imported character data.

## File map and dependencies

New files under `src/features/inventory/state/`:

| File | Responsibility |
| --- | --- |
| `gear-lab-store.ts` | Canonical draft, session epoch, typed commands, normalization at relevant boundaries |
| `GearLabProvider.tsx` | Stable store context, scoped initialization, selector hook |
| `gear-lab-selectors.ts` | Cached inventory/row projections and stable analysis input selection |
| `gear-lab-analysis.ts` | Revision state, worker ownership, latest pending input, retry and disposal |
| `useGearLabAnalysis.ts` | React lifecycle binding to analysis controller and existing no-purchase calculations |
| `gear-lab-persistence.ts` | Delayed draft writes, flush/cancel/discard/submission reconciliation |
| `useGearLabAdmission.ts` | Current-state admission checks and existing durable attempt workflow |
| `useGearLabSession.ts` | Import, restore, sign-in/start navigation, controller lifecycle orchestration |

Tests sit beside those files. Add `TopGearApp.performance.test.tsx` for interaction contracts and `tests/support/gear-lab-worker.ts` for a reusable controllable worker double. Existing components keep their markup and CSS; connected row/slot wrappers can live in `InventorySelector.tsx` rather than creating a file per wrapper.

Task order is 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Each commit must leave tests/typecheck passing; temporary integration adapters have explicit removal in Task 7. No task introduces a second editable request copy.

## Task 1: Establish the baseline and page-scoped store

**Files:** Create `state/gear-lab-store.ts`, `state/GearLabProvider.tsx`, `state/gear-lab-store.test.ts`, `state/GearLabProvider.test.tsx`; modify `package.json` and `pnpm-lock.yaml`. Save measurements to `.artifacts/gear-lab-zustand/baseline.md`.

**Interfaces:**

```ts
// Imports: StoreApi from zustand/vanilla; domain types from top-gear/model.
export type GearLabState = {
  draft: TopGearRequest | null;
  epoch: number;
  actions: GearLabActions;
};
export type GearLabStore = StoreApi<GearLabState>;
export function createGearLabStore(initial?: TopGearRequest | null): GearLabStore;
// Provider may accept a store for tests, otherwise creates one per mount.
export function useGearLabStore(): GearLabStore;
export function useGearLabSelector<T>(selector: (s: GearLabState) => T): T;
// Task 1 actions; Task 2 extends this same interface.
export interface GearLabActions {
  replaceDraft(draft: TopGearRequest | null): void;
  setIterations(value: number, policy: WorkPolicy): void;
}
```

- [x] Capture current behavior before source changes: same large local draft, five iterations-slider edits, five checkbox toggles, and five resource edits, restoring values after each series. Use React DevTools Profiler if exposed; otherwise a temporary React `<Profiler>` callback in a local diagnostic harness. Record section commits, actual durations, worker messages, and storage writes. Exclude initial load and keep environment/settings consistent for the after run. If live profiling is unavailable, document that limitation and use the reproducible React Profiler UI harness; do not claim measured live render costs.
- [x] Read Zustand's current official vanilla store, React `useStore`, and Next.js guides; run `pnpm view zustand version peerDependencies`, verify compatibility with the installed React version, then run `pnpm add --save-exact zustand`. Confirm the installed version matches the verified registry release and is pinned exactly. Do not add middleware or other state dependencies.
- [x] Write and run a failing isolation/structural-sharing test:

```ts
import { expect, it } from "vitest";
import { purchaseFixture, purchasePolicy } from "../../../../tests/support/purchase-fixtures";
import { createGearLabStore } from "./gear-lab-store";
it("changes precision without replacing gear or another session", () => {
  const a = createGearLabStore(purchaseFixture({ frost: 100 }));
  const b = createGearLabStore(purchaseFixture({ frost: 100 }));
  const before = a.getState().draft!;
  a.getState().actions.setIterations(4000, {
    ...purchasePolicy,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  expect(a.getState().draft!.snapshot).toBe(before.snapshot);
  expect(a.getState().draft!.selection).toBe(before.selection);
  expect(a.getState().draft!.purchases).toBe(before.purchases);
  expect(a.getState().draft!.iterations).toBe(4000);
  expect(b.getState().draft!.iterations).toBeUndefined();
});
```

Run `pnpm exec vitest run --project unit src/features/inventory/state/gear-lab-store.test.ts`. Initially expect missing-module failure.
- [x] Implement store creation using `createStore<GearLabState>()`. Move initial defaults/unsupported-bag normalization from `TopGearApp.change` into `replaceDraft`; do not call that path from `setIterations`. Increment epoch only for replacement/reset. Validate slider value against policy range/step and reject edits when precision is not selectable; unchanged values return the existing state. Keep browser APIs out of the constructor.
- [x] Implement provider using lazy `useState(() => suppliedStore ?? createGearLabStore())`, `createContext<GearLabStore | null>(null)`, and Zustand `useStore(store, selector)`. Throw a clear missing-provider error. Keep effects outside render. Test two providers, empty initial server-compatible render, unmount/remount, and a selector subscriber that does not commit on precision-only updates.
- [x] Run the two new suites and `pnpm typecheck`; commit as `refactor: introduce scoped Gear Lab store`.

## Task 2: Encode domain edits as atomic commands

**Files:** Modify `state/gear-lab-store.ts` and its test. Read existing `domain/purchases/{state,variants,enhancements}.ts`, `domain/equipment/{custom-items,item-enhancements}.ts` and `TopGearApp.tsx` before moving behavior.

**Consumes:** Task 1 store and actions. **Produces:** additions to `GearLabActions`:

```ts
toggleItem(instanceId: string): void;
setPurchaseIncluded(itemId: number, included: boolean): void;
setResourceQuantity(id: ResourceId, quantity: number): void;
// One transaction for modal save, including replacement of the resource type.
saveResource(input: { previousId?: ResourceId; id: ResourceId;
  quantity: number; gearVariant: string }): void;
removeResource(id: ResourceId): void;
setGearVariant(variant: string): void;
addCustomItems(slot: Slot, itemIds: number[]): void;
removeCustomItem(instanceId: string): void;
setItemEnhancements(instanceId: string, value: ItemEnhancementOverride): void;
setPurchaseEnhancements(itemId: number, value: ItemEnhancementOverride): void;
setGemming(value: GemmingSettings): void;
setAutoEnchant(value: boolean): void;
setItemVersion(version: ItemVersion): void;
applySettings(value: Pick<Snapshot, "specId" | "settings" | "provenance" | "professionLevels">): void;
revalidatePurchases(): number[]; // removed reward IDs, for existing notice
```

- [x] Add failing behavioral tests for isolated checkbox updates, duplicate owned physical IDs, unsupported selections, invalid resource quantities, atomic modal save, class-variant validation, profile changes, custom removal cleanup, and no-op notifications. Example:

```ts
it("keeps a second physical copy when toggling the first", () => {
  const request = purchaseFixture();
  request.snapshot.inventory.push({ ...request.snapshot.inventory[0],
    instanceId: "bag-legs", source: "bag", equippedSlot: undefined });
  request.selection.selectedInstanceIds.push("bag-legs");
  const store = createGearLabStore(request);
  const snapshot = store.getState().draft!.snapshot;
  store.getState().actions.toggleItem("owned-legs");
  expect(store.getState().draft!.selection.selectedInstanceIds).toEqual(["bag-legs"]);
  expect(store.getState().draft!.snapshot).toBe(snapshot);
});
```

- [x] Run the store test file; expect missing commands/incorrect isolation failures.
- [x] Implement each command by applying the existing domain function to `get().draft` inside a single `set` transaction. Alias imported domain functions to distinguish them from action names. For `saveResource`, remove the previous ID when changed, apply quantity, then validated variant, and publish only the final request. For ordinary owned toggles, replace selection only. Map purchase inclusion to existing `setPurchaseExcluded(request, itemId, !included)`.
- [x] Preserve reference identity on equal values; compare small canonical overrides rather than JSON-encoding the whole request. Revalidate unsupported bags when inventory, item version, or character eligibility changes, not on quantity/precision/checkbox edits. Reset retired locks at import/restore. Merge settings fields into the *latest* snapshot so a modal cannot overwrite newer inventory or resources. Preserve sparse enhancement normalization and catalog-repair feedback.
- [x] Run store tests, existing domain purchases/equipment tests, and `pnpm typecheck`; commit as `refactor: centralize Gear Lab editing commands`.

## Task 3: Build stable projections for rows and analysis inputs

**Files:** Create `state/gear-lab-selectors.ts` and `state/gear-lab-selectors.test.ts`; read `InventorySelector.tsx`, `InventoryItemRow.tsx`, `purchases/presentation.ts`.

**Consumes:** `GearLabState`, domain validation and preview helpers, existing `PurchasePreview` type. **Produces:**

```ts
export type AnalysisInput = {
  epoch: number;
  request: Omit<TopGearRequest, "iterations">;
  policy: WorkPolicy; // iterationsPerSet normalized to 1
};
export function createAnalysisInputSelector():
  (state: GearLabState, policy: WorkPolicy | null) => AnalysisInput | null;
export type InventoryRowView = {
  item: ItemInstance;
  preview: ItemInstance;
  selected: boolean;
  usesResources: boolean;
  unavailable: boolean;
};
export type InventoryView = {
  byId: ReadonlyMap<string, InventoryRowView>;
  groups: ReadonlyMap<Slot, readonly string[]>;
  unsupported: readonly ItemInstance[];
  selectedCount: number;
  totalCount: number;
};
export function createInventorySelector():
  (draft: TopGearRequest, preview: PurchasePreview | null) => InventoryView;
export type NonPurchaseView = {
  allowance: Allowance;
  enhancementAnalysis: ReturnType<typeof analyzeItemEnhancementSets> | null;
};
export function createNonPurchaseSelector():
  (state: GearLabState, policy: WorkPolicy | null) => NonPurchaseView | null;
```

- [x] Write failing tests asserting stable analysis input on precision changes, stable row views for unedited items, stable slot ID arrays on checkbox edits, invalidation on changed profile/global enhancements, and unchanged deduplication/variant ordering.

```ts
it("reuses the analysis input when only precision changes", () => {
  const store = createGearLabStore(purchaseFixture({ frost: 100 }));
  const select = createAnalysisInputSelector();
  const first = select(store.getState(), purchasePolicy);
  store.getState().actions.setIterations(4000, {
    ...purchasePolicy, selectableIterations: { min: 500, max: 6000, step: 500 },
  });
  expect(select(store.getState(), purchasePolicy)).toBe(first);
});
```

- [x] Run `pnpm exec vitest run --project unit src/features/inventory/state/gear-lab-selectors.test.ts`; expect missing selector failure.
- [x] Cache analysis input by epoch, snapshot, selection, purchases and policy fields that affect legality. Exclude iterations and selectable slider range. Preserve `version`, `unitsPerSet`, limits, and attempts; normalize only execution iterations. Do not encode/JSON-stringify during selector reads.
- [x] Extract validation/grouping/ordering from `InventorySelector`. Cache base validation by inventory and character eligibility; cache previews per instance and actual enhancement dependencies. Reconcile worker-decoded instances by stable ID/value at the worker-result boundary so identical objects remain stable across replies. Publish a new row view only when its displayed properties change. Global settings may invalidate affected previews; selection-only edits may not.
- [x] Separate selected membership from candidate construction. For an existing purchase preview, apply current owned selection and purchase exclusions immediately, including while newer analysis is pending. Retain the existing converted-custom rules and unavailable custom-reward display. Keep display ordering identical. Implement `createNonPurchaseSelector` with the existing enhancement enumeration and allowance helpers, keyed by snapshot, selection and legality policy; return null when no draft/policy exists or purchases are active. A precision-only change must preserve its returned reference.
- [x] Run selector/store suites and existing inventory/presentation tests; commit as `refactor: cache Gear Lab inventory projections`.

## Task 4: Coordinate analysis without obsolete worker queues

**Files:** Create `state/gear-lab-analysis.ts`, `state/gear-lab-analysis.test.ts`, `state/useGearLabAnalysis.ts`, `state/useGearLabAnalysis.test.tsx`, `tests/support/gear-lab-worker.ts`; modify `purchases/purchase-worker-contract.ts`, `purchases/purchase-analysis.worker.ts`, `purchases/usePurchaseAnalysis.ts`. Keep the old hook working until Task 6 replaces its consumers.

**Consumes:** Task 3 `AnalysisInput`, existing analysis/preview types. **Produces:**

```ts
export type AnalysisView = {
  revision: number;
  completedRevision: number | null;
  state: PurchaseAnalysisState;
  preview: PurchasePreview | null; // can exist before terminal analysis
};
export type AnalysisController = {
  update(input: AnalysisInput | null): void;
  retry(): void;
  getSnapshot(): AnalysisView;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};
export function createAnalysisController(createWorker: () => Worker): AnalysisController;
export function useGearLabAnalysis(policy: WorkPolicy | null): {
  controller: AnalysisController;
  view: AnalysisView;
  nonPurchase: NonPurchaseView | null;
  readNonPurchase(): NonPurchaseView | null; // same cached selector, latest state
};
```

- [x] Extract the existing mock worker into a controllable test helper with `messages: PurchaseWorkerRequest[]`, `postMessage`, `emit(reply)`, `fail()`, and tracked `terminate`/listener removal. Use the real `analyzePurchaseSelection` on small fixtures when creating complete replies; no fabricated successful allowances.
- [x] Write failing tests for one active plus newest pending input, no work on iterations-only changes, stale replies, epoch replacement, removal of purchases, preview delivery, error/retry, and disposal. Core queue sequence:

```ts
const store = createGearLabStore(purchaseFixture({ frost: 100 }));
const select = createAnalysisInputSelector();
const worker = new ControlledWorker(); // defined in tests/support/gear-lab-worker.ts
const controller = createAnalysisController(() => worker as unknown as Worker);
controller.update(select(store.getState(), purchasePolicy));
store.getState().actions.setResourceQuantity("frost", 120);
controller.update(select(store.getState(), purchasePolicy));
store.getState().actions.setResourceQuantity("frost", 140);
controller.update(select(store.getState(), purchasePolicy));
expect(worker.messages).toHaveLength(1);
worker.emit({ revision: worker.messages[0].revision, status: "ready",
  analysis: { status: "search-limit", visitedNodes: 1 }, preview: null });
expect(worker.messages).toHaveLength(2);
expect(worker.messages[1].request.purchases!.balances.frost).toBe(140);
expect(controller.getSnapshot().completedRevision).toBeNull();
controller.dispose();
```

- [x] Run new analysis suites; expect missing controller or queue contract failures.
- [x] Implement controller state with one active message and one pending `AnalysisInput`. `update` compares input identity, advances revision immediately, and replaces pending input while busy. Encode only when dispatching. On a terminal reply, publish only if revision and worker identity are current, then dispatch the newest pending input. On epoch reset/null, terminate and clear pending work. On error/messageerror/construction failure, release the worker and expose the current error; `retry` creates a worker and dispatches the newest input. Disposal is idempotent; callbacks after disposal do nothing.
- [x] Extend the worker protocol with a nonterminal `status: "preview"` reply using the existing `onPrepared` callback before combination analysis. Its `preview` field uses the same encoded type as the existing ready reply, with a non-null value. Decode and publish it in `AnalysisView.preview`; leave `completedRevision` null and analysis pending. Do not release the active slot for it. Keep terminal ready/error handling compatible with the old hook during migration by filtering preview messages there. Resource/profile changes hide stale availability until the matching preview; checkbox-only refresh preserves current rows and focus. Derived current checkbox state comes from the draft, not the selection captured by a prior worker reply.
- [x] Bind controller subscription with `useSyncExternalStore` and stable snapshots, subscribing imperatively to the draft store through the stable input selector. Start and stop workers in effects. Ensure Strict Mode setup/cleanup can create a fresh controller without reusing a permanently disposed instance. Do not remap every simulation when precision changes: run controls derive totals from cached counts, and submission serializes current precision independently.
- [x] Bind Task 3's non-purchase selector to the same subscription lifecycle. Return its cached value as `nonPurchase`; expose `readNonPurchase` for current-state admission checks using that same selector. Use existing `analyzeItemEnhancementSets`, `estimateAllowance`, and `allowanceForCount`; precision updates must not enumerate or validate again.
- [x] Run analysis and existing purchase hook/domain tests plus `pnpm typecheck`; commit as `perf: coalesce Gear Lab analysis updates`.

## Task 5: Batch draft persistence and define safe cleanup

**Files:** Create `state/gear-lab-persistence.ts`, `state/gear-lab-persistence.test.ts`; use existing `features/import/draft-store.ts` unchanged where possible.

**Consumes:** Task 1 store, existing draft functions. **Produces:**

```ts
export type DraftPersistence = {
  flush(): void;
  cancel(): void;
  discard(): void;
  complete(submitted: ReturnType<typeof encodeRequest>): void;
  dispose(options?: { flush?: boolean }): void;
};
export function createDraftPersistence(store: GearLabStore, options: {
  save: typeof saveDraft;
  clear: typeof clearDraft;
  clearMatching: typeof clearMatchingDraft;
  onError: (error: unknown) => void;
}): DraftPersistence;
```

- [x] Add fake-timer tests for write batching, current reference at flush, synchronous flush failure, background errors, discard, replacement, null draft, newer edits during admission, successful matching cleanup, canceled timers, and repeated disposal.

```ts
it("writes only the latest edit after 250 ms", () => {
  vi.useFakeTimers();
  const store = createGearLabStore(purchaseFixture({ frost: 100 }));
  const save = vi.fn();
  const persistence = createDraftPersistence(store, {
    save, clear: vi.fn(), clearMatching: vi.fn(), onError: vi.fn(),
  });
  store.getState().actions.setResourceQuantity("frost", 120);
  store.getState().actions.setResourceQuantity("frost", 140);
  vi.advanceTimersByTime(249);
  expect(save).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(save).toHaveBeenCalledExactlyOnceWith(store.getState().draft);
  persistence.dispose({ flush: false });
  vi.useRealTimers();
});
```

- [x] Run the persistence suite; expect missing adapter failure.
- [x] Subscribe to draft identity; replace the 250 ms timer without serializing. On epoch changes cancel old pending work before scheduling the replacement. `flush` clears the timer, writes the newest unsaved draft, and throws on failure so navigation/submission can stop visibly. Timer callbacks report errors through `onError` without losing the in-memory draft.
- [x] `discard` cancels first and clears existing storage; it must not clear live state on storage failure. `complete` cancels pending work, saves any newer live draft before `clearMatching(submitted)`, and suppresses unmount flushing of the submitted draft after successful cleanup. If storage fails after admission succeeds, surface the error but preserve the report navigation; no late callback may overwrite a newer saved draft. Track the last successfully persisted/completed draft identity to avoid duplicate unmount writes.
- [x] `dispose` unsubscribes and clears timers even if its optional flush fails. Bind pagehide/hidden visibility events later in Task 7. Do not install Zustand persist middleware.
- [x] Run persistence and existing draft/admission-attempt suites; commit as `perf: batch Gear Lab draft persistence`.

## Task 6: Move wallet, equipment, and sidebar to narrow subscriptions

**Files:** Modify `TopGearApp.tsx`, `InventorySelector.tsx`, `InventoryItemRow.tsx`, `InventoryEnhancementIssues.tsx`, `RunSetup.tsx`, `GemmingPanel.tsx` (reuse unchanged `RunAllowance.tsx` through the connected sidebar adapter), `custom-items/CustomItemPicker.tsx`, `enhancements/ItemEnhancementEditor.tsx`, `purchases/{ResourceWallet,ResourceDialog,ResourceImage,PurchasableItemsDialog}.tsx`, and their UI tests. Create `TopGearApp.performance.test.tsx`. Update `messages/en-US/inventory.json` and `messages/pt-BR/inventory.json` only for retry/pending copy that is not already available. Keep `features/settings/PresetPanel.tsx` reusable; adapt its result to the owned-field `applySettings` command at the Gear Lab modal boundary.

**Consumes:** Store commands, inventory selectors, analysis hook. **Produces:** Connected components; ordinary controls use actions rather than `(request) => onChange(request)`.

- [x] Add Profiler-based UI tests before changing consumers. Mount the real page with fixture import/auth/router and a controlled worker. After startup and analysis settle, clear counters, operate the real iterations slider, and assert zero wallet/equipment commits, zero worker messages, and zero inventory validation calls. Include an unrelated row Profiler around a real checkbox interaction; assert stable DOM element identity and retained focus, not just the new checked value.

```tsx
// Test instrumentation around actual section/row render paths:
const commits: string[] = [];
const onRender: React.ProfilerOnRenderCallback = (id, phase) => {
  if (phase !== "mount") commits.push(id);
};
// In the fixture harness wrap the real wallet and inventory sections with
// <Profiler id="wallet" onRender={onRender}> and id="inventory".
// Clear commits after hydration/worker completion, before firing the slider.
expect(commits.filter((id) => id === "wallet" || id === "inventory")).toEqual([]);
```

- [x] Run `pnpm exec vitest run --project ui src/features/inventory/TopGearApp.performance.test.tsx`; confirm failure is the existing broad updates, not unsettled timers or missing translations.
- [x] Put the provider above the Gear Lab composition shell. Remove its `useState` request; import/restore writes the store. During this task a shell subscription may temporarily support admission code, but memoized connected sections must prevent parent updates from cascading and Task 7 removes that broad subscription.
- [x] Wallet rows read resource ID/quantity/variant and presentation context; move included-count subscription into its summary. Resource images read class/profile/owned inventory/variant only, so precision and exclusion toggles cannot reconstruct tooltip rewards. Modal drafts remain local; saving calls `saveResource` once. Review dialog checkboxes call `setPurchaseIncluded` and enhancement actions.
- [x] Inventory section reads stable group ID arrays and local filter. Connected rows use a stable row selector and action reference. Move selection total into a subscribed summary. Keep editor state/open-return-focus at the inventory owner; pass a stable `onEdit(id, field)` to memoized rows. Use stable instance IDs as keys and never key rows or inventory by analysis revision. The row may keep a stable presentation snapshot for existing item helpers, but must not subscribe to the whole draft.

```tsx
const actions = useGearLabSelector((state) => state.actions);
const onToggle = useCallback(() => {
  if (item.source === "purchase") {
    actions.setPurchaseIncluded(item.itemId, !selected);
  } else {
    actions.toggleItem(item.instanceId);
  }
}, [actions, item.source, item.itemId, item.instanceId, selected]);
```

- [x] Split sidebar precision/allowance from character/settings summary. Replace item-version request construction with `setItemVersion`; pass the current server policy to `setIterations`. Settings/gemming modal adapters pick only their owned fields from results and call explicit actions. Custom picker commits item IDs/slot; enhancement editor and enhancement-conflict repair buttons commit override/ID. Cache conflict diagnostics on enhancement/eligibility changes, not selected iterations. Do not expose a new generic `updateRequest` escape hatch.
- [x] Connect current preview/pending/error from the analysis controller; preserve visible rows on checkbox changes and add shared secondary Retry button on worker error. Run stays disabled while current analysis is incomplete. Remove old `usePurchaseAnalysis` production usage once connected; move useful old hook tests to controller tests rather than deleting coverage.
- [x] Run all inventory UI suites, store/selector/controller tests, `pnpm typecheck`, `pnpm lint`, `pnpm check:design`; commit as `refactor: isolate Gear Lab component subscriptions`.

## Task 7: Extract admission and session lifecycle; remove adapters

**Files:** Create `state/useGearLabAdmission.ts`, `state/useGearLabSession.ts` and focused hook tests; modify `TopGearApp.tsx`, `TopGearApp.admission.test.tsx`; delete unused `purchases/usePurchaseAnalysis.ts` and relocate its tests after coverage migration. Keep `admission-attempt.ts` and import draft serializer contracts intact.

**Consumes:** `GearLabStore`, `AnalysisController`, `DraftPersistence`, existing `useAccount`, router, and attempt helpers. **Produces:**

```ts
// Hook reads auth/router itself, keeping those concerns out of the draft store.
export function useGearLabAdmission(options: {
  store: GearLabStore;
  analysis: AnalysisController;
  persistence: DraftPersistence;
  policy: WorkPolicy | null;
  readNonPurchase: () => NonPurchaseView | null;
}): {
  run(withoutSaving?: boolean): Promise<void>;
  pending: boolean;
  issue: "account" | "uncertain" | null;
  error: ErrorDescriptor | null;
};
```

`useGearLabSession` owns import/restore/start/sign-in event effects and controller wiring, using the existing `ImportPanelHandle` and current UI callbacks. Its returned values are only lifecycle flags, errors and named handlers; it does not return the full request to the shell. Share stable controller handles with connected run controls through context or props, not a changing context value containing their current snapshots.

- [x] Extend existing admission UI tests before moving code: stale analysis at click time, precision edits while auth refresh awaits, uncertain retry after draft edits, duplicate clicks, storage errors before navigation, catalog repair, anonymous/account recovery, and successful submission retaining a newer draft. Update mocks to invoke store actions, not old `onChange` props. Keep at least one full real-controls integration path.
- [x] Run admission tests and record expected new-contract failures before implementation.
- [x] Move current `run` logic with existing durable helpers. After any awaited auth refresh and immediately before creating a new attempt, read `store.getState().draft` and the controller snapshot. Require current `revision === completedRevision` and a complete allowed purchase result when purchases exist. Without purchases, require `readNonPurchase()?.allowance.allowed` and preserve the no-valid-enhancement-sets guard. Validate/encode the current draft, flush persistence, create the immutable attempt, and submit. A preexisting uncertain attempt bypasses creation of a new body/key; use the stored attempt exactly.

```ts
const current = store.getState().draft;
const analysis = controller.getSnapshot();
const purchasesReady = analysis.revision === analysis.completedRevision &&
  analysis.state.status === "ready" && !analysis.state.refreshing &&
  analysis.state.analysis.status === "complete" &&
  analysis.state.analysis.plan.allowance.allowed;
// Apply this guard only when constructing a NEW attempt, not when retrying
// an existing immutable one. Non-purchase readiness uses cached legality
// plus full validateRequest(encodeRequest(current)) at this boundary.
```

- [x] On success call `persistence.complete(submitted)` inside storage-error handling, then navigate even if cleanup failed. Never mutate an attempt from a live subscription. On ordinary draft edit, discard only a rejected attempt under existing rules; preserve pending/uncertain attempts. Keep pending state in `finally` and immediate duplicate-submit ref protection.
- [x] Integrate flush/cancel for report restore, replacement, start navigation, sign-in, pagehide/visibility, unmount and discard. Preserve the import-form draft priority and restoration notices. Register/remove each listener exactly once per session. Ensure Strict Mode effect replay does not erase a restored draft or resurrect a completed request.
- [x] Remove `TopGearApp.change`, synchronous per-edit full validation/save, broad shell request subscription, old hook and temporary whole-request adapters. Shell may subscribe to primitive existence/spec/epoch values. Run full validation at import/settings eligibility boundaries and submission, not in render after each slider move.
- [x] Run admission/session/persistence/UI suites and `pnpm typecheck`; commit as `refactor: separate Gear Lab session and admission lifecycle`.

## Task 8: Verify behavior and report measured changes

**Files:** Update regression tests where new failures expose missing contracts; create `docs/design/gear-lab-state.md` as a short ownership/dependency guide. Save verification evidence to `.artifacts/gear-lab-zustand/verification.md`.

**Consumes:** All prior deliverables. **Produces:** Tested refactor, same local user experience, reproducible before/after evidence and final architecture documentation.

- [x] Run the complete unit/UI suite once: `pnpm test`. Investigate real regressions rather than loosening selection, retry, persistence, or worker assertions.
- [x] Run integration coverage without touching the live schema: inspect `tests/support/database.ts` isolation first, then `pnpm exec vitest run --project integration tests/integration/purchase-admission.test.ts tests/integration/purchase-work.test.ts tests/integration/admission.test.ts`. Use the existing test database configuration; do not repoint tests at the harness schema.
- [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm check:design`, `pnpm check:specs`, and `git diff --check`. Do not run build against the shared live `.next` directory while the harness is active; if build validation is required, use an isolated checkout/output and document it.
- [x] Repeat Task 1 profiling with the same draft, machine, development mode, instrumentation, settled worker state, and five interactions per category. Record median/range of duration and section commits. Verify zero analysis/validation on iterations, no HTTP or row remount on checkbox, one newest pending analysis under rapid edits, and batched storage writes. Remove temporary profiling instrumentation from production paths.
- [x] Use CUA to verify the live user draft: precision change and revert; purchase checkbox and revert; resource modal save/revert; token image tooltip; owned-item deduplication; filter and keyboard focus; draft restore; visible failure/retry in the test harness. Do not submit a large real simulation just to test frontend state. Exercise submission in mocked/integration tests or a separate small isolated fixture.
- [x] Write ownership guide with the actual final module/API names, dependency table, storage format, revision guard, and test commands. Record observed limitations, including unchanged server-side submission planning time. Confirm no full-request selectors, per-render JSON worker keys, direct localStorage writes in interactive controls, stale worker publishing, or duplicated editable state remain.
- [x] Commit as `test: verify Gear Lab state isolation and recovery`. Report changes, checks, measured results, and limitations. Do not merge, push, deploy, restart the harness, or install more libraries as part of completion.

## Plan self-review

- Store scoping and normalized commands: Tasks 1–2.
- Reference stability, selected membership, grouping, previews and current policy: Task 3.
- Latest-only queue, preview publication, worker retry/disposal and stale-run guard: Tasks 4 and 7.
- Current UI, token images, deduplication, profile variants and enhancements: Tasks 2, 3, 6 and 8.
- Debounced writes, flush lifecycle, discard and newer-draft admission safety: Tasks 5 and 7.
- Immutable attempts, auth recovery, report restoration and duplicate-submit prevention: Task 7.
- Baseline, render/network/write assertions, live verification and final checks: Tasks 1, 6 and 8.
- No application changes are made by writing this plan. Follow the task checkboxes during execution; keep this document synchronized if verified code constraints require a revised interface.
