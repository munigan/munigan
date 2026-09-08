# Draft interaction contract

Revision 2. These are annotations for static Paper screens, not working browser behavior. No final visual approval yet.

| Source | Action | Result and retained context |
| --- | --- | --- |
| TG-SELECT.direction | Toggle item / lock slot | Recalculate legal combination count and allowance; preserve imported inventory and enhancements |
| TG-SELECT.direction | Exceed free allowance | Show TG-LIMIT treatment and disable Run; keep selections editable, no silent pruning |
| TG-LIMIT.direction | Review trinkets | Focus relevant slot group; removal/lock recalculates the count and restores Run when valid |
| TG-SELECT.direction | Find Top Gear | Server independently validates allowance; queue a snapshot and open durable progress/report URL |
| TG-RESULT.direction | Expand a row | Show every required swap, preserved enhancements, and full-set disclosure for that exact combination |
| TG-RESULT.direction | Equipped / Top set difference toggle | Change only gear-diff reference; DPS gains remain versus current equipped snapshot |
| TG-RESULT.direction | Prefer fewer changes | Recommend the least-change set in the tied group; keep exact numerical sort and highest-set header |
| TG-RESULT.direction | Jump to equipped | Scroll/focus the equipped reference, even if it is on another result page |
| TG-RESULT.direction | View all slots | Reveal all 17 slot assignments and enhancement details, not only changed items |
| TG-RESULT.direction | Use this set in Droptimizer | Explicitly create a draft with that equipped reference while retaining all owned items/settings |
| RAID-RESULT.direction | Expand drop | Show the complete resulting set and all owned swaps; delta is from best owned baseline |
| RAID-RESULT.direction | Review tier tokens | Ask for prerequisite inventory/resources; keep conditional outcomes outside actionable rankings |

Checkbox and lock actions require semantic labels and keyboard support. Selected/locked/unknown/error states have text cues. Error links focus their field. Disclosure controls announce expanded state; closing returns focus to the trigger. Later responsive work must avoid fixed controls covering content at 320px or 200% text zoom.

The free allowance uses versioned budget accounting; it is not the number of Monte Carlo fights already run. UI shows exact counts only when available, otherwise a clearly marked estimate/upper bound. Actual iterations/refinement and partial-search coverage belong in report details. Boundary behavior: at 60 sets the illustrative standard allowance fits; at 61 it exceeds. The separate 72-set board illustrates a larger overage.

Remaining D3–D8 work: import/settings, complete boss/raid setup, full-set and token dialogs, progress/exception screens, mobile/tablet variants, refinement, exports, final approval. The current direction boards do not imply these deliverables already exist.
