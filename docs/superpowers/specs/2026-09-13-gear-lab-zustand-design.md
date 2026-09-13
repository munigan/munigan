# Gear Lab state and performance design

Date: 2026-09-13
Status: Zustand approach approved in conversation; written specification ready for review.

## Goal

Keep the current Gear Lab interface and simulation behavior while making updates predictable: an iterations change must not rebuild inventory, recalculate purchases, or validate every item. Item selection must respond immediately without HTTP requests or replacing the table with a loading state.

Use a page-scoped Zustand store with narrow subscriptions, explicit commands, a calculation coordinator, and a separate draft persistence adapter. This is a frontend architecture refactor. Server admission planning, simulation concurrency, acquisition rules, and visual redesign are outside its scope.

## Current evidence

- `TopGearApp.tsx` owns the request alongside import, restore, policy, dialogs, authentication recovery, submission, and storage errors.
- Its shared `change` function validates bag items, recreates snapshot and selection objects, and serializes the complete draft for ordinary edits.
- `InventorySelector.tsx` derives previews from the snapshot and performs grouping and validation in the rendering path.
- `usePurchaseAnalysis.ts` already excludes iterations from its worker key, but still encodes the request to derive that key. Stale replies are rejected; repeated checkbox changes can still enqueue obsolete work.
- The repository currently has no Zustand dependency. Actual render costs have not been profiled. These are observed dependencies, not a claim that every render is expensive.

## State ownership

Create one vanilla Zustand store per mounted Gear Lab session, provided through a stable React context. Context carries the store instance, not a changing state object. Do not create a module-global session store or access browser storage during server rendering. Existing client-side restore behavior initializes the session after mount.

The draft remains compatible with `TopGearRequest`. Preserve structural sharing between its inventory, selections, purchase inputs, enhancement settings, and execution settings. Avoid duplicating the same editable fact in multiple slices. Keep ordered inventory instances and physical instance IDs intact; never collapse owned duplicates by item ID.

The store exposes commands such as:

- `replaceDraft` for import and restore, with boundary normalization and validation.
- `toggleItem` and `setPurchaseIncluded` for owned and generated item selection.
- `setResourceQuantity`, `addResource`, `removeResource`, and `setGearVariant`.
- Commands for custom item and enhancement edits.
- `setIterations` for execution precision only.

Commands preserve unchanged references and return without updates for no-op edits. Apply relevant domain validation when its inputs change; retain full request validation at submission. No generic whole-request replacement callback remains in ordinary interactive controls.

Dialog visibility, filters, tooltip state, and temporary form values stay with their components. Auth and server configuration retain their existing owners. Submission and retry state belong to a dedicated admission controller rather than the editable draft.

## Component subscriptions and derived data

`TopGearApp` becomes a composition shell for session lifecycle, sections, and controllers. Wallet, equipment slots, rows, and run controls subscribe to the smallest stable values they render. Rows receive stable IDs and subscribe to their own selection and presentation data; they do not receive the entire mutable request.

Pure selectors or cached domain projections provide validation, enhancement previews, candidates, slot grouping, and selected counts. Recompute each projection only when its actual inputs change. A new array or object created on every selector call is not a stable subscription; use stable cached results or shallow comparison where appropriate.

Prefer existing domain functions over copying acquisition logic into the store. Any indexed views of inventory are derived from canonical instances and rebuilt only on inventory changes. Selected membership changes must not rebuild all item previews.

| Interaction | Required work | Work excluded |
| --- | --- | --- |
| Iterations slider | Precision control, execution estimates, final submission precision | Inventory validation, purchase candidate generation, legal-set analysis |
| Item checkbox | Row selection, affected counts, legal-set analysis | HTTP, inventory replacement, whole-table loading |
| Resource quantity or tier variant | Wallet, affected candidates, legal-set analysis | Unrelated owned-item preview work |
| Inventory filter | Visible slot groups | Draft writes, purchase analysis |
| Dialog or tooltip | Local component state | Draft writes, purchase analysis |
| Enhancement edit | Affected previews and dependent legality | Unrelated execution settings |

Global enhancement rules and character/profile changes may legitimately invalidate multiple rows. The target is dependency-correct work, not an arbitrary zero-render rule.

## Calculation coordinator

Separate candidate presentation from expensive legal-combination analysis. Candidate identity and inclusion can update immediately from current inputs; combination counts and allowance may remain pending until the worker finishes.

Construct explicit analysis inputs from gear, selection, acquisition, enhancements, and legality policy. Execution iterations, UI filters, dialog state, storage status, and authentication are not analysis inputs. Serialize only when those analysis inputs change, at the worker boundary. Derive execution estimates from the current precision without regenerating purchase candidates.

