# Remaining UI Refinements Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved continuation task by task in the existing workspace.

**Goal:** Complete the remaining visual refinements across import, settings, reports, home, and supporting states.

**Architecture:** Retain the existing import, snapshot, simulation, and report contracts. Add presentation metadata extracted from the pinned simulator and visual editors that patch the same snapshot fields. Keep item rendering through ItemIcon/ItemLink, and retain advanced JSON as an escape hatch.

**Tech Stack:** Existing Next.js 16, React 19, TypeScript, protobuf-generated models, CSS, Vitest, Playwright.

**Spec:** The approved section-by-section UI audit in this conversation, followed by the user's request to continue all remaining refinements. The first pass already completed the compact header, inventory selection, slot locks, enhancement dialog, and persistent run action.

## Constraints

- Preserve the 120-set free allowance, equipped-only selection defaults, pair deduplication, and simulation results.
- Preserve Original/Classic item version selection and complete item tooltips.
- Keep mobile layouts usable at 320px; show clear keyboard focus and dialog close controls.
- No added dependencies, new account requirements, external simulator footer, or realm branding.
- Do not overwrite unrelated uncommitted work. Do not deploy or create commits during this pass.

## 1. Visual simulator settings

Files: create `tools/data/settings-ui.ts`, `data/wotlk/settings-ui.json`, `src/features/settings/VisualSettings.tsx`; modify `PresetPanel.tsx`; add focused settings UI tests.

- [x] Write tests for preserving other buffs when editing one, flask/elixir exclusion, glyph edits, and imported values across dialog navigation.
- [x] Run tests to reproduce the missing visual controls.
- [x] Extract names, icons, values, and glyph descriptions from the pinned source and database. Fail extraction if the pinned revision differs.
- [x] Render grouped searchable buff controls, consumable selectors, glyph selectors, profession icons, and encounter shortcuts. Handle improved buffs and numeric counts distinctly. Editing one field must preserve all others.
- [x] Keep JSON exclusively in Advanced; refresh it from current settings when entering that tab. Add stable dialog sizing, tab keyboard navigation, and explicit focus restoration.
- [x] Run focused tests and typecheck.

## 2. Import and review

Files: `src/features/import/ImportPanel.tsx`, shared class/profession icon presentation in settings UI; browser coverage in `tests/e2e/import-refinements.spec.ts`.

- [x] Add a behavioral test for field-specific malformed bag input and correction without losing the character export.
- [x] Make the two inputs compact numbered sections and identify errors beside the correct field.
- [x] Present the parsed character as a review card with equipped icon preview, profession ranks, supported/unsupported bag counts, and accurate imported/default status labels.
- [x] Replace the help sidebar with a concise addon-help disclosure and copyable command.
- [x] Verify importing still preserves gear and configured defaults.

## 3. Reports and combinations

Files: `src/features/reports/ReportView.tsx`, CSS; focused browser tests.

- [x] Test Changes/Full set preview toggling, equipped zero-change state, and fixed gain baseline when item-difference reference changes.
- [x] Default the compact preview to Changes on mobile while preserving the full desktop set. Display required changes separately from the selected difference reference.
- [x] Add concise rank badges, accessible tie explanation, right-aligned numbers, and segmented item-difference controls. Keep gain numbers explicitly relative to equipped.
- [x] Add inline gem/enchant information to full-set details and a persistent dialog header.
- [x] Improve loading, queue, partial, failed, and canceled state presentation without changing management semantics.

## 4. Home and empty states

Files: `src/app/page.tsx`, optional small home preview component, inventory empty state, CSS.

- [x] Add a clearly labeled sample report preview using existing item icons and a compact three-step explanation.
- [x] Use restrained icy visual accents through CSS; avoid decorative images around working tables.
- [x] Provide a reset action when item selection filters yield empty results.

## 5. Visual validation and completion

- [x] Run focused unit/UI tests and the existing real DPS and tooltip browser tests.
- [x] Capture home, import, review, each settings category, report, full gear, and status states at desktop/mobile sizes.
- [x] Check 320/390/768/1440 widths, short windows, overflow, focus restoration, unchanged imported settings, and active navigation.
- [x] Run lint, typecheck, formatting, and production build; document limitations and mark completed tasks.

## Completion notes — 2026-09-09

Implemented all five steps. The review fixes include bounded percentage inputs for Revitalize, class-appropriate consumable choices, accurate source badges after category replacement, and a visible mobile fewer-swaps badge. Existing imported values are preserved until edited.

Validation:

- 71 unit/UI tests passed.
- 14 browser tests passed, including a real local DPS run, tooltip bounds, import preservation, report states, mobile recommendation visibility, and settings navigation/provenance.
- Typecheck, ESLint, formatting, and production build passed.
- Visual checks at 320, 390, 768, and 1440px, with short-window and keyboard/focus checks. Screenshots are under `.cache/ui-refinements/` and `.cache/ui-audit/report-refinements-*.png`.
- Settings and import/home/report reviews approved after their findings were resolved.

### Regenerating settings presentation metadata

Run `pnpm data:settings` with the pinned simulator checkout at `.cache/wotlk`. The extractor verifies the checkout against `data/wotlk/versions.json`, then reads upstream buff/consume inputs, glyph definitions for all ten classes, and the generated item/spell icon database. It writes `data/wotlk/settings-ui.json` (112 buff entries, 91 consumable entries, 348 glyph entries).

This file supplies labels, icons, glyph descriptions, and presentation limits. Protobuf types and simulator presets remain authoritative for simulation values. Upstream click multipliers are increments, not maximum-value multipliers. Advanced JSON remains available for settings without dedicated controls.

The home page's sample DPS values are explicitly illustrative. No account/payment changes, deployment, or commits were made during this UI pass.
