# WoW Droptimizer — revision 4 handoff

Status: **reviewed draft, pending user approval**. The user accepted the simplified visual direction and requested the complete flows. That authorizes this design work; full revision 4 approval is not yet recorded. Application coding remains after design approval.

Start with [desktop flows in Paper](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/4-0): Home → Import → Import review → Settings → Top Gear selection → Top Gear report → full set. Then review Boss selection/results and Raid selection/results → upgrade details, plus token options and new-loot enhancements. [Mobile and responsive designs](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/5-0) mirror those flows. [States and flow map](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/6-0) cover validation, progress, failures and report edge cases. [Components](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/3-0) contains the current COMPONENTS.v4 library; the legacy board is historical.

## Contract files

- `screens.json`: actual Paper IDs, page links, dimensions, revision and PNG paths. 53 revision 4 boards, plus six historical references.
- `tokens.css`: exact current Paper Tailwind theme export; final approval remains pending.
- `component-map.json`: nine actual Paper component nodes, exact computed styles and reference JSX paths. JSX is static reference output, not production application code.
- `interactions.md`: navigation, retained state, validation, focus, responsive and recovery behavior.
- `coverage.md`: requirement-to-screen mapping.
- `fixtures.json`: illustrative results and inventory; `review-log.md`: visual review and corrections; `approval.json`: explicit approval gate.

## Future component mapping

| Code component | Paper source | Implementation responsibility |
| --- | --- | --- |
| AppShell | HOME, shared header/navigation, AppShell reference | Tool navigation, retained draft, responsive shell, local help |
| CharacterSummary | IMPORT-REVIEW, CharacterSummary reference | Class/spec, provenance, inventory counts, edit import |
| ImportPanel | IMPORT / PROFILE-IMPORT / IMPORT-REVIEW | Separate character/bag parsing, diagnostics, explicit replacement/exclusion |
| PresetPanel | SETTINGS, SETTINGS.states, PresetPanel reference | Registry-compatible category changes; preserve imported values |
| InventorySelector | TG-SELECT, ITEM.states, InventoryRow reference | Per-instance selection, scoped actions, locks and legal pairs |
| LootSelector | BOSS-SELECT / RAID-SELECT / LOOT-ITEMS / NEW-LOOT | Eligible catalog, inclusion, filters and deterministic enhancements |
| TokenOptions | TOKEN-OPTIONS, DETAILS.states | Recipe alternatives, resource ownership, conditional exclusion |
| RunSummary | TG-SELECT, RUN-SUMMARY.mobile, RunSummary reference | Server-backed allowance, selected context, accessible submit |
| JobProgress | JOB, JOB.states, JobProgress reference | Durable progress, real counts, cancellation and recovery |
| ResultList | TG-RESULT / BOSS-RESULT / RAID-RESULT, CombinationRow / ResultRow references | Complete-set versus independent-drop ranking, uncertainty, pagination and partial coverage |
| EquipmentDiff | DROP-DETAIL / FULL-SET, EquipmentDiff reference | All slots, enhancements, owned swaps and prerequisite consumption |

Use current desktop/mobile records over `.direction` records. COMPONENTS.v4 supersedes COMPONENTS.legacy. Reference JSX records appearance only: rebuild semantic controls and behavior against the interaction contract. All supported DPS specs come from the pinned simulator registry; the Fury example does not hardcode a warrior-only product.

## Responsive and asset decisions

Use Inter for controls and Barlow Condensed 600 for headings, verified available in Paper. The existing neutral slate/ice palette remains; real Wrath item icons provide visual character without another hero image. Below 768px stack; 768–1023px use a condensed layout; ≥1024px allow a two-column workspace up to 1280px. Mobile actions are inline with a dedicated run-summary page. The 320px/200% boards and keyboard-space example are static acceptance references, not completed browser accessibility tests.

Item metadata and icon URLs are recorded in `item-assets.json`; provenance and the future caching/tooltip contract are in `wowhead-item-assets.md`. The observed Wowhead Wrath tooltip JSON endpoint is not an established versioned public API. Cache metadata at ingestion, retain text/image fallback, use pinned simulator data for mechanics, and avoid unsanitized tooltip HTML. No redistribution license is inferred from a publicly accessible URL; runtime distribution policy remains a release concern. Inter and Barlow use OFL licenses; retain upstream license files when adding font assets to the application. No generated art was added.

## Fixture and review limits

Every character/result value is illustrative. Current C=10,000; best owned B=10,200; independent best drop=10,350, hence +150 / +1.47% from B. Top Gear compares to C. Set 01 remains numerically highest; Set 02 is the fewer-changes recommendation within the illustrative tied group. Six legal-set examples and full 17-slot details are design fixtures, not a completed engine legality check.

The 300,000-unit allowance, 5,000-unit set cost, 60-set boundary and 30-day retention are provisional. Actual sampling is distinct from work budgeting. Interrupted/partial examples are alternate state fixtures and do not overwrite the happy-path report. Production limits, uncertainty, catalog availability and all-spec parity require code-phase evidence.

Review the complete visual family for density, navigation and comparison clarity. When the user explicitly approves revision 4 (or its successor), record the exact message/date, update approved screen states and continue with code task C0. Until then, continue only design refinement.
