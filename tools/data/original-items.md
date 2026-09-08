# Original WotLK item data

`python3 tools/data/original-items.py` regenerates `data/wotlk/original-items.json`
and its audit manifest. `--check` verifies that the checked-in artifacts match the
source extraction. The four SQL sources are pinned by commit and SHA256 in the
script. SQL is parsed as data, never executed. Missing files are fetched into
`.cache`; existing files with a wrong checksum fail rather than being trusted.

The dataset replaces all 878 catalog entries whose item levels differ between
the pinned Classic catalog and the original AzerothCore templates. It reads
original stats, armor/bonus armor, shield block value, weapon damage/speed,
sockets, socket bonuses, and passive block-value/spell-penetration spells. Stat
enums are mapped explicitly and unknown mappings fail. Names, icons, equipment
types and set membership come from the existing catalog. Acquisition metadata
is retained and is **not** an audited Original loot/vendor guide.

The audit manifest records changed fields and every item spell on these 878
entries. It also contains the source-derived amounts for 28 native effect groups
(proc/on-use/stacking trinkets, druid/DK/paladin/shaman relics, Spark of Hope).
Original Mjolnir is ilvl 226, 102 critical strike rating, and a 665 armor
penetration proc. Spell durations are recorded from the original DBC export.
Effect triggers, cooldowns, shared class rules, set bonuses, and encounter
behavior otherwise retain the pinned engine implementation. This is an item
version profile, not certification of an individual private realm's mechanics.

The remaining baseline catalog entries are inherited, not independently
reimplemented. Twelve IDs are excluded from Original:

- 42579, 42584, 42615, 45436, 46138: relic effects absent from the native engine.
- 46017: Val'anyr includes item spell 68496, absent from the pinned original DBC.
- 46312: the tentacle summon is absent from the native engine.
- 211817, 211844, 211847, 211850, 211851: Classic-only IDs without original templates.

`tools/simulator/build.sh` checks the artifacts and applies narrowly matched
hooks to the pinned engine checkout. It embeds trusted item data in both native
binaries. `json-sim --item-version original|classic` selects the version before
stats computation and simulation. Its default remains `classic` for existing
native callers. Original rejects request-supplied databases and unsupported
items. Every evaluation restores item, gem, enchant and effect-profile state.
The CLI serializes evaluations; engine worker goroutines read one fixed profile.

Use `SKIP_PROTO=1 bash tools/simulator/build.sh` when the generated schema is
already current to avoid regenerating TypeScript. The source commit is unchanged.
The build runs the native profile tests; data regressions run with:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/data -p 'test_original_items.py'
```

After shipping, a change to mechanical data or its interpretation requires a new
`REVISION` in the generator so persisted simulations cannot reuse old results.
