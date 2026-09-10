# Raid Trainer: shared scenarios and realistic positioning

Date: September 10, 2026. Status: proposed design for user review; no gameplay implementation changes in this design pass.

## Purpose and accepted direction

The trainer should develop positioning decisions that transfer to a raid: watching multiple timers, staying with the group when required, separating from a targeted teammate, placing hazards clear of the next raid position, and reacting to other players moving along the same route.

The user approved a shared encounter simulation with distinct training objectives, then identified four Defile scenario families. A mechanic describes an ability. A raid strategy describes coordinated responsibilities and movement. A scenario combines mechanics and strategy over an encounter excerpt. A drill selects what the player practices within that scenario.

The existing experiment is deliberately simplified: ten actors, scheduled player/teammate/player targeting, immediate NPC responses, three-second casts, and uniformly timed spreading. It remains a useful reference for controls and presentation, but those teaching values are not evidence of encounter accuracy.

Working reference: Warmane 3.3.5, 25-player Heroic. This was proposed as the default and remains an explicit working assumption, not a claim that every numeric rule has been verified. Existing catalogue copy saying “Wrath Classic” must not label the new profile.

## Scope and alternatives

Use curated encounter excerpts with shared mechanics. Separate minigames would duplicate Defile and movement behavior. A complete boss simulation would require unrelated combat systems before delivering useful positioning practice. Curated excerpts preserve the decisions around the selected mechanic and make their timing and outcomes testable.

The first delivery covers the four Defile families below, using 25 raid actors, shared Defile behavior, Val’kyr support behavior, Vile Spirits support behavior, and coordinated raid movement. The controlled actor is a melee damage dealer; the existing class portrait is identification, not a promise of class spells. NPCs perform tanking, healing, damage and assigned soaking. Supporting combat is simplified and must be described as automated.

The Frostmourne-return exercise begins on the platform after the return. It does not require implementing the room’s bombs or playing the full encounter beforehand. Full rotations, user-controlled soaking, class movement abilities, multiplayer, arbitrary mechanic combinations and every raid role are outside this first delivery. The architecture permits a later Vile Spirits drill to reuse the same phase-three scenario.

## Four scenario families

| Family                          | Situation                                                     | Decision to practice                                                                       | Supporting world                                       |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Defile before Val’kyrs          | Defile precedes the next pickups                              | Separate the target while preserving or rebuilding the required stack                      | Upcoming Val’kyr pickups and the next formation        |
| Defile after Val’kyr pickups    | Pickups finish before Defile                                  | Hold the stack until the appropriate moment, then separate while the raid handles the adds | Carried NPCs, Val’kyr routes and automated control     |
| Defile during Vile Spirits      | Spirits are active during relocation or at the next formation | Drop clear of the raid’s route and avoid spirit explosions                                 | Relocation, spirit pursuit and an assigned NPC soaker  |
| Defile after Frostmourne return | The raid returns to the platform with Defile imminent         | Reorient, identify the target, separate, then resume the phase-three formation             | Platform return and the applicable phase-three hazards |

“Almost simultaneous” is a close-overlap variation of the first two families. Preserve whether Defile precedes or follows pickups; do not replace the event order with an arbitrary simultaneous trigger. The phase-three family has relocating and settled-formation variations because the useful drop position changes with the raid’s intended movement.

Each family includes player-targeted and nearby-teammate-targeted situations. Sampling deliberately ensures relevant practice; it is not presented as the encounter’s natural probability of targeting the player. In this first Defile-focused delivery, Val’kyr victims are NPCs so the controlled actor remains available for the positioning lesson. This conditioning is stated in the drill’s detailed scope.

Variants change initial positions within the formation, eligible targets, teammate reaction behavior and supported encounter overlaps. They do not shuffle boss events into sequences the reference encounter cannot produce.

## Domain model and ownership

| Definition        | Owns                                                                                                                      | Does not own                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Encounter profile | Edition/server, raid size, difficulty, arena scale, movement and spell parameters, provenance and revision                | Coaching or assessment                   |
| Mechanic          | Targeting eligibility, lifecycle, hazards, forced effects, damage/explosion events                                        | Whole-raid choreography or tutorial text |
| Raid strategy     | Assignments, formation anchors, relocation stages, intended travel areas and response to observed hazards                 | Spell growth or damage formulas          |
| Scenario          | Initial world, active mechanics, authored event sequence, strategy, variation constraints, checkpoints and end conditions | A duplicate implementation of an ability |
| Drill             | Focus mechanic, controlled responsibility, default scenario selection, coaching and assessment objectives                 | Different physics for the same scenario  |
| Attempt           | Exact profile/scenario revisions, seed, initial conditions, input, events, assessments and replay state                   | Mutable catalogue definitions            |

