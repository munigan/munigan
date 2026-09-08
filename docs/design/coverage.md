# Revision 4 coverage

53 current boards: 17 desktop, 25 mobile/responsive, 10 state/reference boards, and one component library. `screens.json` is the authoritative index; revision 1–3 boards remain historical references. Every family was reviewed visually. State boards collect variants of shared screens rather than duplicating whole pages for every branch.

| Family | Primary screen keys | Additional states / references |
| --- | --- | --- |
| Navigation and import | HOME, IMPORT, PROFILE-IMPORT, IMPORT-REVIEW (desktop/mobile) | IMPORT.states: malformed, wrong expansion, ambiguous spec, missing fields; IMPORT-DATA.states: invalid equipped, unknown bag exclusion, replace bags, profile settings |
| Settings | SETTINGS.desktop/mobile | SETTINGS.states: auto rotation, raid buffs/debuffs, consumes, talents/glyphs, spec options, category reset |
| Owned gear | TG-SELECT.desktop/mobile | SELECTION.states: within/exact/over allowance, one valid set; ITEM.states: selected/excluded/equipped/bag, duplicate enhancements, locked, paired weapons, unique conflict, missing partner, profession gem, inactive meta, empty socket, image failure |
| Loot setup | BOSS-SELECT, RAID-SELECT, LOOT-ITEMS, NEW-LOOT, TOKEN-OPTIONS (desktop/mobile) | SELECTION.states: unavailable difficulty and no eligible items; DETAILS.states: feasible and conditional token recipes |
| Work lifecycle | JOB.desktop/mobile | JOB.states: queued, baseline, refinement, complete, cancellation confirmation, canceled partial, baseline failure, queue full |
| Complete-set report | TG-RESULT and FULL-SET (desktop/mobile) | DETAILS.states: row menu, reuse/copy, owned details; REPORT-COVERAGE.states: pagination, evaluated/refined/displayed coverage |
| Drop reports | BOSS-RESULT, RAID-RESULT, DROP-DETAIL (desktop/mobile) | REPORT-COVERAGE.states: provisional baseline, owned swaps, hit/expertise changes; DETAILS.states: token consumption |
| Report exceptions | REPORT.states, RECOVERY.mobile | Failed candidate, incomplete search, no upgrades, unknown uncertainty, zero baseline percentage, expired/invalid URL, read-only sharing |
| Responsive stress | IMPORT.narrow/zoom, RAID-RESULT.narrow/zoom/tablet, IMPORT-FOCUS.mobile | 320px, 200% text, 768px and keyboard-space examples; RUN-SUMMARY.mobile |
| Shared reference | COMPONENTS.v4, FLOW-MAP | Buttons, fields, status/provenance, disclosure, checkbox/radio semantics, image fallback and navigation relationships |

The remaining gates are consolidated user review of this revision and explicit approval before application coding. Runtime engine parity, every-spec presets, real catalog legality, browser interactions, focus behavior and screen-reader output are engineering verification work, not claims made by these static boards.
