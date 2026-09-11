# Raid Trainer Experiment Implementation Plan

> Execute inline in the current session. The user requested the playable experiment and extensible architecture.

**Goal:** A playable Defile positioning and timer-reading experiment at `/raid-trainer`.

**Architecture:** Encounter data drives a fixed-step simulation; mechanic handlers own hazards; Canvas and React consume snapshots and timeline selectors.

**Tech Stack:** Existing Next.js/React/TypeScript, native Canvas 2D, Vitest and Playwright. No additional runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-raid-trainer-experiment.md`

## Global constraints

- Experimental accelerated timings, explicitly labeled in the UI.
- New files under `src/features/raid-trainer` and a new workbench route; preserve existing uncommitted work.
- No backend, persistence, multiplayer, or full-fight fidelity claims.
- Read installed Next.js client-component and routing documentation before writing the route.

## Tasks

- [x] Implement the data model, Lich King catalog entry, growing-pool mechanic and simulation. Write and run behavioral tests first: casting uses target's final position; empty pools do not grow; damage grows them; expiry removes them; pausing freezes time; normalized diagonal speed; another encounter runs without Lich King identifiers; timers match event execution. Run `pnpm exec vitest run --project unit src/features/raid-trainer/simulation.test.ts`.
- [x] Implement the Canvas renderer and browser controller, including keyboard/touch controls, focus pause, snapshot capture and replay. Simulation exports `createSession`, `advanceSession`, and `getTimers`; renderer exports `drawArena` accepting a snapshot and mode.
- [x] Implement the experiment page, catalog selection, modes, timers, controls, coaching and review with scoped CSS. Add the workbench route and metadata.
- [x] Run focused tests, TypeScript and scoped lint. Exercise the live browser through an attempt, inspect desktop/mobile screenshots, verify pause/retry/review and record results in the spec. Open the experiment for the user.
