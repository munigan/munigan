# Raid Trainer: Before the Pull — research archive

**Current direction:** the preparation flow has been simplified to one page with preselected raid, encounter, and mechanic, visible mechanic details, and an immediate Start game action. See [the current simple-start design](raid-trainer-simple-start.md) and [the two remaining Paper artboards](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/N-0). The expanded browsing, search, history, guide, and state artboards described below were removed. The following research and earlier proposal are retained for source context and future consideration, not as the first-version implementation scope.

Preparation is a normal page within munigan.app, below the shared top navigation. It has three decisions: choose a raid, choose an encounter, and choose a mechanic. The mechanic screen combines the lesson brief, a placement preview, and practice preferences. Its Start action enters the approved focus interface and begins a three-second countdown after required assets are ready.

Search and recent practice provide shorter routes through the same structure. They should preserve the context of the selected raid and encounter, so the product can grow without making experienced players repeat a setup wizard before every pull.

This is a research-backed design proposal, not a claim of measured learning improvement. The Paper screens are prototypes. The current application implements the accelerated Defile drill; the expanded catalogue, additional mechanic guides, search, and persistent practice history remain proposed work.

## Earlier design artifacts — removed or consolidated

[Open the Before the Pull page in Paper](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/N-0).

| Screen | Decision or state it illustrates |
| --- | --- |
| 00 · Before the pull | Main route, shortcuts, information hierarchy, and scope |
| 01 · Raid library | First visit, raid imagery, real playable availability, and a first-drill recommendation |
| 02 · Icecrown Citadel | Encounter recognition through portraits and a clear playable encounter |
| 03 · Defile | Mechanic selection, short briefing, illustrated preview, coaching, and Start |
| 04 · Mechanic guide | Role tips, Normal/Heroic coverage by raid size, sources, and simulation scope |
| 05 · Heroic-only mechanic | Shadow Trap reference with an explicit absence of playable practice |
| 06 · Search | Direct discovery by name or training intent, with separate role, encounter, and training information |
| 07 · Returning player | A useful recommendation based on an illustrative saved attempt |
| 08 · Default focus | Start leads into the previously approved arena and countdown |
| 09 · Supporting states | No results, filtered results, loading, load failure, unavailable audio, and coaching preferences |

The new entry flow supersedes the earlier generic Ready screen for a new pull. It does not require users to approve the same configuration twice. The previously designed gameplay, pause, results, and replay states remain the continuation of this flow.

## Product problem

The existing trainer places compact raid and encounter dropdowns above an already rendered game. This works for a single experiment but gives little help with choosing among unfamiliar abilities. The controls expose the catalogue hierarchy without explaining why a player should choose a particular lesson.

Preparation needs to answer four questions quickly: What happens? What should I do? Does this matter to me? What will I actually practice? More background can help, but it should not make reading a full boss guide a prerequisite for starting a short drill.

The selection experience also has two kinds of difficulty to distinguish. Encounter difficulty describes the game content: Normal, Heroic, or another version-specific mode. Practice configuration describes the lesson: coaching, duration, population, and the mechanic interactions simulated. A difficulty badge must not silently promise an authentic simulation of the corresponding raid mode.

The current Defile experiment has a 57-second duration, three scheduled casts, ten actors, and an approximate growth model. These are teaching values, not the complete Lich King encounter. Keeping that distinction visible protects the meaning of the drill as the catalogue expands.[^local]

## Research findings and implications

### A short default brief with a deeper second layer

Nielsen Norman Group describes progressive disclosure as exposing frequent, important options first and deferring specialized material. It also distinguishes this from a wizard, where later stages may contain equally essential decisions. Its discussion cautions against splitting interdependent exploratory choices across too many stages.[^disclosure]

The proposed application of this principle is a mechanic selector beside its brief. Changing from Defile to Shadow Trap updates the same content region. The main screen has one obvious Start action when practice exists. A details drawer contains role-specific guidance, a coverage matrix, source links, and explanations of the training preset.

