# Raid Trainer — shared-scenario Paper state audit

Reference: WoW Droptimizer Paper pages 18–19, 1440 × 900 artboards, inspected September 10, 2026. Original JSX exports remain in `.cache/raid-trainer/parity-paper/`; Paper was not modified. This audit supersedes the legacy three-cast/six-hit screenshots. The evidence below is the real integrated app at `http://127.0.0.1:3001/raid-trainer`, operated through keyboard/pointer input and its normal replay controls.

## Preserved presentation

The body and canvas surround are `#07080A`. The generated arena occupies an 840 × 840 scene at `(300,24)` on desktop. Circular portraits, top vignette, instruction hierarchy, flat attached-icon timers, shortcut keycaps and Quick Bar remain. Browser checks verify joined/equal-height icon/bar geometry, no timer shadow, timer text layering and arena dimensions.

The approved replay transport remains **720 × 142 at `(360,748)`**, with its original buttons, marker lane, 40px SVG timeline, colors and lack of divider. The compact Recorded event selector is retained in the inspector for coincident events; it does not change the transport. Replay markers select actual recorded event IDs, while the overview can begin at the preceding cast to show context. The inspector identifies the selected event's own timestamp. “Practice this moment” shows and restores the current authored checkpoint at `00:00`.

Timers is still the default. All anticipatory/coaching captures explicitly select Guided. Targets, elapsed times, pool sizes, findings and supporting timers are live state, so their values intentionally differ from static Paper illustrations. Exposure metrics and results follow the shared mechanics, with no six-hit life meter, fixed 57-second pull or fabricated later casts.

## Captured states

Files are in `.cache/raid-trainer/scenarios/`. Desktop captures use 1440 × 900 unless a responsive size is named.

