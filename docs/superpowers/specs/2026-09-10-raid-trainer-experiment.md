# Raid trainer: Defile experiment

Experience pass 02 is documented in [the design and asset notes](../../design/raid-trainer-experience.md). It adds a preparation countdown, circular boss artwork, generated arena art, focus mode, an audio mixer and timestamp-based replay while retaining this practice preset's rules.

Question: can a short 2D drill teach anticipation from boss-mod timers, safe placement, and movement around teammates?

The user requested a first 2D experiment, expandable to multiple abilities, encounters, and raids, with DBM-style timers. This is an experimental practice preset, not a claim of original/Classic/Warmane encounter parity.

## First playable slice

Route: `/raid-trainer`. A circular arena, keyboard movement, nine scripted teammates, a boss, three Defile casts, pause/retry, guided and timers-only modes, optional warning audio, and an attempt review with a scrubber. Starts only on explicit Start. Losing focus pauses and clears held keys. No accounts or persistence.

Practice defaults: 57 seconds, casts at 8/25/42 seconds, 3-second cast, pool radius 36 world units, +7 units per damaging player per tick, 1-second ticks, 14-second lifetime. These are deliberately accelerated, approximate teaching values. Target sequences alternate player/teammate/player. Player moves at 125 world units/second; diagonal movement is normalized. A platform boundary prevents walking out during this positioning-only exercise. Six personal damage ticks or a pool covering most of the arena ends the attempt.

## Boundaries

- Catalog: raid metadata and encounter definitions, containing actors, arena, abilities and scheduled casts. Adding another encounter using existing mechanics requires data and catalog registration.
- Simulation: fixed 60 Hz clock, input, cast lifecycle, NPC movement, results and hazard state. No React, DOM, canvas or timers from the operating system.
- Mechanics: dispatch by mechanic kind; the first primitive is a growing pool. New mechanics implement their own behavior here, keeping boss names out of the runner.
- Presentation: Canvas 2D renderer consumes a snapshot. React renders selectors, timer bars, coaching, controls and results. A future Phaser renderer can replace Canvas without changing encounter rules.
- Timers: selectors derive countdowns from the very same scheduled cast and regroup events the simulation executes. No independent timer intervals, fabricated bars or future target spoilers.
- Review: bounded in-memory snapshots, movement trail and event history. Scrubbing renders historical snapshots without mutating the completed simulation.

The experiment exposes only the implemented raid, boss and ability. No fake enabled content. New phases and simultaneous abilities can use the timeline and ability registry, but threat, rotations, multiplayer, production fidelity profiles and full fights are outside this slice.

## Training behavior

Guided mode gives a five-second spread warning and placement advice. Timers-only mode retains cast bars, target announcements and danger feedback but removes advance coaching and suggested placement markers. Target is revealed only when casting begins. Non-target teammates spread before the cast, then return; targeted teammates place a pool away from the group and leave it. Teammates avoid existing pools when finding a return route.

Results prioritize completed casts, personal exposure, raid exposure and pool growth over a synthetic score. A clean run means completing all three casts without player or teammate damage. Review explains the observed outcome and supports instant retry. Mobile can inspect and use on-screen directional controls; keyboard is the preferred training input.

## Evidence and limitations

Mechanic reference: https://www.wowhead.com/wotlk/guide/raids/icecrown-citadel/the-lich-king-strategy

Guides disagree on historical details. This experiment validates interaction and architecture; exact radii, tick timing, growth formula, targeting, class speed and server latency need separate validation for each fidelity profile.

## Verification

Headless tests cover moving-target placement at cast completion, damage-driven growth and expiry, fixed-step independence, pause, diagonal movement, timer synchronization and a second data-only encounter. Browser verification covers movement, cast/pool lifecycle, mode selection, pause/resume/retry, audio toggle, review, narrow layout and runtime errors.

## Experiment delivered — 2026-09-10

Run the app with `pnpm dev`, then open http://127.0.0.1:3000/raid-trainer. No database is needed for this route. Press Start, move with WASD/arrows, use Space to pause and R to retry. Changing training mode resets the attempt. Only the implemented catalog entry is exposed.

Validation: `pnpm test` passed 188 tests across 38 files, including six new simulation tests. `pnpm exec tsc --noEmit` and scoped ESLint passed. The independent review also exercised ten safe scripted runs with zero personal or NPC damage. It identified keyboard-control focus and first-touch focus issues; both were corrected and reproduced successfully in the browser check.

Repeat browser verification with the dev server running: `node tests/experiments/raid-trainer.browser.mjs`. The check drives real keyboard and pointer input, advances the browser clock, checks actual canvas player movement, completes a clean run and a failed run, scrubs the recording, verifies synchronized timers and focus pause, and checks a 390-pixel viewport. It passed with zero browser runtime errors. Screenshots are written to `.cache/raid-trainer/`.

Architectural limits: the timeline supports multiple scheduled abilities, but this experiment implements only the growing-pool primitive and a circular platform. Additional mechanic families require new simulation handlers, renderers, movement/lesson behavior and behavioral tests. Additional growing-pool encounters can reuse the existing runner, catalog selectors, timers and data-owned lesson copy. Authentic encounter timing, full-fight phases, per-class controls and raid strategy customization remain future work.