Use monotonic revisions and at most one active analysis plus one replaceable pending input. When edits arrive during analysis, replace the pending input with the newest revision instead of posting every intermediate request. A reply may publish only if its revision still matches current inputs. Dispose workers and listeners on session replacement or unmount. Worker failures clear active work and surface a visible retry action for the current inputs.

Keep existing rows and checkbox state visible during selection-only refreshes. Show pending status near affected totals or the run controls. Initial candidate generation may show a scoped loading state. On resource/profile changes, do not label stale prices or availability as current.

Run is available only when the current request has a matching complete, allowed analysis where analysis is required. Check this again at click time using current store state; stale rendered props must not permit an outdated submission. Preserve existing non-purchase legality checks.

## Persistence and admission

Retain the current draft key and `encodeRequest`/`decodeDraft` format. Do not persist the entire Zustand store through generic middleware. Worker output, transient UI, auth, server policy, and admission state are not draft data.

Subscribe to editable draft changes and debounce serialization/writes by 250 ms. Keep the newest draft reference until flushing; do not encode it on every interaction. Flush before submission, sign-in redirects, explicit leave/start navigation, and on page hiding/unmount where browser lifecycle permits. Preserve the existing visible storage-error behavior; browser termination cannot guarantee a final write.

Cancel pending saves on draft discard or replacement before any new save is scheduled. On successful admission, reconcile the latest draft before clearing only the draft matching the submitted request. Cancel any pending write of that completed request so a delayed timer cannot resurrect it. A newer draft must survive admission completion.

Keep the durable admission attempt separate: its serialized body and idempotency key stay immutable while submission is pending or uncertain. Retries use that attempt even when the editable draft has subsequently changed. Preserve auth refresh, anonymous fallback rules, duplicate-submit protection, rejected-attempt handling, and report restoration.

## Migration boundaries

1. Capture a representative interaction baseline and protect behavioral contracts with focused tests.
2. Add the page-scoped store, commands, selectors, and compatibility serializer using existing domain types.
3. Move sidebar, wallet, and equipment subscriptions to those interfaces; remove broad update callbacks incrementally.
4. Introduce dependency-scoped calculation scheduling and debounced draft persistence.
5. Extract admission/session lifecycle orchestration, preserving the existing recovery tests.
6. Verify interaction behavior, render work, draft compatibility, and existing application checks.

Temporary adapters are acceptable during migration but must not leave two editable sources of truth. Final organization should follow these responsibilities; a separate file for every selector or action is unnecessary. No Redux, query library, React Compiler adoption, or state machine framework is needed for this refactor.

## Acceptance and verification

- Two mounted Gear Lab sessions have independent state; unmount removes subscriptions, timers, and workers.
- Existing saved drafts and report-edit drafts restore without a storage migration or lost selections.
- Iteration changes preserve inventory and purchase-input references and produce zero worker analysis requests and zero bag-validation passes.
- Toggling one item updates its checkbox immediately, issues zero HTTP requests, keeps table focus and rows mounted, and leaves unrelated row projections stable.
- Rapid edits keep at most one pending worker input. Out-of-order, stale, failed, or disposed-worker replies cannot publish current allowance or enable Run incorrectly.
- Resource changes, variant filtering, owned-item deduplication, upgrades, exclusions, custom items, and enhancements retain existing domain behavior.
- Fake-timer persistence tests cover batched edits, explicit flush, storage errors, discard, replacement, unmount, and successful admission with a newer draft.
- Existing admission tests continue to cover immutable retries, account recovery, duplicate submissions, matching-draft cleanup, and report navigation.
- Capture React Profiler commits for iterations, one checkbox, and a resource edit using the same large local draft before and after. Also count worker messages and draft writes. Report measurements and limitations; do not claim a percentage speedup without comparable measurements.
- Run relevant unit/UI and integration tests, TypeScript, lint, and applicable design checks. Exercise the actual local interface without restarting the harness that owns the temporary database.

## Tradeoffs

Zustand reduces subscription boilerplate and supports focused updates, but broad selectors could reintroduce the same coupling. The coordinator adds lifecycle responsibilities that require behavioral tests. Debounced saving introduces a short unsaved interval; explicit flushes cover deliberate transitions. Large legal-set analysis and server admission planning can remain slow even when UI updates become responsive.

## Review

Self-review completed: scope, data ownership, worker revision rules, draft lifecycle, and acceptance criteria are explicit. No implementation code or dependencies have changed as part of this specification.