| State | Capture | Audit |
| --- | --- | --- |
| Quick Bar/setup | `setup.png` | One Start game, scenario/focus choice, approved entry layout and black body. |
| Preparation | `preparing.png` | Real held class-image request, progress/cancel control; late completion cannot start a cancelled run. |
| Asset failure | `asset-error.png` | Actual aborted arena request, preserved selection and retry. |
| Audio fallback | `audio-unavailable.png` | Actual unavailable AudioContext with visual practice and Continue without sound. |
| Ready / CIY-0 | `ready.png` | 544px panel at `(448,230)`, Guided/Timers, goal and Start pull. |
| Countdown / CO0-0 | `countdown.png` | Frozen world, countdown and single Cancel pull. |
| Default Timers live | `timers-live.png` | Supporting timers and no anticipatory instruction. |
| Anticipate / CS0-0 | `anticipate.png` | Explicit Guided coaching, imminent timer and shortcut/footer hierarchy. |
| Player targeted / CW0-0 | `targeted.png` | Revealed player target, gold ring and movement cue; no hidden target disclosure. |
| Ally targeted / D00-0 | `ally-targeted.png` | Normal New variation flow, actual revealed teammate and give-room cue. |
| Missed / D40-0 | `missed.png` | Actual damaging tick, coral cue and growing pool. |
| Recovered / D80-0 | `recovered.png` | Player moves clear after damage, green feedback while exposure remains. |
| Paused / DC0-0 | `paused.png` | 528px panel at `(456,272)`, live instruction hidden, frozen time and resume countdown. |
| Focus lost | `focus-lost.png` | Actual blur pauses the controller, preserving elapsed time. |
| Failed / DG0-0 | `platform-overrun.png` | Natural no-input failed pull; pool art remains clipped to platform; real end reason and findings. |
| Clean / DK0-0 | `clean-completion.png` | Ordinary keyboard path, zero primary/supporting misses, actual excerpt completion. |
| Raid-only exposure | `raid-only-exposure.png` | Ordinary route-overlap path; zero personal ticks, four raid ticks, truthful teammate-exposure result. |
| Imperfect / DO0-0 | `imperfect-completion.png` | Actual damage/recovery path and completed excerpt with retained misses. |
| Replay / DS0-0 | `replay.png` | Approved transport, recorded event selector, overview and inspector. |
| Replay ended | `replay-ended.png` | Playback clamps to final frame; Replay again and Back to results. |
| Clean replay | `clean-replay.png` | No positioning misses; recorded placement/path remain reviewable. |
| Checkpoint practice | `practice-checkpoint.png` | Countdown holds the restored `00:00` checkpoint; subsequent focus pause still works. |
| Val’kyr pickup | `valkyr-pickup.png` | First pickup at ~15s with remaining pickups on timer; real passenger/carrier geometry. |
| Val’kyr carry | `valkyr-carry.png` | ~19.5s post-stun carrying state; supporting rescue count still zero. |
| Val’kyr release | `valkyr-release.png` | ~24s, three rescued passengers returning to formation. |
| Spirit activation | `spirit-activation.png` | ~6s during relocation, age-based active wave and supporting threat. |
| Spirit pool/drop | `spirits-moving-you-placement.png` | Ordinary player lateral drop during relocation. |
| Spirit contact/burst | `spirit-contact-burst.png` | ~13.4s, visible burst/intercept rings and zero accidental actor exposure. |
| Spirit completion | `spirits-moving-you-completed.png` | Clean integrated moving-spirit attempt. |
| Frostmourne return | `frostmourne-return.png` | On-platform start, without modeling an interior phase. |
| Return pool/drop | `frostmourne-return-you-placement.png` | Actual return-case Defile placement at ~5s. |
| New return wave | `return-spirit-wave.png` | Age-zero new wave at ~10s. |
| Return activation | `return-spirit-activation.png` | ~40s, thirty-second spirit age, intact shared runtime. |
| Return contact/burst | `return-spirit-contact-burst.png` | ~47.4s, protected soaker contact apart from the raid. |
| Return completion | `frostmourne-return-you-completed.png` | Clean 58-second authored return excerpt. |
| 390 × 844 live/replay | `live-390.png`, `replay-390.png`, `replay-390-transport.png`, `replay-390-inspector.png` | Touch controls, top arena/transport and scrolled inspector. |
| 800 × 650 live/replay | `live-800.png`, `replay-800.png`, `replay-800-transport.png`, `replay-800-inspector.png` | Arena, transport, overview and inspector occupy separate vertical bands. |
| 1100 × 650 live/replay | `live-1100.png`, `replay-1100.png`, `replay-1100-transport.png`, `replay-1100-inspector.png` | Same responsive ordering, no horizontal overflow or overlapping axis labels. |

The 25-player roster is preserved at its actual simulated positions. A 2-yard stacked formation necessarily occludes many individual class portraits: these captures establish readable player/target/soaker priorities and group density, **not individual readability of all 25 portraits**. Rendering offsets were not added because they would misrepresent collision positions. Responsive replay uses internal scrolling; the top arena, scrolled transport and scrolled inspector are captured rather than treating one viewport as the entire panel.

Raid-only exposure is captured from a naturally played path and also covered by the assessment and result-component tests. Other failed/end-reason combinations retain their engine and component coverage. Local spirit feedback, NPC response, rescue scripts, the reachability grid and formation-recovery allowance are documented teaching/automated-support approximations in [gameplay calibration](raid-trainer-gameplay-calibration.md).

## Verification

The final command log and per-case seed outcomes are retained in `.superpowers/sdd/2026-09-10-raid-trainer-shared-scenarios/task-11-report.md` and `.cache/raid-trainer/task-11-final-*.log`. Verification includes all fourteen ordinary-input success cases, their exact seed-7 repeats and seed-18 NPC variation, separate failure traces, fixed-step and checkpoint equality, all actor burst victims, asset/audio cancellation, pointer/keyboard/touch focus, replay controls and responsive non-overlap. No immunity, actor teleport, hidden target assignment or weakened clean-outcome assertion is used by the successful fixtures.
