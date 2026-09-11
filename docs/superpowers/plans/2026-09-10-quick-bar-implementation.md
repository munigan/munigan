# Quick Bar Implementation Plan

**Goal:** Implement the approved Paper Quick Bar setup and shared top navigation.

**Architecture:** Keep the encounter engine intact. Add a data-driven setup component and a static illustrated preview. Mount the existing drill from Start game in focus mode. Reuse shared navigation links, locale switching, and the Top Gear draft guard in the top bar and mobile drawer.

**Tech stack:** Next.js 16.3.4, React 19, Base UI, CSS design tokens, Playwright and Vitest.

**Spec:** `docs/design/raid-trainer-simple-start.md`; approved Paper Quick Bar export in `docs/design/paper-quick-bar.jsx`.

## Constraints

- Keep current checkout work and existing game controls, audio, replay and simulation behavior.
- One setup screen, Defile preselected, Start game immediately available.
- Top navigation icons, green selection underline, responsive mobile drawer.
- Use existing app colors and fonts. Preview background is #07080A.
- Keep only playable catalog entries; mode/role badges describe the original mechanic, not difficulty configuration.

## Tasks

- [x] Remove rejected Paper boards and export approved layout.
- [x] Add browser coverage for one-click focus start, pause/retry/back and responsive navigation; observe the missing setup behavior.
- [x] Replace WorkbenchSidebar with top ToolNav; preserve Top Gear navigation guard and translated controls.
- [x] Create TrainerSetup and PlacementPreview with local approved assets and catalog metadata. Connect selection to existing drill; start automatically with the existing countdown and return to setup.
- [x] Verify desktop/mobile layouts, local images, keyboard controls and shared navigation. Run trainer unit tests, targeted browser tests, typecheck and lint.
- [x] Record final design approval and implementation notes.

## Verification

- TypeScript typecheck passed; targeted ESLint passed; `git diff --check` passed.
- Ten trainer unit tests passed.
- Seventeen targeted browser cases passed across setup, Top Gear navigation and localization (the corrected arena-error locator was rerun separately).
- Existing gameplay experiment passed: movement, pause/blur handling, casts, damage/failure, replay, clean completion, timers-only guidance and first-touch movement.
- Existing audio experiment passed: 13 decodable audio assets, cancellation, paused silence, resumed sample playback and persistent settings.
- Desktop setup, mobile setup/menu, Top Gear and focused gameplay were visually reviewed. The existing app tab was refreshed to the completed setup.
- Paper contains only Approved · Quick bar and Gameplay · Focus countdown on the preparation page.
