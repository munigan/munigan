# Raid Trainer — experience pass 02

Historical implementation record. The current Paper pages 18–19 implementation is documented in [Immersive practice implementation](raid-trainer-immersive-implementation.md).

The user requested a substantial design and sound pass, real boss images in circular avatars, and deeper improvements to the playable experience. This pass retains the deterministic Defile practice rules while improving the preparation, play, feedback and review loop.

## Delivered experience

- A commissioned, overhead icy arena texture, layered beneath precise collision boundaries and readable raid tokens. Snow respects reduced-motion preferences.
- A recognizable Lich King portrait in circular frames in the encounter header and arena; a cast-progress ring around the boss.
- A three-second pull countdown, followed by the existing three-cast drill. Preparation pauses and resumes alongside gameplay.
- Start enters a focused play surface covering the app navigation. Escape exits and pauses; the focus button can also toggle the view. A compact timer stays visible inside the arena on mobile.
- Boss-mod countdown bars, a cast bar inside the arena, explicit target announcements, exposure pips, cast completion markers, and damage feedback. Guided mode provides early spread/regroup advice; Timers only retains countdowns and target warnings without advance coaching.
- Web Audio with separate controls for master volume, voice and ambience. Original synthetic countdowns/callouts, a credited DBM AirHorn alert, procedural wind, placement/damage effects and completion feedback. Audio only starts after a user gesture. Preferences persist across mode changes for the life of the page.
- Replay playback follows recorded timestamps, including irregularly spaced frames. Scrubbing updates the arena, cast bar, elapsed time and exposure history. Jump to first mistake starts two seconds before the first damage event, and the event log can seek to individual events.

## Audio and asset provenance

Public credits: `public/raid-trainer/credits.txt` (linked from Sound studio).

The DBM core has an all-rights-reserved top-level license, but its sound-specific manifest attributes AirHorn to Mike Koenig under CC BY 3.0. That individual asset is included unchanged, with reduced playback gain and attribution. No DBM source code or restricted VEM voice recordings are included.

- https://github.com/DeadlyBossMods/DeadlyBossMods/blob/master/DBM-Core/sounds/license%20info.txt
- https://soundbible.com/1542-Air-Horn.html
- https://creativecommons.org/licenses/by/3.0/
- https://github.com/DeadlyBossMods/DBM-Voicepack-VEM/blob/master/DBM-VPVEM/license.txt

Saved audio: `public/raid-trainer/audio/air-horn.ogg` and 12 original MP3 callouts (`count-1` through `count-5`, `spread`, `target`, `other`, `damage`, `regroup`, `complete`, `failed`). New voice files were made with the local synthetic Samantha voice at 210 words per minute and encoded as mono 24 kHz / 64 kbps MP3s. They are not DBM voice-pack recordings.

Boss artwork: `public/raid-trainer/art/lich-king.jpg`; ability icon: `public/raid-trainer/art/defile.jpg`. Blizzard artwork sourced from Wowhead's icon CDN, consistent with the existing app's item artwork. These are credited fan-experiment assets, not original project artwork.

Arena: `public/raid-trainer/art/frozen-arena.png`, generated with the **built-in image-generation tool**. Original saved output: `/Users/diegofernandes/.codex/generated_images/01a08bb5-004f-7930-a461-90ccac0a5365/exec-bca259ac-ef35-4e16-b229-ea0e90c576fe.png`. The project owns its local copy; runtime references do not depend on the generated-images folder.

### Final arena prompt

Use case: game asset. Create one high-quality 2D top-down orthographic arena background texture for a dark fantasy browser raid training game inspired by Icecrown Citadel. Square composition, perfectly overhead with no perspective tilt. A single huge circular frozen stone platform precisely centered, its usable circular floor occupies 82 percent of the image width. Outside the platform is a dark navy abyss and distant drifting icy mist. The floor is dark desaturated blue slate and ice with delicate frost cracks, weathered concentric carved runic stone rings, radial seams, thin cyan frost highlights around a clearly defined circular perimeter, eight subtle symmetrical gothic buttresses pointing outward. Understated intricate craftsmanship, atmospheric AAA fantasy environment matte painting quality, tactile realistic icy stone. Central playable floor is mostly dark and quiet with low contrast and no obstacles so tiny game tokens and purple hazards are readable. Very restrained ice-blue luminosity, no bright white patches. No characters, no monsters, no throne, no swords, no interface, no text, no lettering, no logos, no borders, no watermarks. The complete circular arena must fit inside image with margin. This will be drawn beneath crisp game tokens; prioritize spatial clarity.

## Verification

- TypeScript and ESLint passed for the changed code.
- `pnpm test`: 192 tests passed in 40 files, including audio threshold/target/pause tests and a replay test using irregular frame timestamps.
- `node tests/experiments/raid-trainer.browser.mjs`: successful three-cast run, damaging failed run, pause during preparation, pause during play, window blur, historical replay exposure, final replay scrubber position, mode change, mobile focus timer, keyboard and first-touch movement. No browser runtime errors.
- `node tests/experiments/raid-trainer.audio.browser.mjs`: all 13 audio assets decode; delayed preview/retry callbacks do not play while paused; resume starts real audio samples; mute, volume and voice preferences survive mode changes. No browser runtime errors.
- Visual inspection at desktop and 390-pixel mobile widths. Focus-mode stacking, replay timing, historical HUD state and asynchronous audio cancellation issues identified in review were corrected.

## Remaining product decisions

This remains the accelerated 57-second positioning preset. The next training-design decision is how much timing/target variation to add while preserving a repeatable beginner lesson. Authentic timing profiles, additional mechanic families, classes, multiplayer and full encounters remain separate features. No claim is made that art/audio polish establishes transfer of training to a real raid; playtesting with raiders is the next source of evidence.