This division is a design judgment. The facts needed to choose a lesson remain visible; information useful for deeper understanding is available without disturbing the selection. A drawer is useful on a desktop because the selected mechanic remains recognizable behind it. On a narrow viewport, the same content should become a full-width detail view with a clear return action.

### Recognition helps players find the encounter they remember

NN/G's recognition guidance favors visible cues and access to recently visited content over requiring people to recall exact names. It also recommends contextual help instead of a large tutorial that must be memorized.[^recognition]

Raid artwork, circular boss portraits, spell icons, and concise mechanic descriptions are complementary cues. The image establishes identity; the text remains the reliable label. Search should accept a spell name, boss name, and curated descriptions such as “growing pool” or “spread.” Matching a description should still return a named, verified mechanic, not generate a new strategy.

Recent practice should be specific enough to support a next action. “One late exit” is more useful than a decorative score when the recorded event establishes that failure. When history is absent, the same space can recommend the first available drill. A recommendation should never invent an attempt or pretend that an unplayed lesson has been mastered.

### Encounter coverage needs its own data

Blizzard identifies Icecrown Citadel as a twelve-encounter raid with Normal and Heroic modes.[^icc] Defile is a later-phase mechanic across those difficulties, while Shadow Trap is associated with Heroic. The Lich King guides and the DBM module provide supporting encounter context.[^wowhead][^dbm]

This supports two independent pieces of UI: an encounter-presence label and a playable-availability label. “Heroic only” answers where an ability occurs. “Guide only” answers what this application currently provides. Neither substitutes for the other.

For Defile, the main brief uses a compact Normal + Heroic label. The detail panel expands that into a ten-player/twenty-five-player matrix. Shadow Trap has a Heroic-only label and an explicit Normal: Not present row. These are reference attributes, not controls that change the current accelerated drill.

Do not force every future raid into an Icecrown-shaped boolean. Mode names, raid sizes, and special encounter conditions belong to a versioned reference profile. The UI should render the valid profiles supplied by that encounter's data. If only one teaching preset is available, present that preset honestly rather than adding several mode buttons that all run identical code.

### Roles and responsibilities are related but different

Icy Veins separates Lich King advice into DPS, healer, and tank sections. Its examples show both shared movement responsibilities and more specialized defensive or dispel coordination. DBM similarly distinguishes several warnings and timers by role or task.[^icy][^dbm]

The application should therefore model both combat roles and responsibilities. A player can be a healer and also be the targeted mover. A damage dealer may have a dispel, interrupt, or control assignment. “Everyone” means the mechanic is relevant to all roles; it does not necessarily mean every role has identical targeting eligibility or the same task.

For the Defile lesson, the role panel offers positioning advice rather than a class rotation: maintain a safe movement route, give the target room, and prioritize leaving danger. Those short tips are editorial applications of the mechanic, not a claim that the simulator models tank threat, healing casts, or damage uptime.

The main interface should not require a class selection until class choice changes the exercise in a meaningful, implemented way. The approved class icons can identify arena tokens without implying that their spells or movement abilities are simulated.

### Exact timing requires more evidence than a guide label

The opened sources describe different Defile intervals: Wowhead says approximately 35 seconds, Icy Veins discusses readiness around 40 seconds, and the inspected DBM revision initializes a 32.5-second next timer while starting some phase-entry timers at 38 seconds.[^wowhead][^icy][^dbm] Those numbers can reflect different contexts, versions, or timer semantics; they do not establish one universal correct interval.

The UI should therefore show the practice duration and lesson structure as properties of the preset. An authentic timing option would need its own verified profile and validation against encounter evidence. A prominent “Accelerated practice” label and a concise scope explanation are appropriate for the current experiment.

Source provenance should be maintained separately from player-facing copy. Store the edition, source revision or date, affected fields, and review status. A link to a guide is useful, but it is not sufficient evidence for every numeric parameter in a simulation.

### Meaning must remain clear without color or sound

W3C's use-of-color guidance requires another visible means of conveying information when color carries meaning.[^color] Its non-text contrast guidance addresses identifying controls and meaningful graphics.[^contrast]