Defile has one implementation per applicable ruleset. The phase-two and phase-three scenarios schedule it with their own surrounding events. Vile Spirits has a separate implementation for its lifecycle, pursuit and explosions. Reusable geometry and movement primitives stay internal to these modules unless a second real use warrants a shared interface.

Changing the drill focus must not change the physical world when profile, scenario, variant, seed and input are identical. For example, a Defile drill and a future spirit-avoidance drill can generate identical phase-three recordings while producing different lesson summaries.

## Simulation and movement architecture

Keep the fixed 60 Hz simulation independent of React, canvas, audio and wall-clock timers. The simulation module exposes a small interface: create an attempt from validated definitions; advance it with elapsed time and input; obtain a read-only view; and restore a supported checkpoint. Scenario setup, mechanic dispatch and NPC decisions remain inside that module.

At each simulation step:

1. Process due scenario events and mechanic state changes, including target selection and control effects.
2. Update each actor’s observed information and reaction deadlines. NPCs cannot use an unrevealed target or an unobserved hazard.
3. Update strategy assignments and choose voluntary movement from those observations.
4. Integrate movement once per actor, respecting any mechanic-imposed movement or loss of control.
5. Resolve cast completion, contact, damage and hazard lifecycle events using a documented, stable ordering.
6. Evaluate objectives and capture events or checkpoints required for review.

Boundary ordering must be explicit in tests, including movement at cast completion and pickups close to a Defile cast. Iterate simultaneous hit detection from a common state so array order cannot change which actors are hit. Preserve the current fixed-step independence across display frame rates.

One movement module resolves voluntary actor movement. Mechanics supply hazards and forced effects; strategy supplies a responsibility and destination. No independent Defile and Vile Spirits loops may each move the same NPC in one step.

Examples of responsibilities:

- An ordinary raider follows the required formation while avoiding known hazards.
- A Defile target separates toward a suitable drop area, exits the pool and then rejoins.
- A spirit soaker approaches assigned spirits under the scenario’s protective arrangement; ordinary raiders keep clear of the resulting explosions.
- A Val’kyr passenger follows forced movement and cannot also execute a normal running decision.

NPC behavior uses seeded reaction delays and stable preferences for departure direction. Once moving, actors hold their intended route long enough to appear purposeful, then reevaluate when observed conditions change. A nearby actor can choose the same direction as the player. Actors do not continually jitter or instantly fan out into perfectly spaced positions.

Actors may overlap; there is no physical body-blocking between friendly tokens. Crowding matters because it changes hazard exposure and viable drop space. Movement speed, arena dimensions and hazard dimensions share world units. Decorative icon sizes must not silently become collision radii.

A strategy’s intended route is an area that can adapt around observed hazards, not an immutable line all NPCs follow. If a pool intersects that area, report the observed intersection; only call a route blocked when the movement query finds no supported path. The NPC variation set must contain successful examples for each family, so randomness does not manufacture unavoidable baseline failures.

## Timing, difficulty and evidence

Retain the order and meaningful spacing of encounter events within each excerpt. Remove unrelated lead-in time by starting at an authored world state; do not speed up the entire encounter clock. A checkpoint begins before the earliest decision relevant to its assessment, not automatically two seconds before every Defile.

Each numeric profile field records its value, units, applicable version, source and evidence status. This includes cast duration, target eligibility, target-reveal timing, first damage tick, subsequent ticks, growth, lifetime, movement speed, spirit activation/contact/explosion rules and Val’kyr movement. Strategies separately record their formation and assignment assumptions.

Evidence status distinguishes measured encounter data, documented references and explicit teaching approximations. Missing required values or invalid units fail definition validation. A usable approximation can support a clearly labelled positioning practice profile, but does not establish exact Warmane parity. Reviewed encounter captures are required before labelling a profile timing-verified. The older experiment’s constants must not enter the new profile accidentally as defaults.

The sources support the four scenario families but do not settle every numeric parameter. Community descriptions of Defile on return from Frostmourne vary between “immediately” and a few seconds. DBM is evidence for addon behavior and expected timers, not an authoritative substitute for the encounter engine.

Difficulty comes from authored overlap, formation density, valid target variation, teammate response variation and coaching level. It does not arbitrarily change Defile’s cast duration, radius or growth while continuing to claim the same encounter profile.

