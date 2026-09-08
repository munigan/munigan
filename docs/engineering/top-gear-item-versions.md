# Top Gear item-version correction

Status: both item profiles implemented after the user authorized the selector. Original WotLK 3.3.5a is the new-import default; Blizzard Wrath Classic remains selectable and is preserved for pre-selector drafts/reports. A realm name is not a mechanical profile. The sequence below records the implementation design; implementation evidence and limits follow.

## Confirmed discrepancy

Mjolnir Runestone (45931):

| Source | Item level | Critical strike rating | Armor penetration proc |
| --- | --- | --- | --- |
| Current pinned catalog / native engine | 239 | 115 | 751 |
| Original Wrath | 226 | 102 | 665 |

Evidence:

- `data/wotlk/db.json` retains the Classic values for item 45931.
- Poli93 commit `563e4a08cb15729f1fdcbcf68e6d68224553bfef`, `sim/common/wotlk/stat_bonus_procs.go`, registers the 751 proc. This is executable behavior, not tooltip metadata.
- [Pinned AzerothCore item templates](https://github.com/azerothcore/azerothcore-wotlk/blob/db533ad7537a0641d076b13e5611f29f33558d06/data/sql/base/db_world/item_template.sql) give item 45931 level 226 and stat type 32 (crit) value 102.
- [Original item reference](https://wotlk.cavernoftime.com/item=45931) gives the 665 proc.
- [Wowhead Classic item reference](https://www.wowhead.com/wotlk/item=45931/mjolnir-runestone) uses the upgraded Classic version.

A read-only comparison of current catalog items against the already pinned AzerothCore templates found **878 item-level differences**. This is an audit input, not proof that every differing template can be substituted mechanically without review. Effects, weapon damage, sockets, armor, enhancements and set bonuses need their own comparisons.

## Implementation sequence

1. Generate a reproducible Original item dataset from pinned 3.3.5 sources. Map stat enums explicitly; preserve original armor, damage ranges, speeds, sockets and bonuses. Produce a difference manifest and reject missing mappings. Verify representative normal/hard-mode Ulduar, PvP, Naxxramas, ToC and ICC items. Do not infer stat changes from an item-level ratio.
2. Audit native item effects against pinned original spell data. Add source-backed engine patches for changed proc/on-use values, timing and conditions. Cover Mjolnir's crit and proc, plus every changed effect in the supported catalog. Static item overrides alone do not fix hard-coded procs.
3. Build and identify each supported engine/data profile reproducibly. The current `with_db` engine's `addToDatabase` only inserts missing IDs; passing an alternate player database cannot override existing items. Continue rejecting client-supplied mechanics. Use a trusted native database/build path and test actual native output.
4. Persist a validated item profile and revision in snapshots, jobs, report metadata, simulation hashes and reusable-result keys. Treat pre-profile reports as legacy Classic-derived runs. Keep their values immutable. Restore old drafts explicitly into their known profile, with deliberate conversion into Original when requested; never silently reuse Classic results for Original.
5. Use the selected profile's catalog for inventory, legality and result displays. If both profiles ship, place an **Item version** selector before running: **Original WotLK 3.3.5a** (default) and **Blizzard Wrath Classic**. Show the chosen version in the run summary and report. Imports must not guess a version from item IDs shared by both games.
6. Keep tooltip data aligned. Wowhead's `/wotlk/` widget currently presents Classic itemization. Original runs need tooltips built from the verified Original dataset (including original effect text and preserved gems/enchants), or a verified original-data provider. Icons can continue using the same icon artwork. Do not label Classic Wowhead tooltips as Original.
7. Verify native stats and deterministic proc behavior for changed items; unchanged items should retain parity. Add profile-isolation tests for admission, serialization, retries and report reuse, then run an end-to-end Original Top Gear simulation with Mjolnir. Validate representative real Warmane exports before declaring compatibility.

## Result tooltip verification

The report gear strip, changed-item rows, and full-set icons/names now use the shared Wowhead links with instance gems/enchants. Comparison rows have a separate keyboard-accessible selection button instead of nesting item links inside a button. Visible provider tooltips use the browser top layer so they remain visible above the full-set modal.

Checked against the existing local report: keyboard tooltip in the gear strip; keyboard set selection; hover tooltip in changed items; visible tooltip above the full-set dialog; no horizontal overflow at 390px. The real native Top Gear E2E also verifies result links and row selection. Existing reports and their DPS values remain immutable. New runs use their explicitly selected item profile.

## Implemented profile behavior and evidence

- The run-panel selector updates catalog item levels/stats, native `--item-version`, validation, and source-appropriate tooltip data. Item version/revision persist in snapshots, reports, simulation hashes and reusable-work keys. New imports default Original; pre-selector data normalizes to Classic. Supported manual bag selections survive switching and draft restore.
- Original data is revision `original-335-v1`: 878 static overrides and 28 effect groups, generated from pinned/hash-checked sources. The native build verifies generated outputs and injects only trusted compiled data; callers cannot supply alternate mechanics. A profile scope isolates and restores native databases/effect state, and existing native callers default to Classic. See `original-items-audit.json` for exact sources, changed fields, effects and unsupported reasons.
- Twelve unavailable/unverified Original items are excluded explicitly. This does not claim a complete reimplementation of Original class/encounter mechanics; shared logic remains the pinned Poli93 engine. Source/drop metadata inherited from the baseline is not an audited Original acquisition guide.
- Original tooltips are explicitly labeled **Stats preview**: they show source-backed static stats, preserved enhancements and verified effect summaries where available; their link opens the full original item reference. They do not substitute Classic Wowhead effect text for unknown original descriptions. Classic continues using Wowhead.
- PostgreSQL regression coverage verifies pre-selector idempotency, legacy completed-work reuse with normalized Classic keys, no reuse for a changed Original request, and preservation of old stored snapshots. UI review raised this compatibility issue; it was fixed and the focused re-review passed.
- A real browser → Trigger Development → native-worker test switches Mjolnir between versions, restores the selected draft, runs both modes, checks report labels and a 13-point difference in final crit rating, and reopens the old Original report unchanged. Keyboard tooltips (including Escape inside the full-set modal), manual bag selection retention, and narrow-screen layout are covered.
- Native tests activate the real Mjolnir aura and verify 751/665 armor penetration, 115/102 passive crit, 10-second duration and 45-second cooldown. Additional trinket tests cover Flare, Comet’s Trail, Scale of Fates, Eye of the Broodmother and Meteorite Crystal, plus Classic→Original→Classic isolation and unchanged-gear parity. The existing 45 native simulator tests also pass.
