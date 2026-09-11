# Immersive Raid Trainer implementation

**Goal:** Implement the approved Sculpted Ice game and all practice states from Paper pages 18 and 19.
**Spec:** Paper file 01M20P4F8A377J1GT1GGCM3K1Z pages K-0 and L-0; exact JSX exports in `.cache/raid-trainer/paper-game/`. Existing approved Quick Bar remains the entry point; no forced extra Ready screen. Ready design is shown on cancel/countdown return and supports mode choice.
**Architecture:** Keep fixed-step encounter simulation and separate its state, presentation, canvas art, and React controls. Extend recorded events with actor/cast identities for truthful outcome summaries, replay annotations and exact practice snapshots. Data determines every number, target and failure reason.

## Global constraints
- Preserve shared app layout and brightness-only navigation hover; scope styles to game.
- Keep original audio assets and expose unavailable audio fallback without blocking visual training.
- Keep unrelated dirty checkout changes; no repository-wide staging, resetting or commits.
- User approved the designs and explicitly authorized implementation; no additional design approval gate.
- Use exact Paper values, translating color tokens for gameplay (#9CD6F0 action, #E6BF78 warning, #F4A79E danger) into game-local CSS variables, keeping app green outside game.
- Exported dimensions: 1440x900; square scene840 left300 top24; identity40/32; instruction centered at top102 width452; live status40/332 width188; timers right40 top320 width304; dockcenter bottom28; outcomesleft40 width312/right40width304; replaydock720bottom10. Responsive layout must keep arena, controls and information usable.

### Task 1: Sculpted arena and class tokens
**Files:** render-arena.ts, encounters.ts, model.ts (only Actor optional classIcon field), public/raid-trainer/art/classes, new arena-assets.ts.
**Interface:** Keep drawArena's first five args compatible. Add sixth optional ArenaRenderOptions = { showTrail?: boolean; showGrowth?: boolean; highlightedEvent?: { at:number; x:number; y:number; text:string } | null }. Export this type. Reuse simulation world geometry exactly so visual boundary and collisions agree. Export prepareArenaAssets(encounter):Promise<void> from arena-assets.ts to load/decode arena,boss,ability,class images before countdown. It must allow retry after failure and cache successful assets; renderer shares the image cache.
- [x] Match Paper CEY-0 scene: quiet Sculpted Ice, full square black canvas; circular class icon tokens with class-color rings, boss portrait, small labels, larger gold YOU ring; purple flat pools with dashed original-size outline, coral on damage, restrained feedback; subtle raid diamond/star. Preserve readable fallback shapes if image missing.
- [x] Trace paths and growth only when requested for replay; show selected event position when provided. Do not add HUD, HTML panels, timers, title vignette, or modify simulation/hook: root owns those.
- [x] Preserve actor radius/collision positions; imagery should be scaled around the existing disc, not shift actors or hit zones.
- [x] Copy missing class images from `.cache/raid-trainer/paper-immersive/class-icons/` and change encounter artwork to arena-sculpted-ice.png; map all 10 actors to intended WoW classes.
- [x] Verify typecheck/lint for owned files and render design independently; report concerns instead of modifying other owners' files.

### Task 2: State, controls and immersive React interface
**Files:** use-trainer.ts, model.ts (event metadata only), simulation.ts, mechanics.ts, replay.ts, new practice-state.ts, new GameUi.tsx, new GameReview.tsx, TrainerExperiment.tsx, trainer.css, TrainerSetup.tsx.
- [x] Add structured damage/cast/pool events; derive per-cast ticks, end reason, first mistake, recovered/ally-hit/live cues and replay inspector data without hard-coded targets or fabricated totals.
- [x] Resume with3-second countdown without resetting encounter elapsed/history; label focus-loss pause. Freeze movement/timers/audio in pause; cancellation brings Ready state; Quick Bar launch still direct countdown.
- [x] Full live HUD, flat DBM bars attached38px icon, vignette, exposure pips, bottom dock and shortcut keycaps, guide/settings panels. Guidance hides only coaching, preserving danger/target cues.
- [x] End states for six personal ticks, overrun, clean completion and imperfect completion. Clickable cast review, truthful not-reached labels, contextual next action.
- [x] Replay opens two seconds before first mistake; step±1s,0.5/1/2x, clickable timeline cast/drop/damage markers; seeking pauses playback; end and no-damage states; trail/growth toggles; replay audio muted by default with no sound bursts on seeking.
- [x] Practice a cast restores the recorded snapshot2seconds before that cast with same seed/positions/pools and countdown. New pull starts fresh.
- [x] Accessible buttons, keyboard shortcuts, mobile touch controls, no hidden focus targets, focus restored on close, image loading/retry, sound fallback.

### Task 3: Review and verification
- [x] Unit tests for presentation, history/resume, review seeking and cast practice; browser tests for real flow and controls, new failure/clean/replay states and touch movement.
- [x] Visual checks against Paper on desktop and smaller viewports; inspect important states/screenshots.
- [x] Typecheck, scoped lint, simulation/audio regressions; review integration and fix verified issues.
- [x] Document implementation state mapping and asset provenance; refresh app preview.