Timers-only becomes the default for the new drills. It retains relevant boss timers, target announcements and immediate danger warnings. Guided mode adds advance explanations and helpful formation/placement cues. Supporting active dangers remain visible in either mode. Timer predictions update from observed encounter events and remain separate from secret future target selection.

## Assessment and outcomes

Track three results separately: the selected lesson’s objectives, supporting-mechanic findings, and why the attempt ended. Completing Defile placement does not excuse a spirit hit; a spirit hit does not rewrite a clean Defile placement as a placement failure.

Initial objectives use recorded facts:

- Presence inside the assigned formation region at the required pickup milestone.
- Personal Defile exposure and exposure of other actors, identified separately.
- Pool placement relative to the next formation and intended travel area.
- Return to the assigned formation by its scenario-defined milestone.
- Personal spirit-explosion exposure while following the assigned role.

Only evaluate a stack/return obligation when it applies to the actor’s current responsibility. The Defile target may be required to leave the stack, and a carried actor cannot be judged as voluntarily failing to return. Immediate danger can also justify a temporary deviation; the record must preserve the reason.

Use objective-specific findings such as “outside the stack at pickup,” “pool overlapped the planned raid route,” or “hit by a spirit explosion.” Avoid unsupported causal claims such as “you caused the wipe.” A companion’s exposure is recorded as that actor’s exposure; assigning blame requires evidence beyond the shared pool identifier.

The first delivery is a positioning simulation with automated support, not a complete health/healing model. Exposure marks an objective as imperfect and can continue through a recovery window. It must not be relabelled as death merely because an arbitrary tick count was reached. End at the authored exercise endpoint, or earlier when a modeled event makes the exercise unrecoverable, such as loss of the required actor or loss of usable platform space. Any safety termination uses an accurate “drill ended” explanation.

Results retain the approved clean, imperfect, recovered and failed presentation states, populated from these findings. Example: “Defile placement: clean. Spirit avoidance: hit once. Drill completed.” A run with a failed supporting objective is not labelled an overall clean success.

## Replay and retry

Replay must record the whole scenario: all actors, active mechanics, forced movement, relevant strategy state, target observations, event identities and objective findings. The existing cast/pool/damage event vocabulary expands to include pickup, release, relocation, spirit activation/explosion and return-to-platform events.

Keep immutable event and mechanic-instance identifiers across copied snapshots. The selected focus changes which events are emphasized, not which events survive recording. Inspectors can show the Defile target’s route together with the raid’s movement and nearby explosions without reconstructing them from the current NPC logic.

Checkpoint state includes the event cursor, pending mechanic events, all actor states, NPC reaction deadlines and intentions, strategy stage, hazards, RNG state and relevant assessment history. A visible snapshot alone is not sufficient to restart a deterministic attempt.

Retry and the R shortcut restore the same starting situation and seed. A separately labelled New variation changes the variation/seed. Practicing a selected event restores the checkpoint before its earliest relevant decision, including a preceding stack or relocation instruction. Different player choices can produce different NPC responses after that shared starting point.

Keep bounded history. Definitions declare excerpt duration, event/actor limits and the supported capture rate. Reuse the existing compact replay transport, selection, speed and sound controls; do not redesign the approved replay screen.

## Setup and presentation

Keep the approved Quick Bar and one Start game action. Selecting Defile shows its existing details plus a compact Scenario selector. Default is Mixed practice; the other options are the four named families. Mixed practice launches one authored excerpt, then New variation cycles through eligible families before repeating them. Retry stays on the same excerpt.

Show supporting mechanics in the brief, for example “Also active: Vile Spirits.” Close-overlap variants are selected within a family and do not create another required setup step. Formation responsibility and automated support are available in mechanic details.

Keep the circular portraits, arena artwork, black body, top vignette, flat attached-icon timer bars and shortcut keycaps approved in Paper. Twenty-five-player stacking must remain visually legible without spreading the simulated actors for decoration: prioritize the controlled actor, targeted actor, soaker and raid marker; de-emphasize ordinary labels and decorative rings when crowded.

Add only the visual states required by the active mechanics: Val’kyr pickup/carry/release, spirit activation/pursuit/explosion, formation/relocation cues, and platform return. Their danger geometry must agree with the simulation. Pause, focus loss, preparation cancellation, audio fallback and responsive replay remain supported.

## Fit with the existing code

