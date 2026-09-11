# Buffs & settings implementation plan

**Goal:** Implement the approved Paper modal and fix overly broad item tooltip hit areas; remove Selected only.
**Architecture:** Preserve the simulator schema and existing patch/validation layer. PresetPanel owns a local Snapshot draft; tab components edit it. Shared compact selects, searchable choices, number steppers and icon segments support the Paper layout.
**Spec:** docs/design/buffs-settings-dialog.md (Paper page M-0)
**Execution:** Inline in the existing shared workspace; preserve unrelated work. No deployment requested.

- [x] Add browser regressions: hover beside a name must not target a tooltip anchor (both item providers); Selected only absent; modal edits survive tabs but commit only on Apply, Cancel preserves original; locale-stable tabs; mobile fits.
- [x] Constrain shared item-link and original trigger sizing, audit usages, remove selected-only state/filter/control.
- [x] Add compact Select, NumberInput with bounded direct entry and step buttons, searchable option disabled/icon support, icon segmented controls. Test number boundaries and unchanged imported values.
- [x] Implement modal shell from Paper: 1200×820 max, 254px dark nav, fixed header/footer, scrollable main; character portrait; stable tab IDs and mobile section picker; local draft, unsaved dismissal and JSON validation.
- [x] Implement all tabs: Encounter presets/window; glyph search/duplicates; real rotation provenance; categorized searchable buffs and numeric controls; flask/elixir exclusive choice and conditional consumes; profession eligibility/conflicts; editable validated Advanced JSON.
- [x] Translate new interface text in en-US/pt-BR. Keep WoW proper names and schema fields intact.
- [x] Verify focused unit and browser suites, typecheck/lint/build; inspect desktop/mobile screenshots and refine. Document any implementation differences without inventing class combat behavior.
