# Interaction contract — revision 4

Static Paper designs specify appearance and transitions; they do not execute these interactions. All three launch tools are free and anonymous. See `screens.json` for actual Paper references and `coverage.md` for exception variants.

## Shared navigation and import

| Source | Trigger | Destination / retained values | Validation and focus |
| --- | --- | --- | --- |
| HOME | Choose a tool | IMPORT when no usable character; otherwise its selection screen | Preserve tool intent through import; focus page heading |
| Any tool | Brand / tool navigation | HOME / requested tool; retain inventory, settings and per-tool selection | No new simulation; announce navigation |
| Header | How it works / Simulator | Local concise help anchored on HOME / pinned simulator external link | Label external link; never transfer raw exports automatically |
| IMPORT | Paste character and optional bags; Continue | IMPORT-REVIEW with parsed source labels | Malformed or wrong expansion stays in field; focus error summary then linked field |
| IMPORT | Advanced profile | PROFILE-IMPORT accepts full simulator JSON or supported simulator link | Allowlisted link decoder; preserve profile settings; do not fetch arbitrary URLs |
| PROFILE-IMPORT | Import profile | IMPORT-REVIEW, equipped gear only unless bags separately supplied | Schema/spec compatibility validation; imported settings override defaults |
| IMPORT-REVIEW | Resolve class/spec or missing fields | Update only those values and provenance | Compatible registry choices; invalid equipped item blocks continuation |
| IMPORT-REVIEW | Exclude unknown bag item | Explicit exclusion recorded; item retained in diagnostics | Unchecked initially; do not silently discard inventory |
| IMPORT-REVIEW | Reimport bags | Confirmation, then replace bag snapshot only | Cancel leaves draft untouched; confirm invalidates stale per-instance selections |
| IMPORT-REVIEW | Continue / settings row | Intended tool / SETTINGS | Preserve owned enhancements, including empty sockets and missing enchants |
| SETTINGS | Choose category preset / edit category | Patch encounter, rotation, raid buffs/debuffs, consumes, talents/glyphs or spec options independently | Mark Preset or Edited; untouched imported categories stay Imported |
| SETTINGS | Reset category | Confirmation; restore this category's compatible simulator default | Cancel returns focus to trigger; never replace equipment or other categories |
| SETTINGS | Save / Back | Originating tool with updated settings | Errors focus first invalid field; draft survives navigation |

Preset and specialization menus derive from the pinned simulator registry. Fury screenshots demonstrate the shared patterns, not a manually limited spec list. Auto rotation and spec-specific controls change with that registry. Preset equipment never becomes owned equipment. Raid/boss choice selects a loot catalog, not encounter mechanics.

## Selection and submission

| Source | Trigger | Destination / retained values | Validation and focus |
| --- | --- | --- | --- |
| TG-SELECT | Toggle checkbox, select all/clear within slot, selected-only filter | Update selection/count; filters do not change selected instances | Semantic checkbox; icon tap opens details separately |
| TG-SELECT | Item menu: lock/unlock | Fix/unfix that slot; recalculate complete legal sets | Preserve enhancement identity and visible Locked cue |
| TG-SELECT | Slot navigation / other equipment disclosure | Scroll or expand owned slot group | Focus group heading; expose expanded state |
| TG-SELECT | Hit allowance boundary | Within/exact limit permits Run; over limit disables Run | Keep choices editable, no silent pruning; focus offending group from review link |
| TG-SELECT | Missing pair / unique conflict / illegal enhancement | ITEM.states validation treatment | Explain specific legal constraint; do not enforce a universal hit/expertise cap |
| BOSS-SELECT | Raid, size, difficulty, boss | Compatible eligible catalog and selection summary | Unavailable combinations visibly disabled; preserve independent encounter preset |
| RAID-SELECT | Raid, size, difficulty; boss/slot filters | Eligible catalog and coverage | Filters change view, explicit inclusion changes candidates; no gains are added together |
| BOSS-SELECT / RAID-SELECT | Review eligible items | LOOT-ITEMS with inclusion checkboxes and source labels | Empty eligible set blocks submission with a useful filter-reset action |
| Loot selection | New-loot gems and enchants | NEW-LOOT deterministic policy and per-item preview | Show actual socket colors; owned enhancements remain fixed |
| Loot selection | Tier tokens | TOKEN-OPTIONS reward choices and prerequisites | One token means one redemption; recipes consume prerequisites/resources |
| TOKEN-OPTIONS | Confirm resource ownership | Feasible candidate or conditional alternative | Unknown/missing resources stay outside actionable ranks; cancel preserves prior choices |
| Mobile selection | Review run | RUN-SUMMARY.mobile, then return to selection or submit | Full-page summary keeps items unobstructed; restore scroll on return |
| Any selection | Run | Server validates snapshot and budget, creates durable JOB/report URL | Double-submit protection; errors preserve draft; queue-full recovery retries admission |

