# Design review log

## 2026-09-08 — revision 1

Used the user-created WoW Droptimizer file. Built Top Gear selection, raid results, foundations, and reusable component states. Created separate direction/components/desktop/mobile/states pages; the original empty Page 1 remains untouched.

Visual reviews: header and hero have deliberate spacing, strong type hierarchy, high text contrast, aligned navigation, no clipping, and restrained repetition. Fixed the initial heading alignment and inherited wordmark color. Equipment rows align selection/icon/name/item-level/source/action lanes; locked state initially wrapped, then fitted its fixed lane using 12px text. Increased interactive border contrast while retaining quiet decorative dividers. Raid results keep a visible baseline and correctly show +150 over 10,200, separate from owned +200. Foundation and component board screenshots reviewed; artboard heights follow content.

User feedback pending at this point; no approval recorded.

## 2026-09-08 — revision 2

User clarified that free Top Gear needs a combination-work limit and rankings of complete equipment combinations, and requested an actual Raidbots run. Completed one three-combination retail run and inspected final report controls; evidence and limitations are recorded in `raidbots-top-gear-observations.md`.

Added a live-budget design to Top Gear selection, a separate over-limit treatment, and a Top Gear report with six complete combinations, equipped reference, gear-difference controls, exact gains, and fewer-changes recommendation. No application code was started. The 300,000-unit / 60-set allowance is a provisional design fixture, not a production commitment.

Visual review: Top Gear report uses consistent numeric/action lanes, readable two-line combination summaries, generous expanded swap details, clear highest/recommended distinction, fit-content height, and controlled repetition. The six rows expose all illustrative combinations. Remaining mobile/full-set screens and final handoff are pending.

Status: awaiting refinement of revision 2. No implicit approval inferred from implementation requests or silence.
