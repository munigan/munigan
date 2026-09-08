# Top Gear item-version correction

Status: investigated; profile implementation pending scope selection. Result tooltips are implemented independently. Recommendation: deliver Original WotLK 3.3.5a first, with Original as the default; add Blizzard Wrath Classic as a separate selectable profile if requested. A realm name is not a mechanical profile.

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

## Current result tooltip verification

The report gear strip, changed-item rows, and full-set icons/names now use the shared Wowhead links with instance gems/enchants. Comparison rows have a separate keyboard-accessible selection button instead of nesting item links inside a button. Visible provider tooltips use the browser top layer so they remain visible above the full-set modal.

Checked against the existing local report: keyboard tooltip in the gear strip; keyboard set selection; hover tooltip in changed items; visible tooltip above the full-set dialog; no horizontal overflow at 390px. The real native Top Gear E2E also verifies result links and row selection. Item data and existing DPS values have not been altered by this UI fix.