In the proposed screens, selected rows combine a border, background, and checkmark. Difficulty and availability use words. Class-colored circles contain icons and labels. The focus experience retains text warnings when audio is unavailable. The keycap backgrounds and borders approved in the preceding design pass continue into Start and dismissal controls.

This is not a conformance audit. A later implementation still needs keyboard, assistive-technology, contrast, and responsive checks. Static mockups establish the intended hierarchy and visible state distinctions; they cannot verify programmatic semantics or focus behavior.

## Approaches considered

| Approach | Strength | Cost | Decision |
| --- | --- | --- | --- |
| A sequential setup wizard | Each page has one small decision | Repeat players revisit steps; comparing mechanics and settings becomes tedious | Keep the meaningful hierarchy, without a Next button after every choice |
| A single dense catalogue workbench | Fast switching and broad comparison | Raids, encounters, filters, guides, and setup compete for space | Use this only for search results and the local mechanic selector |
| An image-led library followed by an encounter and mechanic brief | Clear discovery for new players, direct routes for experienced players, room for visual teaching | Requires navigation context and sensible back behavior | Recommended |

The recommendation is a hybrid, not a requirement to visit three screens on every session. A first-drill recommendation, search result, bookmark, or valid saved attempt can lead directly to the mechanic. The raid and boss remain visible in breadcrumbs and the boss header.

## Information hierarchy

### Raid library

A raid entry needs an image, name, expansion context, and truthful training availability. A small amount of encounter metadata can establish scale, but the page should not list every ability. One clear action opens the encounter collection.

The current slice uses three equally sized raid cards. Icecrown Citadel has an available-drill badge and a green action; Ulduar and Naxxramas are explicitly labeled as having no available drills. These entries demonstrate catalogue growth without fabricating implemented content or release dates. The collection sits below a compact Raid Trainer page heading, expansion filter, and search field.

An expansion choice belongs here, with the last valid choice remembered. It should not become another mandatory onboarding screen. Search remains accessible without expanding a navigation menu.

### Encounter selection

Boss portraits pair with names and a location or wing. Playable encounters receive a meaningful next action; catalogue-only entries do not imitate enabled gameplay controls. Counts describe actual published drills, not the total number of spells a boss casts.

The Lich King is featured because it is the only playable encounter in the current slice. In a mature catalogue, preserve the same row structure and group by wing, availability, or recent activity. All modes of ordering should still allow the player to recognize and choose any encounter directly. The trainer should not require defeating earlier bosses to practice a later one.

### Mechanic brief

The central information order is deliberate:

1. The mechanic name and a short causal description.
2. Who it matters to and where it appears in the encounter.
3. A concrete success condition.
4. Three short action steps.
5. A visual example using the same arena language as play.
6. The exercise duration, casts, population, coaching preference, and Start.

These are separate questions rather than a wall of guide text. Exact damage values, exhaustive boss lore, loot rewards, long achievement descriptions, and a complete spellbook do not help the initial positioning choice enough to deserve this space.

The preview is an illustrated example, not a replay or a hidden live game. Anticipate, Place, and Exit show the causal sequence. It should advance only on request, respect reduced-motion preferences, and retain a textual explanation. It should not reveal randomized targets for a forthcoming attempt.

### Details on demand

The detail drawer gives a player room to understand the mechanic beyond the immediate lesson. It includes role tips, the encounter-mode/raid-size matrix, the simulator's scope, and source links. The button label says what will open; it does not hide everything behind a vague information icon.

A later guide may also explain overlapping mechanics, alternative assignments, or a common failure. These should be included only when they change a player's decision or help interpret the exercise. They should not become required reading to start.

### Start and return

Start keeps the selected mechanic and preferences, prepares required assets, enters the focus layout, and begins the countdown. The app's normal navigation is removed from the play surface. This is a layout choice within the browser; it does not require requesting operating-system fullscreen access.

Cancel during preparation returns to the same brief. Leaving an active drill should pause it before navigation. A return action should be called Back to drill or Back to mechanics, because focus is now the standard play interface rather than an optional presentation mode.

