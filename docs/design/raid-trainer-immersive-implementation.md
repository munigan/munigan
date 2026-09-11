# Immersive practice implementation

Implemented from Paper file `01M20P4F8A377J1GT1GGCM3K1Z`, page 18 (`K-0`, Sculpted Ice `CEY-0`) and page 19 (`L-0`, practice states). Exact design exports used during implementation are cached under `.cache/raid-trainer/paper-game/`. The app ships local assets and has no runtime dependency on Paper.

The approved Quick Bar remains the entry point. Start game prepares the artwork, then opens immersive practice immediately with a three-second countdown. The standalone Ready state is reached by cancelling that countdown. Practice is rendered in a portal over the main app; exiting restores the selected mechanic and keyboard focus to Start game.

## State mapping

| Paper state | Implemented behavior |
|---|---|
| Ready / CIY-0 | Cancel a new countdown, choose the practice mode, or start with Enter. |
| Countdown / CO0-0 | Three seconds before movement and encounter timers begin; Escape cancels. |
| Anticipate / CS0-0 | Guided warning starts five seconds before the next Defile cast. |
| Targeted / CW0-0 | Actual player target, attached-icon cast bar, gold ring, move-away instruction. |
| Ally targeted / D00-0 | The selected teammate’s name and a clear “You are not the target” instruction. |
| Missed / D40-0 | Personal exposure, pool growth and urgent escape feedback. A single tick permits recovery. |
| Recovered / D80-0 | Feedback when the player leaves after taking damage. Teammate-only damage has distinct wording and never increments personal exposure. |
| Paused / DC0-0 | Movement, timers, history and audio freeze. Resume uses another three-second countdown, retaining the exact position and elapsed time. Focus loss identifies the automatic pause. |
| Pull ended / DG0-0 | Platform unusability or an unresolved spirit ends the attempt; damage remains recoverable with real personal/raid findings. |
| Clean / DK0-0 | The excerpt finishes with no primary or supporting positioning misses; Guided completion offers Timers only and review. |
| Imperfect / DO0-0 | Completed with damage; show actual per-cast results and first-mistake review. Unreached casts are labelled accordingly. |
| Replay / DS0-0 | Play/pause, ±1 second, 0.5×/1×/2×, event markers, selected-event inspector, path and growth toggles, muted audio by default, replay end and return to results. |
| Supporting / E74-0 | Loading, loading cancellation/retry, unavailable audio fallback, focus-loss pause, no-damage replay, replay end and practice-from-cast. |

The live HUD uses flat DBM-style bars with flush, equal-height icons, a top vignette behind the instructions, and bordered shortcut keycaps. The original boss and class artwork is retained. Desktop outcomes and replay float around the arena; narrow screens reorganize the information and controls for touch.

## Simulation and replay contract

The app uses one shared runtime. `scenario-content.ts` supplies immutable, serializable `RunSpec` definitions; `scenario-runtime.ts` owns `Attempt` and advances at 60 fixed steps per second, independently of React, canvas, audio and wall-clock timers. Defile, Val’kyrs and Vile Spirits share one world and 25 actors. `raid-strategy.ts` owns delayed observations and purposeful NPC movement. Friendly tokens can overlap.

The optional `afterStep` observer records every resolved step through `recordStep`; `Recording` stores 10 Hz frames plus exact event/checkpoint/terminal steps. `Frame` excludes cumulative events/findings/checkpoints. `readAttempt` is the live-view boundary and replay uses `frameView`/`readWorldView`, preserving event IDs separately from source IDs. Focus changes assessment categories without changing the world.

`scenario-assessment.ts` derives primary/supporting findings and truthful end reasons. `scenarioAudioCues` uses observable view changes in live and replay. Retry and R preserve scenario and seed; New variation explicitly changes supported variation. Timers is the default. The small Recorded event selector supplements the unchanged approved timeline/transport so coincident markers remain exactly selectable.

“Practice this moment” restores the saved scenario checkpoint, including RNG, queued perceptions, pools/recovery allowances, spirits, carriers and findings. The current authored checkpoints start at GO; the UI displays that exact time. Resume pause keeps its recording, while checkpoint practice branches a recording without future events. Incompatible revisions fail visibly into same-scenario retry. Replay seeking pauses playback and clamps to the final frame.

The superseded `simulation.ts`, `mechanics.ts`, `movement.ts`, `encounters.ts`, `render-arena.ts`, old `model.ts`, old audio adapters and old simulation tests were removed after moving the remaining asset/camera consumers and verifying equivalent behavior against the new runtime. No introductory second engine remains.

## Assets and audio

- `public/raid-trainer/art/arena-sculpted-ice.png`: the user-selected generated arena, reused from Paper and Quick Bar. See `raid-trainer-quick-bar-assets.md` for provenance.
- `art/classes/*.jpg`: ten WoW class portraits with class-color rings; the player has a larger blue ring that turns gold when targeted and coral in a pool.
- `art/lich-king.jpg`, `art/defile.jpg`, `art/regroup.jpg`: local boss and spell artwork used in the approved design. Blizzard artwork sourced through Wowhead’s icon CDN.
- `arena-assets.ts` shares a decoded-image cache between loading and canvas rendering. Each load/decode has a ten-second deadline; failed requests can be retried. Cancelling preparation prevents late completion from starting a game.
- Existing 12 original voice callouts, DBM’s credited AirHorn sample and synthesized ambience/effects remain. Master volume, voice and ambience preferences persist across pulls for the current page. Replay defaults to muted. Pause, seek, mute and exit cancel active samples, including when ambience is already inactive.

Public credits remain linked from Sound studio at `/raid-trainer/credits.txt`.

## Verification

- Unit checks cover fixed-step simulation, all fourteen authored target cases, exact checkpoints, event metadata and seeking, cast restoration, outcomes/cues and inactive replay voice cancellation.
- Browser flows cover loading/retry/cancel, Quick Bar return focus, countdown/ready, frozen pause/resume, focus loss, target/teammate warnings, damage/recovery, failure, clean and imperfect completion, flat timer geometry, replay controls, recorded event selection, practice restoration, mobile first-press movement, guide keyboard behavior and preferences.
- Real Web Audio checks decode all 13 shipped samples and exercise delayed preview cancellation, retry, paused silence, resume and persistent settings.
- Visual captures are stored in `.cache/raid-trainer/scenarios/` for countdown, anticipation, targeting, damage, recovery, pause, failure, both completion outcomes and desktop/mobile replay.

For the subsequent visual fidelity correction, see [Paper state audit](raid-trainer-paper-state-audit.md). That audit supersedes the original visual verification: it records exact artboard geometry, state-by-state comparisons, replay corrections, responsive checks and the dynamic values that remain supplied by the simulation.

Final shared-scenario verification and captured-state details live in the [Paper state audit](raid-trainer-paper-state-audit.md). Revision 2 support behavior, the 1-yard platform grid, bounded target recovery and all teaching approximations are documented in [gameplay calibration](raid-trainer-gameplay-calibration.md). Existing Blizzard/generated arena and original SVG silhouette credits remain at `public/raid-trainer/credits.txt`; no new media was added during migration.
