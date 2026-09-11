# Raid Trainer: simple start

The first version has one preparation page inside munigan.app. It opens with Icecrown Citadel → The Lich King → Defile selected, so the player can press **Start game** immediately.

[Paper: setup and focus countdown](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/N-0).

## Keep

- Shared app navigation with the approved menu icons.
- Raid, encounter, and mechanic selectors together on one row. They contain playable content; changing a parent resolves a valid child selection on the same page.
- A prominent Start game button beside the selectors, with the bordered Enter keycap. Show the short session length and cast count above it.
- Mechanic name, one-sentence explanation, role relevance, Normal/Heroic coverage, goal, and three short movement instructions.
- A static arena illustration with class icons and a small placement-preview label.
- One external mechanic-reference link. This can point to the cited Lich King guide in the research record.

The reference badges describe where Defile occurs; they are not difficulty controls. The current drill remains accelerated movement practice with three casts in 57 seconds. Guidance and timers are enabled by default. The existing game can retain its sound control.

## Remove from this version

Separate raid and encounter pages, the mechanic sidebar, guide-only mechanics, future-raid cards, search and filters, history recommendations, the guide drawer, role and raid-size matrices, interactive preview tabs, and pre-game coaching/audio preferences are deferred. Their preparation artboards were removed from Paper. The catalogue can retain its raid → encounter → mechanic model as more playable drills are added.

## Start and return

Start game loads required assets, then enters the approved focus layout and its automatic three-second countdown. There is no second Ready screen. The countdown belongs to gameplay; the user makes no additional setup decision.

While assets load, the existing button shows a busy state and prevents duplicate starts. A load failure appears inline with a retry action while preserving the selection. These are variations of the same page, not additional screens. Countdown timing begins only when the arena is ready. Sound failure does not prevent play when visual warnings are available.

Back to drill restores the preparation page and current selection. Existing gameplay, pause, results, and replay designs remain on the Practice states page.

## Approved and implemented

The user selected **A · Quick bar** on September 10, 2026. Paper now keeps **Approved · Quick bar** and **Gameplay · Focus countdown**. The other two variations and the superseded reference were removed.

The shared app shell now uses the top navigation, with matching icons and a green selection underline. It stays visible while scrolling; smaller screens use the existing accessible drawer. Top Gear's draft guard, locale controls, and future-tool availability remain intact.

The `/raid-trainer` setup implements Quick Bar with the raid → encounter → drill catalog in `src/features/raid-trainer/training-catalog.ts`. Defile is the only playable drill. `TrainerSetup.tsx` renders the selectors, brief and launch action; `PlacementPreview.tsx` renders the static SVG illustration using local artwork. The preview background matches the arena image edge (`#07080A`). Desktop follows the 1440 × 900 Paper layout; mobile stacks the selectors with Start above the brief.

Start game warms the arena asset, mounts the existing encounter directly in focus mode and begins its three-second countdown. Returning unmounts the simulation and audio, preserves the selection and sound preferences, and restores focus to Start game. Escape pauses play. The in-game guidance button switches between Guided practice and Timers only. Existing movement, timers, sound controls, results and replay remain available.

This implementation covers the approved setup and shared navigation. The additional visual explorations of gameplay states on the Practice states Paper page remain design references; the existing game is preserved.

This document supersedes the expanded preparation flow in [the earlier research record](raid-trainer-before-the-pull-research.md). That record retains sources and possible future content; its broader feature list is not the first-version scope.