Retrying the same exercise does not repeat catalogue selection. Practicing a specific missed cast should identify that shorter scope before it starts and preserve the relevant preset. The returning-player screen illustrates this behavior; it depends on a saved, compatible attempt and is not currently implemented.

## Content model for growth

Use a hierarchy of content identities without exposing every level as a mandatory UI step:

**Game reference → Expansion → Raid → Encounter → Mechanic → Drill preset.**

A mechanic describes what happens in the encounter. A drill describes a trainable lesson using one or more mechanics. This distinction also permits a future combined Defile-and-target-switching drill without duplicating the boss or treating every spell as an independent game.

| Entity | Recommended content | UI responsibility |
| --- | --- | --- |
| Reference profile | Edition, build/patch where relevant, raid size, difficulty label, special conditions | Prevent mixed-version claims |
| Raid | Stable ID, name, expansion, image, ordered encounters, published drill count | Discovery and orientation |
| Encounter | Stable ID, name, boss portrait, location/wing, valid reference profiles | Recognition and mechanic collection |
| Mechanic | Spell IDs when applicable, family, phase labels, causal summary, responsibilities, role guidance, presence per reference profile | Explain what to learn |
| Drill preset | Status, objective, mechanics used, duration, actor count, timeline profile, supported controls, coaching modes, evaluated outcomes | Define what can actually be played |
| Evidence record | Exact source, edition, revision/date, fields supported, review notes | Maintain factual content |
| Attempt summary | Drill/preset version, mode, relevant outcome events, replay compatibility, local save status | Support honest returning-player recommendations |

Presence should use a small explicit set such as present, absent, and unverified. An unknown field must not become a displayed No. Availability should separately distinguish playable, guide only, and unavailable. Read-only metadata does not change simulation configuration.

Role data should include affected roles, primary responsibilities, supporting responsibilities, and any verified eligibility conditions. An All roles entry should remain visible when filtering for a specific role. “Targets” and “dispellers” should be searchable responsibilities, not invented combat-role categories.

Mechanic families can support discovery across bosses: growing ground hazards, spreads, stacks, lines of sight, interrupts, dispels, defensive timing, target switches, soaks, and movement sequences. A family is a discovery label; it is not evidence that one simulation primitive can correctly implement every mechanic in that family.

Search should index verified names, spell aliases, boss and raid names, and a curated set of training terms. Results retain both parent names so an ability with the same name in a different encounter is not ambiguous. Changing a raid or reference profile should clear incompatible descendants, preserve compatible preferences, and explain any unavailable preset.

## State behavior

| Condition | Visible response | Next action |
| --- | --- | --- |
| First visit | Available content and an introductory drill recommendation | Open the brief |
| Compatible recent attempt | Specific outcome with a replay or retry recommendation | Review or practice again |
| Missing or incompatible history | Ordinary first-visit library; no invented progress | Choose a drill |
| Search has no matches | Keep the query visible and suggest useful search terms | Clear or browse |
| Filters remove playable results | Explain the effect of the filters | Clear filters or include guides |
| Mechanic exists only in another difficulty | Show its exact encounter coverage | Inspect the valid reference |
| Mechanic has a guide but no drill | Read the guide and offer a related available lesson | Open that lesson's brief |
| Required arena data is loading | Preparation status; simulation and countdown have not started | Cancel if desired |
| Required data fails | Keep selection and preferences; explain that the arena could not load | Retry loading or return |
| Audio fails | Nonblocking notice; text and timers remain usable | Retry audio or continue silently |
| Artwork fails | Named portrait or raid frame | Continue browsing |
| Start succeeds | Full focus layout with a three-second countdown | Move at GO |

The state components in Paper are specifications for the visible treatment. They should be shown in context, not turned into a mandatory series of modal dialogs. Audio failure in particular should not prevent a player from using a lesson that has adequate visual cues.

## Visual system

