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
| Pull ended / DG0-0 | Six personal ticks or a platform overrun end the attempt, with distinct explanations and actual metrics. |
| Clean / DK0-0 | All casts finished without personal or raid damage; offer Timers only and placement review. |
| Imperfect / DO0-0 | Completed with damage; show actual per-cast results and first-mistake review. Unreached casts are labelled accordingly. |
| Replay / DS0-0 | Play/pause, ±1 second, 0.5×/1×/2×, event markers, selected-event inspector, path and growth toggles, muted audio by default, replay end and return to results. |
| Supporting / E74-0 | Loading, loading cancellation/retry, unavailable audio fallback, focus-loss pause, no-damage replay, replay end and practice-from-cast. |

The live HUD uses flat DBM-style bars with flush, equal-height icons, a top vignette behind the instructions, and bordered shortcut keycaps. The original boss and class artwork is retained. Desktop outcomes and replay float around the arena; narrow screens reorganize the information and controls for touch.

## Simulation and replay contract

`encounters.ts` contains encounter timing, actor setup, artwork and ability configuration. `model.ts`, `movement.ts`, `mechanics.ts` and `simulation.ts` remain independent of React. Encounter definitions can change bosses, artwork, casts and timing; the first mechanic handler remains the growing pool used by Defile.

The simulation advances at 60 fixed steps per second. The optional `afterStep` observer records 10 Hz snapshots, exact pre-cast checkpoints, event transitions and the terminal state. Recording inside the simulation step prevents browser frame jitter from moving replay markers before their corresponding event.

Recorded events carry cast IDs, actor IDs, positions and personal/raid/growth deltas. `practice-state.ts` derives guidance, outcomes and per-cast summaries from these events. `eventReplayTime()` selects a snapshot that actually contains the selected event. Seeking always pauses playback. The cast selected in results is also the cast shown in the replay inspector.

“Practice cast” restores the recorded snapshot two seconds before that cast, including actor positions, active pools, earlier events and the original seed. Resume never clears the recording. A new pull uses a fresh session. Replay playback is timestamp-based and clamps to the final frame.

## Assets and audio

- `public/raid-trainer/art/arena-sculpted-ice.png`: the user-selected generated arena, reused from Paper and Quick Bar. See `raid-trainer-quick-bar-assets.md` for provenance.
- `art/classes/*.jpg`: ten WoW class portraits with class-color rings; the player has a larger blue ring that turns gold when targeted and coral in a pool.
- `art/lich-king.jpg`, `art/defile.jpg`, `art/regroup.jpg`: local boss and spell artwork used in the approved design. Blizzard artwork sourced through Wowhead’s icon CDN.
- `arena-assets.ts` shares a decoded-image cache between loading and canvas rendering. Each load/decode has a ten-second deadline; failed requests can be retried. Cancelling preparation prevents late completion from starting a game.
- Existing 12 original voice callouts, DBM’s credited AirHorn sample and synthesized ambience/effects remain. Master volume, voice and ambience preferences persist across pulls for the current page. Replay defaults to muted. Pause, seek, mute and exit cancel active samples, including when ambience is already inactive.

Public credits remain linked from Sound studio at `/raid-trainer/credits.txt`.

## Verification

- Unit checks cover fixed-step simulation, alternate encounter data, exact checkpoints, event metadata and seeking, cast restoration, outcomes/cues and inactive replay voice cancellation.
- Browser flows cover loading/retry/cancel, Quick Bar return focus, countdown/ready, frozen pause/resume, focus loss, target/teammate warnings, damage/recovery, failure, clean and imperfect completion, flat timer geometry, replay controls, later-cast selection, practice restoration, mobile first-press movement, guide keyboard behavior and preferences.
- Real Web Audio checks decode all 13 shipped samples and exercise delayed preview cancellation, retry, paused silence, resume and persistent settings.
- Visual captures are stored in `.cache/raid-trainer/verified/` for countdown, anticipation, targeting, damage, recovery, pause, failure, both completion outcomes and desktop/mobile replay.

For the subsequent visual fidelity correction, see [Paper state audit](raid-trainer-paper-state-audit.md). That audit supersedes the original visual verification: it records exact artboard geometry, state-by-state comparisons, replay corrections, responsive checks and the dynamic values that remain supplied by the simulation.
