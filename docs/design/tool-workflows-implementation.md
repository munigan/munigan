# Munigan tool workflow implementation

Implemented the approved neutral/open Paper screens without modifying import, enumeration, simulator, backend, or request behavior.

## Design source

Read Paper guide, basic info, exact JSX and computed styles from file `01M20P4F8A377J1GT1GGCM3K1Z`: desktop import `4E6-0`, inventory `4JG-0`, settings `4P6-0`, results `6BT-0`; mobile `7BG-0`, `7GL-0`, `7JZ-0`. Exact exports are saved in `docs/design/paper-tool-*.jsx`. Read the installed Next CSS guide before changes.

## Component map

- ImportPanel retains parsing, resolution, field/error state. ImportReview owns imported identity, equipment, preset, bag compatibility and setting-source presentation. ImportInstructions owns copy-command state and the permanently visible instructional sidebar.
- TopGearApp retains request/draft/recovery/admission/submission state. RunSetup presents character, version selector, simulation and enhancements. RunAllowance presents budget, validation, free limit and run action.
- InventorySelector preserves selection, filters, locks, exclusions and item tooltips, adopts Button and SectionHeading. Its neutral tables retain outer rounded borders with separators only between rows.
- PresetPanel retains settings/provenance mutations and JSON validation. EncounterSettings presents encounter shortcuts/fields with typed callbacks; AdvancedSettings presents the controlled JSON editor/apply action. SettingsNavigation composes Base UI Tabs with vertical desktop and horizontal mobile orientation. Settings/enhancement dialogs use shared Base UI Dialog; manual showModal, cleanup and Escape handlers are removed.
- ReportView retains polling, pagination, comparison selection, sharing, cancellation/retry and draft reuse. ReportLoading, ResultSummary, CombinationTable, GearStrip and FullSet separate presentation. report-presentation contains DPS formatting and accessible direction indicators. FullSet uses the shared focus-managed dialog.
- WowheadTooltips recognizes both native dialogs and Base UI modal dialog hosts, keeping Classic provider tooltips scrollable within the active modal's focus/inert boundary.
- Feature CSS is in the components layer; neutral styles are consolidated by selector and unused collapsed import-help styles removed. PageHeading is used for tool and report headings.

## Intentional presentation changes

- Import help is an open sidebar, becoming a section below the form on narrow screens. Its test now asserts the visible complementary region instead of expanding a disclosure.
- Mobile simulation setup and action follow the inventory in document flow, with a top divider. The mobile action test scrolls to the action before asserting reachability; it still exercises submission errors and overflow.
- Report mobile rows use explicit two-column lanes, with rank/DPS above items/gain, avoiding overlap. Gear preview tiles have equal widths.

## Verification

- TypeScript: passed after feature extraction and shared primitive ref correction.
- ESLint: all four feature folders passed.
- Focused Vitest: 7 files, 24 tests passed.
- Focused Playwright import, selection, settings, reports: 12 tests passed, including modal Escape/focus restoration, enhancements, import data preservation, error recovery and all report run states.
- Additional original/Classic version simulation and setup tests passed.
- Responsive screenshots inspected: `/tmp/munigan-import.png`, `/tmp/munigan-inventory.png`, `/tmp/munigan-inventory-mobile.png`, `/tmp/munigan-settings.png`, `/tmp/munigan-settings-mobile.png`, `/tmp/munigan-report.png`, `/tmp/munigan-report-mobile.png`. Captures use existing fixture data. Some external item icons can appear unloaded when captures run immediately; no asset behavior was changed.
- Real-run local DPS E2E passed unchanged after fixing the Classic tooltip modal host. It verifies focus-triggered tooltip visibility and scrolling at 320×320 inside FullSet.

## Integration notes

Root owns global shell/art/heading styles, primitives, SEO and production verification. Screenshots identified global art opacity and heading stacking discrepancies, communicated to root. Settings DialogContent intentionally overrides primitive padding to allow its header/navigation/body to own padding. No deployment, commit, push or backend changes performed.

## Final review correction

Corrected the desktop/mobile full-gear row selectors to `.report-view.full-set-dialog .full-gear-row`, matching both classes on the same portaled popup. Live Playwright computed-style verification: at 1440px the selector matches and the grid has exactly `82px 44px 804px`; at 390px it matches with `42px 36px 214px`. This removes the unused desktop fourth track and restores the intended narrow mobile slot label lane. No other source changes in this correction.