Preparation uses the existing munigan app language: near-black canvas (`--color-munigan-canvas`), neutral surfaces and borders, green actions (`--color-munigan-action`), Space Grotesk branding, Barlow Condensed page headings, and Inter reading text. The approved Sculpted Ice treatment belongs to the arena and its preview. It does not define a separate preparation-app identity.

A single 76px top bar contains the munigan symbol and wordmark, Overview, Top Gear, the selected Raid Trainer destination, More tools, Help, and language selection. Each destination pairs its label with an 18px line icon: home, shirt, target, tool grid, help circle, and globe respectively. Icons use a consistent 1.5px stroke and 8px label gap; the selected trainer icon shares the green active state. These are a proposed horizontal arrangement of app navigation, not an additional trainer navigation shell. The trainer has no separate brand header or Back to tools exit. Local breadcrumbs express raid and encounter context. The guide drawer and its backdrop begin below the top bar; actual modal semantics and keyboard behavior still require implementation validation.

The raid library uses three 416px-wide artwork cards, a 40px page heading, and a compact recommendation row. The encounter screen uses a featured playable boss and aligned portrait rows. The mechanic brief uses a three-column reading and preview layout, 36px headings, and an inset neutral action panel. Images establish identity inside content regions; there is no full-page cinematic preparation background. Repeated controls and keycaps use the same neutral and green treatment as the rest of munigan.

App navigation remains present while browsing, searching, reading guides, and preparing assets. Once the drill is ready, Start transitions into focus mode and hides the app chrome. Back to drill restores the same app page, selection, and preferences. Focus mode remains the default gameplay presentation.

Keep boss images circular and ability images square. Maintain text labels alongside each. Preserve the flat DBM-inspired bars, attached equal-height icons, top instruction vignette, and bordered keyboard keycaps in play. Do not reintroduce timer shadows or gradients while enriching the surrounding pages.

The desktop library and returning-player screens are 1440 × 900; the denser encounter and mechanic screens are 1440 × 960. The focus transition retains the approved 1440 × 900 game composition. These are review viewports, not fixed runtime page heights. On narrow screens, use the app's responsive navigation, stack the brief and preview, turn the mechanic list into a compact selector, and use a full-width details view. Preserve the name, causal summary, objective, availability, and Start ahead of secondary information. Keyboard recommendations should describe the experience accurately without falsely implying touch support has been removed from the existing prototype.

## Image provenance

The raid and Lich King scene images are Blizzard material used as credited design references. Boss achievement icons and spell icons use the same Wowhead-hosted Blizzard asset approach already present in the project. The arena preview reuses the approved generated Sculpted Ice artwork.

| Image use | Source |
| --- | --- |
| Icecrown Citadel feature and atmosphere | Blizzard's Icecrown opening article, blog header[^icc] |
| Lich King encounter scene | Lich King gallery image in the same Blizzard article[^icc] |
| Ulduar catalogue tile | Blizzard's Ulduar announcement artwork[^ulduar] |
| Naxxramas catalogue tile | Blizzard news roundup image; legacy Naxxramas promotional artwork, not a claim about current raid tuning[^naxx] |
| Boss circles | Verified achievement-boss icon files from the Wowhead image CDN |
| Shadow Trap, Soul Reaper, Necrotic Plague, Infest icons | Icon names returned by the WotLK spell tooltip records for 73539, 69409, 70337, and 70541 |
| Arena | Existing `.cache/raid-trainer/paper-immersive/arena-sculpted-ice.png` |

Local design reference assets and a provenance manifest are stored under `.cache/raid-trainer/paper-selection/`. The new files are design inputs, not new application runtime dependencies. The two abomination entries use the shared Festergut/Rotface achievement icon; a production catalogue could replace these with distinct portraits when suitable assets are available.

## Validation and next product decisions

The Paper layouts were visually reviewed for spacing, type hierarchy, contrast, alignment, clipping, and repetition. The role matrix, search result columns, portrait rows, disabled-content distinctions, and primary actions were inspected at the intended desktop size. This establishes a reviewable design, not functional behavior or accessibility conformance.

