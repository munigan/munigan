# Raidbots Top Gear: completed-run observations

Observed 2026-09-08 through the live browser. [Completed report](https://www.raidbots.com/simbot/report/u5h76Jss1abpBSYhP4t5iZ).

The user explicitly requested running a simulation to inspect the real behavior. One anonymous run was submitted, using a synthetic retail Fury Warrior, valid talents from SimulationCraft’s current sample profile, two equipped trinkets and one additional bag trinket. Standard Smart Sim precision, Patchwerk, five minutes, one target, Weekly engine. No account or purchase was needed.

## Observed setup and processing

- With only equipped selections, the UI reported one valid combination and requested more options.
- Selecting the third trinket produced three complete combinations and a displayed allowance of 15,000 / 300,000 iterations. That is 5,000 allowance units per combination in this setup; do not infer every precision mode has identical rules.
- Submission opened a durable report URL. The public queue displayed queue position, then processing and a detailed log. The final report showed three actors, 3,929 Smart Sim iterations, approximately 22 DPS / 0.1% error, and five seconds of processing. Actual execution iterations differ from allowance accounting.

## Observed completed report

- Highest result: 21,741.4 mean DPS; second combination: 21,707.7; equipped: 21,681.8. Displayed gains rounded to +60 and +26.
- The full top set appears above the ranking, with changes highlighted.
- The ranking contains complete combinations, an equipped row, a jump-to-equipped action, highlighted sidegrades, and distributions.
- A gear-differences selector switches between equipped and top gear. Clicking top gear changed which item differences were displayed; DPS gain figures remained relative to equipped.
- A fewer-changes preference is enabled for sidegrades. Per-combination menus offer reuse in Top Gear, Droptimizer, Quick Sim, Stat Weights, and clipboard export. Inspected the menu without scheduling another run.
- Report controls include rerun, relative-DPS display, report link, simulation details, raw files, and full HTML output.

## Scope and adaptation

The synthetic input produced warnings about item-level/enchant compatibility and a model buff. The report is evidence of interface behavior only; its numeric outputs are not realistic character advice or WotLK validation. One run is not evidence for every possible report state. [Raidbots sidegrade documentation](https://support.raidbots.com/article/61-top-gear-sidegrades) supplies additional context. [Smart Sim refinement documentation](https://support.raidbots.com/article/64-why-do-gem-enchant-sims-take-so-long) explains staged evaluation.

Our Top Gear design now includes ranked complete loadouts, equipped reference, diff-basis controls, near-tie recommendation, and explicit free allowance. The illustrative WotLK allowance is 300,000 units / 5,000 units per set (60 combinations); benchmark and operator budget determine production values. Actual iteration/time limits remain separate. Our six-set sample has two head choices and three legal trinket pairs; all other slots are fixed and equivalent paired placements are assumed for illustration, to be validated by implementation.

We retain our WotLK-specific frozen talents/enhancements and owned-baseline drop semantics. No retail currencies, talent search, or billing UI is imported from Raidbots.
