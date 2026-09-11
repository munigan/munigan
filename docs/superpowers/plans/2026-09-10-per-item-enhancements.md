# Per-item enhancements implementation plan

> Execute with superpowers:subagent-driven-development for the isolated domain task, then integrate and review in this session.

**Goal:** Let users edit gems/enchants on each equipment candidate while respecting automatic settings, preserving the imported baseline, and explaining invalid sets.
**Architecture:** Store explicit per-item overrides separately from imported enhancement values. Resolve them in the existing preparation pipeline and expose the same resolution to the row preview/editor. Reuse Base UI dialogs and the custom-item picker's styling.
**Tech stack:** Next 16, React 19, Base UI 1.8, next-intl, Vitest, Playwright.
**Spec:** docs/design/per-item-enhancements.md plus the user's approved adjustments below.

## Constraints and approved adjustments

- Work in the current shared checkout so the ongoing approved UI work remains available; preserve unrelated edits and do not blanket commit.
- Update Paper first: show resolved enhancement icons for automatic fields, remove Customize, make row activation open editing without toggling selection, and make each icon target its field. Use drawn SVG checkboxes in Paper and accessible checkbox controls in the app.
- Checkbox alone changes item selection. Row keyboard activation must not intercept nested controls. Preserve hover tooltips.
- Keep EN-US/PT-BR translation parity and the existing dark design tokens. No deployment requested in this turn.

## Task 1: Domain preparation, persistence and admission

Files: src/domain/top-gear/model.ts, request-schema.ts; src/domain/equipment/gemming.ts, enhancements.ts, enumerate.ts; src/server/simulator/evaluate.ts and report/work boundaries as necessary; new src/domain/equipment/item-enhancements.ts and tests.

- [x] Add failing tests for a manual gem/enchant, explicit empty values, auto reset, profession/socket legality, JC/unique limits per set, and baseline separation for enhancement-only changes.
- [x] Add ItemEnhancementOverride { gemIds?: (number | null)[]; enchantId?: number } and Snapshot.itemEnhancements?: Record<string, ItemEnhancementOverride>. Null/missing is Automatic; 0 is explicitly empty.
- [x] Export previewItemEnhancements(snapshot, item): ItemInstance, validateItemEnhancements(snapshot, item, override): Diagnostic[], and setItemEnhancements(request, instanceId, override): TopGearRequest. Preserve raw imported item values. Preparation honors fixed fields before automatic JC/meta repair.
- [x] Reject unknown keys/IDs, incompatible gems/enchants and invalid professions in server admission. Preserve serialization/draft round trips. Exclude invalid whole sets and preserve a distinct reference simulation/key/report row.
- [x] Run domain/request/report and native simulator regressions; report exact signatures and reference semantics to the integrating agent.

## Task 2: Paper and equipment editor

Files: docs/design/per-item-enhancements.md; src/features/inventory/InventoryItemRow.tsx, InventorySelector.tsx; new enhancements/ components/styles; messages/en-us/inventory.json and messages/pt-br/inventory.json (actual existing paths).

- [x] Update approved Paper row/checkbox designs and inspect screenshots.
- [x] Add failing UI/browser checks: row opens without toggling, checkbox toggles without opening, specific icon opens its field, automatic values are visible.
- [x] Build one controlled dialog for the selected item, with local pending overrides. Left socket/enchant navigation and right searchable options use the resolved preview, localized descriptions, real checkbox icons, optional unavailable choices and slot/type/profession restrictions.
- [x] Apply calls setItemEnhancements; cancel/X leaves request unchanged. Reset field/item returns to Automatic. Show legal socket bonus matches and profession requirements. Use responsive full-screen mobile layout and focus return.
- [x] Surface invalid item and set conflicts with recovery controls; keep candidate selection independent from editor actions.

## Task 3: Integration and verification

- [x] Add browser coverage for reset/cancel/apply, draft reload, EN/PT, mobile, set conflict feedback, and simulated request payload; use local fixture requests, not paid production jobs.
- [x] Run pnpm typecheck, targeted lint, unit/UI suite, meaningful simulator test, and related existing e2e flows. Inspect desktop/mobile screenshots against Paper.
- [x] Review domain and UI integration independently; fix material findings. Record final verification and limitations without deploying.


## Execution notes — 2026-09-10

Implemented and reviewed in the current checkout. Paper rows and SVG filters were updated before app integration. One independent review finding (inactive meta effects differed for reference/candidate with auto gemming disabled) was reproduced, fixed, and covered by unit/native tests; work identity now includes the corrected meta-rule revision.

Verification: 228 unit/UI tests passed; 11 related browser tests passed including custom items, selection, new editor, draft restoration, focus return and Portuguese mobile. Domain handoff additionally records 10 database orchestration and 5 native simulator checks. Typecheck and scoped lint checked after integration. Desktop/mobile screenshots inspected.

Coverage adjustment: conflict recovery is exercised with actual loadout analysis in a UI integration test; simulator payload/reference preservation is exercised in native and database orchestration tests, rather than submitting a browser job. No production jobs or deployment were used.