The most valuable next test is a short moderated prototype exercise with both familiar and less experienced raiders. Ask a participant to find an appropriate mechanic, explain what the drill will simulate, identify a Heroic-only ability, and begin practice. Include one task where a requested drill is unavailable and another where the participant returns after a recorded mistake.

Measure time to a valid lesson, unnecessary navigation, whether the participant confuses encounter difficulty with practice tuning, and whether they can explain the first action before pressing Start. Record whether they discover the role guidance without prompting. Treat these as proposed validation measures, not results already demonstrated.

After choosing the design, the first implementation slice should be the current raid/encounter data, the Defile brief, honest availability, and direct entry to focus mode. Add source-backed guides and search once there is enough content for them to be useful. Add persistent recommendations only when attempt storage, privacy wording, preset compatibility, and replay availability are defined. Broader catalogue coverage should grow from verified content rather than from decorative counts.

## Sources

[^local]: Existing project documentation: [Defile experiment specification](../superpowers/specs/2026-09-10-raid-trainer-experiment.md) and [experience pass notes](raid-trainer-experience.md), 10 September 2026. Source for the current preset and implementation boundaries.

[^icc]: Blizzard Entertainment. [Wrath of the Lich King Classic: The Way into the Icecrown Citadel is Open!](https://worldofwarcraft.blizzard.com/en-us/news/24013834/wrath-of-the-lich-king-classic-the-way-into-the-icecrown-citadel-is-open), 12 October 2023. Raid identity, Normal/Heroic coverage, encounter list, and artwork. Accessed 10 September 2026.

[^wowhead]: Wowhead. [The Lich King Strategy Guide — Icecrown Citadel Raid WotLK Classic](https://www.wowhead.com/wotlk/guide/raids/icecrown-citadel/the-lich-king-strategy). Encounter mechanics and phase context; accessed 10 September 2026. Numeric claims were not adopted as a universal simulation profile.

[^icy]: Abide / Icy Veins. [The Lich King Encounter Guide: Strategy, Abilities, Loot](https://www.icy-veins.com/wotlk-classic/the-lich-king-encounter-guide-strategy-abilities-loot), updated 1 January 2024. Role-specific context and encounter descriptions; accessed 10 September 2026.

[^dbm]: Deadly Boss Mods. [LichKing.lua](https://github.com/DeadlyBossMods/DBM-WotLK/blob/fb69197a6c5eca13fd6c683b081b1bcb713042ef/DBM-Raids-WoTLK/Icecrown/TheFrozenThrone/LichKing.lua), revision `fb69197a6c5eca13fd6c683b081b1bcb713042ef`, accessed 10 September 2026. Primary evidence for that addon's role filters, Heroic-specific trap handling, phase scheduling, and warnings. It is addon behavior, not a complete authoritative description of the game engine.

[^disclosure]: Jakob Nielsen / Nielsen Norman Group. [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), 3 December 2006. Accessed 10 September 2026.

[^recognition]: Raluca Budiu / Nielsen Norman Group. [Memory Recognition and Recall in User Interfaces](https://www.nngroup.com/articles/recognition-and-recall/), 15 January 2024. Accessed 10 September 2026.

[^color]: W3C Web Accessibility Initiative. [Understanding Success Criterion 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), updated 16 September 2025. Accessed 10 September 2026.

[^contrast]: W3C Web Accessibility Initiative. [Understanding Success Criterion 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Accessed 10 September 2026.

[^ulduar]: Blizzard Entertainment. [Wrath Classic: Unearth the Secrets of Ulduar](https://worldofwarcraft.blizzard.com/en-us/news/23897173/wrath-classic-unearth-the-secrets-of-ulduar-january-19), January 2023. Artwork source; accessed 10 September 2026.

[^naxx]: Blizzard Entertainment. [World of Warcraft News and Development Updates](https://worldofwarcraft.blizzard.com/en-us/news/23822255/world-of-warcraft-news-and-development-updates), 2022 roundup. Naxxramas promotional image source; accessed 10 September 2026.
