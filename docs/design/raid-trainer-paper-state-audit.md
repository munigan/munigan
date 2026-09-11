# Raid Trainer — Paper state fidelity audit

Reference: WoW Droptimizer, Paper pages 18 and 19, inspected on September 10, 2026. Current inline-style exports are retained in `.cache/raid-trainer/parity-paper/`. The comparison uses the 1440 × 900 artboards, their exact JSX values, and rendered screenshots. Paper was not modified.

## Corrections

- The app canvas and arena surround now use **#07080A**, sampled from the approved arena image. The decorative Icecrown page backdrop was removed so the entire app body stays this color. Cards keep their established surfaces.
- The approved arena now fills an **840 × 840** scene at **(300, 24)**. Camera conversion preserves the simulation's collision space; boss/class icon sizes remain in scene pixels.
- Shared HUD positions, type sizes, dividers, status dots, shortcut keycaps, attached 38px timer icons and flat fills now follow Paper. The HUD displays boss cast/cooldown timers; regroup behavior still drives the raid movement and cues.
- Replay uses the **720 × 142** transport at **(360, 748)**: thin progress track, cast/placement diamonds, damage ticks, white Play button, bordered SPACE keycap, speed selection and Sound off text. The extra header, legend and divider were removed.
- Replay checkboxes precede their labels. The inspector shows the selected event, exposure before/after, growth and the correct cast checkpoint. First-tick identity survives copied snapshots. Recorded path samples have timestamps and show the selected cast through its drop. Event callouts render above actors.
- Ready, pause, failure and completion panels use their approved spacing, headings, metrics and controls. Recovery uses green, imperfect completion uses gold, damage uses coral. Your ring is blue normally, gold when targeted and coral in a pool.
- Replay/results reflow below 1200px so the arena, transport and analysis do not overlap. Timeline labels remain normal-width text on phones. The background app is inert during practice; Exit focus restores Start game focus.

## State checklist

| State | Paper reference | Checked and corrected |
|---|---|---|
| Immersive base | Page 18 · Sculpted Ice | Full arena scale, boss/class portraits, flat timer bars, shared HUD and body color |
| Ready | CIY-0 | 544px panel at (448,230), drill facts, Guided/Timers segments, Start pull, goal panel |
| Countdown | CO0-0 | 160px countdown at (640,286), 96px numeral, single Cancel pull control, frozen encounter clock |
| Anticipate | CS0-0 | Escape-route cue, gold imminent timer fill, status dots, exposure and footer |
| Player targeted | CW0-0 | Actual target name, gold ring, move-away instruction, current and next Defile bars |
| Ally targeted | D00-0 | Actual teammate, gold target diamond/ring, give-room instruction; player retains blue ring |
| Missed mechanic | D40-0 | Coral cue, filled exposure pip, recovery instruction, expanded pool and growth label |
| Recovered | D80-0 | Green cue, blue player ring, no-new-hits feedback, preserved exposure |
| Paused | DC0-0 | 528px panel at (456,272), dim arena/timers, Resume and Restart; no live instruction/dock |
| Pull ended | DG0-0 | Left outcome at (40,224), labels above real metrics, cast review at (1096,288), unreached casts, first-hit review |
| Clean completion | DK0-0 | Green success/personal metric, clean cast rows, Timers only action and replay access |
| Imperfect completion | DO0-0 | Gold result/lesson, accurate total ticks and later clean casts, first-mistake action |
| Replay | DS0-0 | Compact transport, selected-event inspector, path/growth toggles, first-tick callout, practice checkpoint |
| Loading | E74-0 pattern | Preparation copy, loading bar, disabled Start pull and working cancellation |
| Focus lost | E74-0 pattern | Focus lost label, automatic pause explanation and resume countdown |
| Replay ended / clean replay | E74-0 patterns | Stops at last frame; Replay again and Back to results remain reachable; no first-mistake action for clean runs |
| Audio unavailable | E74-0 pattern | Continue without sound, with visual timers still available |
| Raid-only damage / platform overrun | E74-0 patterns | Separate personal/raid metrics and overrun explanation/action, checked with state/component fixtures |

## Verification evidence

All 21 unit/UI tests and 11 browser scenarios passed. The affected desktop/mobile/tablet cases were rerun after final presentation corrections, including an assertion that mobile timeline labels do not overlap. TypeScript, scoped ESLint and formatting checks also passed.

Desktop and mobile captures: `.cache/raid-trainer/verified/`, including Ready, countdown, anticipation, targeting, ally targeting, missed/recovered, pause/focus lost, failure, clean/imperfect results, replay/first tick/end/clean, loading/audio fallback, 390px mobile, and 800/1100px replay layouts.

Browser assertions check Paper geometry and transport styling as well as behavior: connected timer icon/bar dimensions, timer text stacking, frozen pause/resume, replay seek/speed/end, selected event/cast, exact cast checkpoint, keyboard focus, first-press touch movement and responsive non-overlap. The supplemental replay check verifies first/later tick labels, exposure transitions, placement selection, toggles and checkpoint restoration. Audio checks decode all 13 samples and cover cancellation, paused silence, resume and persistent preferences.

The engine continues to supply actual player/NPC positions, targeted teammate, elapsed times, timer fill fractions, pool radii, ticks and cast outcomes. Paper illustrates one attempt; these values intentionally follow the recording rather than being hardcoded to that illustration. Focus indicators and responsive reflow remain functional adaptations. Raid-only damage and overrun variants were checked with deterministic presentation fixtures, not claimed as naturally played browser outcomes.