- `model.ts` and `training-catalog.ts`: separate profile, mechanic, strategy, scenario and drill definitions. Replace the current one-drill-to-one-complete-encounter assumption.
- `encounters.ts`: move the current monolithic preset into explicit scenario content; preserve it as a named introductory preset where useful.
- `mechanics.ts`: retain shared Defile behavior and introduce the actual supporting mechanic lifecycles. Boss-specific choreography stays in scenario/strategy definitions.
- `movement.ts`: replace fixed expanded-home positions with responsibility-based, seeded decisions through one movement interface.
- `simulation.ts`: remain the sole world clock, with stable event ordering and validated scenario execution.
- `practice-state.ts`, `replay.ts` and `use-trainer.ts`: capture/restore complete checkpoint state, separate retry from variation, and derive presentation from the expanded recorded world.
- `TrainerSetup.tsx`, `TrainerExperiment.tsx`, `GameReview.tsx`, `render-arena.ts` and audio selectors: consume the new views while preserving approved layout and controls.

Split files when responsibilities warrant it; do not introduce a generic scripting language, an event bus shared across the app, or a plugin framework for hypothetical future mechanics. These four scenarios provide the concrete reuse cases for the initial interfaces.

## Validation and delivery sequence

First establish the shared definitions and one before/after-Val’kyr pair, with valid reference parameters and both player/teammate targeting. Verify stack timing, purposeful NPC movement and deterministic replay. Then add the close-overlap variations. Next add the shared spirit/relocation situation and the Frostmourne-return excerpt. Finally expose all four families through the simple selector and verify every affected Paper state.

Required behavioral checks:

1. Identical scenario, revision, seed and inputs generate identical world events when only drill focus or coaching changes.
2. The same Defile implementation places and grows pools correctly in both phase-two and phase-three contexts.
3. Each family has a successful movement example; staying at the edge fails applicable formation objectives.
4. An NPC can share the player’s initial route, react after its scheduled observation delay and change direction without jitter or future knowledge.
5. A soaker’s intentional approach is distinguished from an ordinary raider’s explosion exposure.
6. Event ordering handles tight pickups/Defile correctly and is unchanged by frame rate or actor iteration order.
7. Recorded outcomes distinguish personal exposure, other actors’ exposure, failed objectives and modeled end conditions.
8. Restoring a checkpoint reproduces pending events and NPC behavior with identical input, including ongoing spirits and a preceding relocation.
9. Retry preserves the situation; New variation selects another valid situation. Neither reveals the next target early.
10. Active supporting warnings, pause/resume, focus loss, audio cancellation, keyboard/touch controls and replay remain functional.
11. Twenty-five actors, all relevant hazards and the expanded replay remain legible at the approved desktop size and reflow on supported smaller screens.
12. Profile validation rejects invalid references, incomplete required parameters and inconsistent units with a useful setup error. An asset failure retains the existing retry/cancel behavior; optional audio failure still allows visual practice.

This document defines the architecture and gameplay requirements. The subsequent implementation plan must attach concrete numeric profile values and their evidence status before changing timing/geometry, and must not describe unverified approximations as authentic server behavior.

## Sources

- [Paragon: Lich King 25-man Hard Mode Spirit soak tactic](https://paragon.fi/node/160.html). Firsthand original-Wrath strategy: Val’kyr/Defile ordering, raid movement, assigned soaking and return from Frostmourne. Supports scenario structure, not exact Warmane timings.
- [Warmane: Icecrown Citadel 25 Heroic Mode Detailed Strategy Guide](https://forum.warmane.com/showthread.php?t=324235). Community strategy and reported mechanics; not an authoritative current server specification.
- [Warmane: PVE ICC Guide](https://forum.warmane.com/showthread.php?t=415337). Community discussion of keeping Val’kyr paths clear and handling Defile before versus after pickups.
- [Warmane: Playing MM Hunter in ICC 25hc](https://forum.warmane.com/showthread.php?t=294275). Role-specific account, including a different description of the delay after Frostmourne; illustrates the need for version-specific measurement.
- [DBM LichKing.lua, revision fb69197a6c5eca13fd6c683b081b1bcb713042ef](https://github.com/DeadlyBossMods/DBM-WotLK/blob/fb69197a6c5eca13fd6c683b081b1bcb713042ef/DBM-Raids-WoTLK/Icecrown/TheFrozenThrone/LichKing.lua). Primary addon source for separate timers, target scanning and phase-related cancellation. Not the encounter’s server implementation.

Sources inspected September 10, 2026. Existing implementation context: [initial Defile experiment](2026-09-10-raid-trainer-experiment.md) and [Paper state fidelity audit](../../design/raid-trainer-paper-state-audit.md).
