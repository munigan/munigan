# Paper parity correction

User requests checking every practice state against Paper pages18/19, correcting discrepancies (especially replay), and extending the arena raster's near-black surround across the whole app body. This is a fidelity correction to approved designs; no new design approval is needed.

Exact current exports: `.cache/raid-trainer/parity-paper/*.jsx`. File01M20P4F8A377J1GT1GGCM3K1Z; page18 K-0 baseCEY-0, page19 L-0.

1. Audit exact Paper layout, typography, state copy, controls and sizes; record mismatches. Preserve actual gameplay values, targets, histories and outcome totals.
2. Independently correct arena camera/scale and tokens against the840px scene, using approved image and preserving the logical simulation boundary. Root owns HTML/CSS, global body background, and replay timeline.
3. Correct shared HUD/Ready/pause/outcomes/replay from exact style exports. Apply #07080A (modal border strip color of the arena raster, already used by Quick Bar) consistently to canvas/game/app body. Preserve surrounding card surfaces and navigation hover behavior.
4. Capture and verify each reachable game state at1440x900, plus supporting-state presentation and mobile usability. Add direct visual geometry/style checks so behavioral tests alone cannot declare parity. Run existing behavior/audio checks where changes affect them. Document remaining deliberate dynamic differences such as player positions and actual times.

No commits, branch changes, or unrelated resets. Existing checkout contains extensive unrelated user work.