The provisional allowance is 300,000 work units / 5,000 per complete set = 60 sets. At 60 it fits; at 61 it exceeds. Six example sets cost 30,000 units. Budget units are not Monte Carlo fight iterations. Exact/estimated counts must be labeled honestly; server validation is authoritative. Production budgets require benchmarks.

## Progress and reports

| Source | Trigger | Destination / retained values | Validation and focus |
| --- | --- | --- | --- |
| JOB | Server progress | Queued → owned baseline → comparisons → refinement → Complete | Actual completed counts; unknown ETA uses text; polite phase announcements |
| JOB | Copy report link / close tab | Durable read-only URL; local owner capability retained separately | Share link never contains owner cancellation secret or raw import |
| JOB | Cancel | Confirmation → canceled report preserving completed work | Owner only; Cancel dialog retains run; confirm does not claim exhaustive results |
| JOB | Baseline failure / transient failure | Recovery variant, retry creates or resumes the appropriate bounded work | Never rank against a failed baseline; retain diagnostics and completed results |
| TG-RESULT | Select a combination | Preview exact 17-slot set, score and changed slots | Keep numerical ranking, selected state and gain versus equipped C |
| TG-RESULT | Differences versus equipped / top set | Only equipment difference reference changes | Gain remains versus C; control has explicit label |
| TG-RESULT | Fewer changes recommendation | Label least-change candidate in effectively tied group | Preserve numerical sort and highest-set score; uncertainty comes from simulator evidence |
| TG-RESULT | Jump to equipped / pagination | Navigate and focus equipped row / next retained result page | Show evaluated, refined and displayed counts independently |
| TG-RESULT | Row menu / full gear | DETAILS.states menu / FULL-SET | Expose every slot, enhancement and required swap; no icon-only information dependency |
| TG-RESULT | Use set in Droptimizer / Copy set | New draft using this set as equipped reference / sanitized loadout copied | Retain all owned items and settings; original report immutable |
| BOSS-RESULT / RAID-RESULT | Expand drop | DROP-DETAIL and full resulting set | Gain versus best owned B; show owned compensating swaps and prerequisites |
| Drop report | Filter boss/slot, sort DPS/percent | Reorder/filter same independent comparisons | Preserve baseline; zero baseline has unavailable percentage, not infinity |
| DROP-DETAIL | View full set / Back | FULL-SET / originating ranked list | Restore expanded row and scroll; fixed enhancements visible |
| Report | Simulation details / coverage | REPORT-COVERAGE states: sampling, evaluated/refined/displayed coverage and provisional baseline | No false exhaustive claim; unknown uncertainty stays unknown |
| Report | Retry failed comparisons | New work retains successful comparisons; link related report where snapshot changes | Failed row is failure, never zero gain; owner/admission checks apply |
| Report | Edit & run again | Editable draft seeded from snapshot → new report | Read-only shared viewers can create their own draft; cannot mutate/cancel original |
| Report | Invalid / expired URL | REPORT.states recovery or RECOVERY.mobile → new import | No stale private import exposed; expiry duration is provisional |

Best owned C→B is a separate improvement. Drop gains compare each independent resulting set to B and must not be summed. If candidate exploration improves B, affected comparisons are recomputed before final publication; interim rows are provisional. Incomplete search says “best found” with tested coverage. No-improvement, tied, failed, conditional, and unknown uncertainty are distinct states.

## Responsive and accessible behavior

Below 768px use a single column and stacked comparison rows; 768–1023px use a condensed single-column summary; at 1024px and above use the wider workspace where useful. Content max-width is 1280px. Mobile uses inline actions plus a separate full-page run summary, replacing the originally proposed drawer to avoid covering equipment. Menus and details use the same semantic content as the desktop examples, stacked to viewport width.

390px core designs, 320px import/report, 320px with 200% text treatment, and a 768px report are included. These are layout stress references, not proof of browser zoom compliance. All heights grow with content. Labels and long item names wrap; narrow gain lanes stack under names. No horizontal scrolling is required for these examples.

Keyboard order follows visual order. Use labeled inputs, fieldsets/legends for grouped choices, real checkboxes/radios, buttons for actions, and links for navigation. A small visible checkbox has a minimum 44×44px interactive target, as do item-detail/menu controls. Keyboard focus uses a clearly contrasting 2px ring with offset. Do not nest actionable controls inside a clickable row.

Dialogs trap focus, support Escape/Cancel, label their title, and restore focus to the trigger. Destructive replacement/cancellation requires its illustrated confirmation. Disclosures announce expanded state. Error summaries link to invalid inputs; async success/errors use appropriate live regions without announcing every DPS update. Loading never removes the user's editable draft. Progress reports remain readable while updates arrive.

Focused import has a keyboard-space design reference. Real implementation must respond to visual viewport changes and safe-area insets; bottom actions should remain in document flow or reserve their full height. Verify at 320px, browser zoom, enlarged text, keyboard-only navigation and screen readers during code acceptance. Images use item-name alternatives only when otherwise unlabeled; adjacent named images can be decorative. Image failure preserves item name/details and selection controls. Optional Wowhead hover data must also be reachable through local focus/tap details.
