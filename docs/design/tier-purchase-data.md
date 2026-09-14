# Reviewed T9/T10 purchase data

Checked **2026-09-12**. This is an item-level vendor audit, not prices inferred from tier overviews. The explicit production input is `data/wotlk/purchases.json`; generation validates it without fetching vendor data or rewriting unrelated generated files.

## Coverage and method

855 rewards: 570 T9 (19 variants × 2 factions × 5 slots × 3 qualities) and 285 T10 (19 variants × 5 slots × 3 qualities). Every reward is present in both `original` and `classic`; none overlaps `original-items.json` adjustments or exclusions. These profiles distinguish item statistics, not vendor rules. The shared Wrath recipes use the original-era vendor evidence below; this audit does not claim an independent second scrape of Classic vendors.

For **each** reward, its public [WotLK item database](https://wotlk.evowow.com/) page's `sold-by-npc` Listview was fetched and its complete `cost` array parsed. All listed vendors agreed on the cost. The audit preserved native currency/token IDs, quantities, vendor NPC IDs, and any consumed equipment ID. Upgrade predecessor IDs below came directly from those vendor requirements, never from similar item names. All 855 fetched pages supplied unambiguous vendor records. Full third-party HTML is not committed.

The native format is `[copper, [[currencyId, quantity]], [[itemId, quantity]]]`, with the last array omitted when empty. Currency 301 = Triumph; 341 = Frost. Item 47242 = Trophy. Regalia: 47557/47560 Conqueror, 47558/47561 Protector, 47559/47562 Vanquisher (faction versions normalize to the same compatible resource). Normal Marks: 52025 Vanquisher, 52026 Protector, 52027 Conqueror. Heroic Marks: 52028 Vanquisher, 52029 Protector, 52030 Conqueror. Equipment entries in the third array are consumed prerequisites, separate from currency/token costs.

Class IDs in the app are protobuf IDs (1 druid, 2 hunter, 3 mage, 4 paladin, 5 priest, 6 rogue, 7 shaman, 8 warlock, 9 warrior, 10 death knight); they are not Blizzard's class-mask positions. Token-family lookup deliberately rejects unsupported IDs.

Set variants are stable domain identifiers. Catalog class restrictions, faction restrictions, item level, slot, and set membership are validated for every recipe in both profiles. T9 quality groups are direct purchases. Every T10 264/277 predecessor is also a registered recipe with identical class, faction, variant and slot, exactly one quality lower. The complete matrix requires five slots at every quality in every registered set group.

## Revision and maintenance

The revision is `purchases-v1:` plus SHA-256 of recursively key-sorted manifest semantics (version, registered sets, recipes); array order is normalized. Check dates and the revision field itself are excluded. `tools/data/purchases.ts` rejects stale revisions and runs both-profile validation after base-data generation. Runtime loads the local JSON and caches each profile's validated map; it makes no vendor network requests. Price, reward ID, predecessor, membership or source URL edits change the revision. Refreshing only the check date does not.

When changing a recipe, check its item-level vendor record, update the explicit JSON and this audit, and recompute the normalized revision. Never infer a new mapping from an English name or a neighboring ID. Run the focused catalog tests, offline manifest validator and typecheck.

## Registered sets

| Tier | Variant | Faction | Native set ID | Catalog set |
| --- | --- | --- | --- | --- |
| 9 | mage-dps | alliance | 843 | Khadgar's Regalia |
| 9 | mage-dps | horde | 844 | Sunstrider's Regalia |
| 9 | warlock-dps | alliance | 846 | Kel'Thuzad's Regalia |
| 9 | warlock-dps | horde | 845 | Gul'dan's Regalia |
| 9 | priest-healing | alliance | 847 | Velen's Raiment |
| 9 | priest-healing | horde | 848 | Zabra's Raiment |
| 9 | priest-shadow | alliance | 849 | Velen's Regalia |
| 9 | priest-shadow | horde | 850 | Zabra's Regalia |
| 9 | druid-restoration | alliance | 851 | Malfurion's Garb |
| 9 | druid-restoration | horde | 852 | Runetotem's Garb |
| 9 | druid-balance | alliance | 853 | Malfurion's Regalia |
| 9 | druid-balance | horde | 854 | Runetotem's Regalia |
| 9 | druid-feral | horde | 856 | Runetotem's Battlegear |
| 9 | druid-feral | alliance | 855 | Malfurion's Battlegear |
| 9 | rogue-dps | alliance | 857 | VanCleef's Battlegear |
| 9 | rogue-dps | horde | 858 | Garona's Battlegear |
| 9 | hunter-dps | alliance | 859 | Windrunner's Battlegear |
| 9 | hunter-dps | horde | 860 | Windrunner's Pursuit |
| 9 | shaman-restoration | alliance | 861 | Nobundo's Garb |
| 9 | shaman-restoration | horde | 862 | Thrall's Garb |
| 9 | shaman-elemental | alliance | 864 | Nobundo's Regalia |
| 9 | shaman-elemental | horde | 863 | Thrall's Regalia |
| 9 | shaman-enhancement | alliance | 865 | Nobundo's Battlegear |
| 9 | shaman-enhancement | horde | 866 | Thrall's Battlegear |
| 9 | warrior-dps | alliance | 867 | Wrynn's Battlegear |
| 9 | warrior-dps | horde | 868 | Hellscream's Battlegear |
| 9 | warrior-tank | alliance | 869 | Wrynn's Plate |
| 9 | warrior-tank | horde | 870 | Hellscream's Plate |
| 9 | dk-dps | alliance | 871 | Thassarian's Battlegear |
| 9 | dk-dps | horde | 872 | Koltira's Battlegear |
| 9 | dk-tank | alliance | 873 | Thassarian's Plate |
| 9 | dk-tank | horde | 874 | Koltira's Plate |
| 9 | paladin-holy | alliance | 875 | Turalyon's Garb |
| 9 | paladin-holy | horde | 876 | Liadrin's Garb |
| 9 | paladin-retribution | alliance | 877 | Turalyon's Battlegear |
| 9 | paladin-retribution | horde | 878 | Liadrin's Battlegear |
| 9 | paladin-protection | alliance | 879 | Turalyon's Plate |
| 9 | paladin-protection | horde | 880 | Liadrin's Plate |
| 10 | warrior-dps | both | 895 | Ymirjar Lord's Battlegear |
| 10 | rogue-dps | both | 890 | Shadowblade's Battlegear |
| 10 | dk-dps | both | 897 | Scourgelord's Battlegear |
| 10 | druid-restoration | both | 887 | Lasherweave Garb |
| 10 | hunter-dps | both | 891 | Ahn'Kahar Blood Hunter's Battlegear |
| 10 | warlock-dps | both | 884 | Dark Coven's Regalia |
| 10 | mage-dps | both | 883 | Bloodmage's Regalia |
| 10 | paladin-retribution | both | 900 | Lightsworn Battlegear |
| 10 | priest-shadow | both | 886 | Crimson Acolyte's Regalia |
| 10 | priest-healing | both | 885 | Crimson Acolyte's Raiment |
| 10 | druid-balance | both | 888 | Lasherweave Regalia |
| 10 | druid-feral | both | 889 | Lasherweave Battlegear |
| 10 | shaman-enhancement | both | 894 | Frost Witch's Battlegear |
| 10 | shaman-restoration | both | 892 | Frost Witch's Garb |
| 10 | shaman-elemental | both | 893 | Frost Witch's Regalia |
| 10 | warrior-tank | both | 896 | Ymirjar Lord's Plate |
| 10 | dk-tank | both | 898 | Scourgelord's Plate |
| 10 | paladin-protection | both | 901 | Lightsworn Plate |
| 10 | paladin-holy | both | 899 | Lightsworn Garb |

## Per-item vendor evidence

Every row was checked on **2026-09-12** and supports both item profiles. The item link is the actual fetched source URL. `Previous` is absent for all direct purchases. Costs are factual extractions; source pages may change after this date.

| Item / source | App cost | Previous | Native vendor cost | Vendor NPC IDs |
| --- | --- | --- | --- | --- |
| [47748](https://wotlk.evowow.com/?item=47748) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47749](https://wotlk.evowow.com/?item=47749) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47750](https://wotlk.evowow.com/?item=47750) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47751](https://wotlk.evowow.com/?item=47751) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [47752](https://wotlk.evowow.com/?item=47752) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [47753](https://wotlk.evowow.com/?item=47753) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [47754](https://wotlk.evowow.com/?item=47754) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47755](https://wotlk.evowow.com/?item=47755) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47756](https://wotlk.evowow.com/?item=47756) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47757](https://wotlk.evowow.com/?item=47757) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [47758](https://wotlk.evowow.com/?item=47758) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [47759](https://wotlk.evowow.com/?item=47759) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [47760](https://wotlk.evowow.com/?item=47760) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [47761](https://wotlk.evowow.com/?item=47761) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [47762](https://wotlk.evowow.com/?item=47762) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [47763](https://wotlk.evowow.com/?item=47763) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [47764](https://wotlk.evowow.com/?item=47764) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [47765](https://wotlk.evowow.com/?item=47765) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [47766](https://wotlk.evowow.com/?item=47766) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [47767](https://wotlk.evowow.com/?item=47767) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [47768](https://wotlk.evowow.com/?item=47768) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [47769](https://wotlk.evowow.com/?item=47769) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [47770](https://wotlk.evowow.com/?item=47770) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [47771](https://wotlk.evowow.com/?item=47771) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [47772](https://wotlk.evowow.com/?item=47772) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [47773](https://wotlk.evowow.com/?item=47773) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [47774](https://wotlk.evowow.com/?item=47774) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [47775](https://wotlk.evowow.com/?item=47775) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [47776](https://wotlk.evowow.com/?item=47776) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [47777](https://wotlk.evowow.com/?item=47777) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [47778](https://wotlk.evowow.com/?item=47778) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47779](https://wotlk.evowow.com/?item=47779) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47780](https://wotlk.evowow.com/?item=47780) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47781](https://wotlk.evowow.com/?item=47781) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [47782](https://wotlk.evowow.com/?item=47782) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [47783](https://wotlk.evowow.com/?item=47783) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [47784](https://wotlk.evowow.com/?item=47784) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47785](https://wotlk.evowow.com/?item=47785) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47786](https://wotlk.evowow.com/?item=47786) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47787](https://wotlk.evowow.com/?item=47787) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [47788](https://wotlk.evowow.com/?item=47788) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [47789](https://wotlk.evowow.com/?item=47789) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [47790](https://wotlk.evowow.com/?item=47790) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [47791](https://wotlk.evowow.com/?item=47791) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [47792](https://wotlk.evowow.com/?item=47792) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [47793](https://wotlk.evowow.com/?item=47793) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [47794](https://wotlk.evowow.com/?item=47794) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [47795](https://wotlk.evowow.com/?item=47795) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [47796](https://wotlk.evowow.com/?item=47796) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [47797](https://wotlk.evowow.com/?item=47797) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [47798](https://wotlk.evowow.com/?item=47798) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [47799](https://wotlk.evowow.com/?item=47799) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [47800](https://wotlk.evowow.com/?item=47800) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [47801](https://wotlk.evowow.com/?item=47801) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [47802](https://wotlk.evowow.com/?item=47802) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [47803](https://wotlk.evowow.com/?item=47803) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [47804](https://wotlk.evowow.com/?item=47804) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [47805](https://wotlk.evowow.com/?item=47805) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [47806](https://wotlk.evowow.com/?item=47806) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [47807](https://wotlk.evowow.com/?item=47807) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [47914](https://wotlk.evowow.com/?item=47914) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47936](https://wotlk.evowow.com/?item=47936) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47980](https://wotlk.evowow.com/?item=47980) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [47981](https://wotlk.evowow.com/?item=47981) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [47982](https://wotlk.evowow.com/?item=47982) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [47983](https://wotlk.evowow.com/?item=47983) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [47984](https://wotlk.evowow.com/?item=47984) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47985](https://wotlk.evowow.com/?item=47985) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47986](https://wotlk.evowow.com/?item=47986) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [47987](https://wotlk.evowow.com/?item=47987) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48029](https://wotlk.evowow.com/?item=48029) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48031](https://wotlk.evowow.com/?item=48031) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48033](https://wotlk.evowow.com/?item=48033) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48035](https://wotlk.evowow.com/?item=48035) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48037](https://wotlk.evowow.com/?item=48037) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48057](https://wotlk.evowow.com/?item=48057) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48058](https://wotlk.evowow.com/?item=48058) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48059](https://wotlk.evowow.com/?item=48059) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48060](https://wotlk.evowow.com/?item=48060) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48061](https://wotlk.evowow.com/?item=48061) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48062](https://wotlk.evowow.com/?item=48062) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48063](https://wotlk.evowow.com/?item=48063) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48064](https://wotlk.evowow.com/?item=48064) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48065](https://wotlk.evowow.com/?item=48065) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48066](https://wotlk.evowow.com/?item=48066) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48067](https://wotlk.evowow.com/?item=48067) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [48068](https://wotlk.evowow.com/?item=48068) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [48069](https://wotlk.evowow.com/?item=48069) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [48070](https://wotlk.evowow.com/?item=48070) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [48071](https://wotlk.evowow.com/?item=48071) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [48072](https://wotlk.evowow.com/?item=48072) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [48073](https://wotlk.evowow.com/?item=48073) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [48074](https://wotlk.evowow.com/?item=48074) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [48075](https://wotlk.evowow.com/?item=48075) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35579 |
| [48076](https://wotlk.evowow.com/?item=48076) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35579 |
| [48077](https://wotlk.evowow.com/?item=48077) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48078](https://wotlk.evowow.com/?item=48078) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48079](https://wotlk.evowow.com/?item=48079) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48080](https://wotlk.evowow.com/?item=48080) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48081](https://wotlk.evowow.com/?item=48081) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48082](https://wotlk.evowow.com/?item=48082) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48083](https://wotlk.evowow.com/?item=48083) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48084](https://wotlk.evowow.com/?item=48084) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48085](https://wotlk.evowow.com/?item=48085) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48086](https://wotlk.evowow.com/?item=48086) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48087](https://wotlk.evowow.com/?item=48087) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48088](https://wotlk.evowow.com/?item=48088) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48089](https://wotlk.evowow.com/?item=48089) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48090](https://wotlk.evowow.com/?item=48090) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48091](https://wotlk.evowow.com/?item=48091) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48092](https://wotlk.evowow.com/?item=48092) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48093](https://wotlk.evowow.com/?item=48093) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48094](https://wotlk.evowow.com/?item=48094) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48095](https://wotlk.evowow.com/?item=48095) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48096](https://wotlk.evowow.com/?item=48096) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48097](https://wotlk.evowow.com/?item=48097) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [48098](https://wotlk.evowow.com/?item=48098) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [48099](https://wotlk.evowow.com/?item=48099) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [48100](https://wotlk.evowow.com/?item=48100) | triumph=50 | — | `[0,[[301,50]]]` | 35496, 35580 |
| [48101](https://wotlk.evowow.com/?item=48101) | triumph=30 | — | `[0,[[301,30]]]` | 35496, 35580 |
| [48102](https://wotlk.evowow.com/?item=48102) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48129](https://wotlk.evowow.com/?item=48129) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48130](https://wotlk.evowow.com/?item=48130) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48131](https://wotlk.evowow.com/?item=48131) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48132](https://wotlk.evowow.com/?item=48132) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48133](https://wotlk.evowow.com/?item=48133) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48134](https://wotlk.evowow.com/?item=48134) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48135](https://wotlk.evowow.com/?item=48135) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48136](https://wotlk.evowow.com/?item=48136) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48137](https://wotlk.evowow.com/?item=48137) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48138](https://wotlk.evowow.com/?item=48138) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48139](https://wotlk.evowow.com/?item=48139) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48140](https://wotlk.evowow.com/?item=48140) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48141](https://wotlk.evowow.com/?item=48141) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48142](https://wotlk.evowow.com/?item=48142) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48143](https://wotlk.evowow.com/?item=48143) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48144](https://wotlk.evowow.com/?item=48144) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48145](https://wotlk.evowow.com/?item=48145) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48146](https://wotlk.evowow.com/?item=48146) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48147](https://wotlk.evowow.com/?item=48147) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48148](https://wotlk.evowow.com/?item=48148) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48149](https://wotlk.evowow.com/?item=48149) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48150](https://wotlk.evowow.com/?item=48150) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48151](https://wotlk.evowow.com/?item=48151) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48152](https://wotlk.evowow.com/?item=48152) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48153](https://wotlk.evowow.com/?item=48153) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48154](https://wotlk.evowow.com/?item=48154) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48155](https://wotlk.evowow.com/?item=48155) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48156](https://wotlk.evowow.com/?item=48156) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48157](https://wotlk.evowow.com/?item=48157) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48158](https://wotlk.evowow.com/?item=48158) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48159](https://wotlk.evowow.com/?item=48159) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48160](https://wotlk.evowow.com/?item=48160) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48161](https://wotlk.evowow.com/?item=48161) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48162](https://wotlk.evowow.com/?item=48162) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48163](https://wotlk.evowow.com/?item=48163) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48164](https://wotlk.evowow.com/?item=48164) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48165](https://wotlk.evowow.com/?item=48165) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48166](https://wotlk.evowow.com/?item=48166) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48167](https://wotlk.evowow.com/?item=48167) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48168](https://wotlk.evowow.com/?item=48168) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48169](https://wotlk.evowow.com/?item=48169) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48170](https://wotlk.evowow.com/?item=48170) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48171](https://wotlk.evowow.com/?item=48171) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48172](https://wotlk.evowow.com/?item=48172) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48173](https://wotlk.evowow.com/?item=48173) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48174](https://wotlk.evowow.com/?item=48174) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48175](https://wotlk.evowow.com/?item=48175) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48176](https://wotlk.evowow.com/?item=48176) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48177](https://wotlk.evowow.com/?item=48177) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48178](https://wotlk.evowow.com/?item=48178) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48179](https://wotlk.evowow.com/?item=48179) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48180](https://wotlk.evowow.com/?item=48180) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48181](https://wotlk.evowow.com/?item=48181) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48182](https://wotlk.evowow.com/?item=48182) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48183](https://wotlk.evowow.com/?item=48183) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48184](https://wotlk.evowow.com/?item=48184) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48185](https://wotlk.evowow.com/?item=48185) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48186](https://wotlk.evowow.com/?item=48186) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48187](https://wotlk.evowow.com/?item=48187) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48188](https://wotlk.evowow.com/?item=48188) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48189](https://wotlk.evowow.com/?item=48189) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48190](https://wotlk.evowow.com/?item=48190) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48191](https://wotlk.evowow.com/?item=48191) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48192](https://wotlk.evowow.com/?item=48192) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48193](https://wotlk.evowow.com/?item=48193) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48194](https://wotlk.evowow.com/?item=48194) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48195](https://wotlk.evowow.com/?item=48195) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48196](https://wotlk.evowow.com/?item=48196) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48197](https://wotlk.evowow.com/?item=48197) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48198](https://wotlk.evowow.com/?item=48198) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48199](https://wotlk.evowow.com/?item=48199) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48200](https://wotlk.evowow.com/?item=48200) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48201](https://wotlk.evowow.com/?item=48201) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48202](https://wotlk.evowow.com/?item=48202) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48203](https://wotlk.evowow.com/?item=48203) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48204](https://wotlk.evowow.com/?item=48204) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48205](https://wotlk.evowow.com/?item=48205) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48206](https://wotlk.evowow.com/?item=48206) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48207](https://wotlk.evowow.com/?item=48207) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48208](https://wotlk.evowow.com/?item=48208) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48209](https://wotlk.evowow.com/?item=48209) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48210](https://wotlk.evowow.com/?item=48210) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48211](https://wotlk.evowow.com/?item=48211) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48212](https://wotlk.evowow.com/?item=48212) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48213](https://wotlk.evowow.com/?item=48213) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48214](https://wotlk.evowow.com/?item=48214) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48215](https://wotlk.evowow.com/?item=48215) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48216](https://wotlk.evowow.com/?item=48216) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48217](https://wotlk.evowow.com/?item=48217) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48218](https://wotlk.evowow.com/?item=48218) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48219](https://wotlk.evowow.com/?item=48219) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48220](https://wotlk.evowow.com/?item=48220) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35579 |
| [48221](https://wotlk.evowow.com/?item=48221) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48222](https://wotlk.evowow.com/?item=48222) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35579 |
| [48223](https://wotlk.evowow.com/?item=48223) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48224](https://wotlk.evowow.com/?item=48224) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48225](https://wotlk.evowow.com/?item=48225) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48226](https://wotlk.evowow.com/?item=48226) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48227](https://wotlk.evowow.com/?item=48227) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48228](https://wotlk.evowow.com/?item=48228) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48229](https://wotlk.evowow.com/?item=48229) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48230](https://wotlk.evowow.com/?item=48230) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48231](https://wotlk.evowow.com/?item=48231) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48232](https://wotlk.evowow.com/?item=48232) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48233](https://wotlk.evowow.com/?item=48233) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48234](https://wotlk.evowow.com/?item=48234) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48235](https://wotlk.evowow.com/?item=48235) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48236](https://wotlk.evowow.com/?item=48236) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48237](https://wotlk.evowow.com/?item=48237) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48238](https://wotlk.evowow.com/?item=48238) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48239](https://wotlk.evowow.com/?item=48239) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48240](https://wotlk.evowow.com/?item=48240) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48241](https://wotlk.evowow.com/?item=48241) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48242](https://wotlk.evowow.com/?item=48242) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48243](https://wotlk.evowow.com/?item=48243) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48244](https://wotlk.evowow.com/?item=48244) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48245](https://wotlk.evowow.com/?item=48245) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48246](https://wotlk.evowow.com/?item=48246) | triumph=50 | — | `[0,[[301,50]]]` | 35497, 35580 |
| [48247](https://wotlk.evowow.com/?item=48247) | triumph=30 | — | `[0,[[301,30]]]` | 35497, 35580 |
| [48250](https://wotlk.evowow.com/?item=48250) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48251](https://wotlk.evowow.com/?item=48251) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48252](https://wotlk.evowow.com/?item=48252) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48253](https://wotlk.evowow.com/?item=48253) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48254](https://wotlk.evowow.com/?item=48254) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48255](https://wotlk.evowow.com/?item=48255) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48256](https://wotlk.evowow.com/?item=48256) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48257](https://wotlk.evowow.com/?item=48257) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48258](https://wotlk.evowow.com/?item=48258) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48259](https://wotlk.evowow.com/?item=48259) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48260](https://wotlk.evowow.com/?item=48260) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48261](https://wotlk.evowow.com/?item=48261) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48262](https://wotlk.evowow.com/?item=48262) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48263](https://wotlk.evowow.com/?item=48263) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48264](https://wotlk.evowow.com/?item=48264) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48265](https://wotlk.evowow.com/?item=48265) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48266](https://wotlk.evowow.com/?item=48266) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48267](https://wotlk.evowow.com/?item=48267) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48268](https://wotlk.evowow.com/?item=48268) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48269](https://wotlk.evowow.com/?item=48269) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48270](https://wotlk.evowow.com/?item=48270) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48271](https://wotlk.evowow.com/?item=48271) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48272](https://wotlk.evowow.com/?item=48272) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48273](https://wotlk.evowow.com/?item=48273) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48274](https://wotlk.evowow.com/?item=48274) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48275](https://wotlk.evowow.com/?item=48275) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48276](https://wotlk.evowow.com/?item=48276) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48277](https://wotlk.evowow.com/?item=48277) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48278](https://wotlk.evowow.com/?item=48278) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48279](https://wotlk.evowow.com/?item=48279) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48280](https://wotlk.evowow.com/?item=48280) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48281](https://wotlk.evowow.com/?item=48281) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48282](https://wotlk.evowow.com/?item=48282) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48283](https://wotlk.evowow.com/?item=48283) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48284](https://wotlk.evowow.com/?item=48284) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48285](https://wotlk.evowow.com/?item=48285) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48286](https://wotlk.evowow.com/?item=48286) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48287](https://wotlk.evowow.com/?item=48287) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48288](https://wotlk.evowow.com/?item=48288) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48289](https://wotlk.evowow.com/?item=48289) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48290](https://wotlk.evowow.com/?item=48290) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48291](https://wotlk.evowow.com/?item=48291) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48292](https://wotlk.evowow.com/?item=48292) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48293](https://wotlk.evowow.com/?item=48293) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48294](https://wotlk.evowow.com/?item=48294) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48295](https://wotlk.evowow.com/?item=48295) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48296](https://wotlk.evowow.com/?item=48296) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48297](https://wotlk.evowow.com/?item=48297) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48298](https://wotlk.evowow.com/?item=48298) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48299](https://wotlk.evowow.com/?item=48299) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48300](https://wotlk.evowow.com/?item=48300) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48301](https://wotlk.evowow.com/?item=48301) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48302](https://wotlk.evowow.com/?item=48302) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48303](https://wotlk.evowow.com/?item=48303) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48304](https://wotlk.evowow.com/?item=48304) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48305](https://wotlk.evowow.com/?item=48305) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48306](https://wotlk.evowow.com/?item=48306) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48307](https://wotlk.evowow.com/?item=48307) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48308](https://wotlk.evowow.com/?item=48308) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48309](https://wotlk.evowow.com/?item=48309) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48310](https://wotlk.evowow.com/?item=48310) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48312](https://wotlk.evowow.com/?item=48312) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48313](https://wotlk.evowow.com/?item=48313) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48314](https://wotlk.evowow.com/?item=48314) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48315](https://wotlk.evowow.com/?item=48315) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48316](https://wotlk.evowow.com/?item=48316) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48317](https://wotlk.evowow.com/?item=48317) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48318](https://wotlk.evowow.com/?item=48318) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48319](https://wotlk.evowow.com/?item=48319) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48320](https://wotlk.evowow.com/?item=48320) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48321](https://wotlk.evowow.com/?item=48321) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48322](https://wotlk.evowow.com/?item=48322) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48323](https://wotlk.evowow.com/?item=48323) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48324](https://wotlk.evowow.com/?item=48324) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48325](https://wotlk.evowow.com/?item=48325) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48326](https://wotlk.evowow.com/?item=48326) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48327](https://wotlk.evowow.com/?item=48327) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48328](https://wotlk.evowow.com/?item=48328) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48329](https://wotlk.evowow.com/?item=48329) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48330](https://wotlk.evowow.com/?item=48330) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48331](https://wotlk.evowow.com/?item=48331) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48332](https://wotlk.evowow.com/?item=48332) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48333](https://wotlk.evowow.com/?item=48333) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48334](https://wotlk.evowow.com/?item=48334) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48335](https://wotlk.evowow.com/?item=48335) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48336](https://wotlk.evowow.com/?item=48336) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48337](https://wotlk.evowow.com/?item=48337) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48338](https://wotlk.evowow.com/?item=48338) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48339](https://wotlk.evowow.com/?item=48339) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48340](https://wotlk.evowow.com/?item=48340) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48341](https://wotlk.evowow.com/?item=48341) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48342](https://wotlk.evowow.com/?item=48342) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48343](https://wotlk.evowow.com/?item=48343) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48344](https://wotlk.evowow.com/?item=48344) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35579 |
| [48345](https://wotlk.evowow.com/?item=48345) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35579 |
| [48346](https://wotlk.evowow.com/?item=48346) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48347](https://wotlk.evowow.com/?item=48347) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48348](https://wotlk.evowow.com/?item=48348) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48349](https://wotlk.evowow.com/?item=48349) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48350](https://wotlk.evowow.com/?item=48350) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48351](https://wotlk.evowow.com/?item=48351) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48352](https://wotlk.evowow.com/?item=48352) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48353](https://wotlk.evowow.com/?item=48353) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48354](https://wotlk.evowow.com/?item=48354) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48355](https://wotlk.evowow.com/?item=48355) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48356](https://wotlk.evowow.com/?item=48356) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48357](https://wotlk.evowow.com/?item=48357) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48358](https://wotlk.evowow.com/?item=48358) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48359](https://wotlk.evowow.com/?item=48359) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48360](https://wotlk.evowow.com/?item=48360) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48361](https://wotlk.evowow.com/?item=48361) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48362](https://wotlk.evowow.com/?item=48362) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48363](https://wotlk.evowow.com/?item=48363) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48364](https://wotlk.evowow.com/?item=48364) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48365](https://wotlk.evowow.com/?item=48365) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48366](https://wotlk.evowow.com/?item=48366) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48367](https://wotlk.evowow.com/?item=48367) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48368](https://wotlk.evowow.com/?item=48368) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48369](https://wotlk.evowow.com/?item=48369) | triumph=50 | — | `[0,[[301,50]]]` | 35500, 35580 |
| [48370](https://wotlk.evowow.com/?item=48370) | triumph=30 | — | `[0,[[301,30]]]` | 35500, 35580 |
| [48371](https://wotlk.evowow.com/?item=48371) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48372](https://wotlk.evowow.com/?item=48372) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48373](https://wotlk.evowow.com/?item=48373) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48374](https://wotlk.evowow.com/?item=48374) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48375](https://wotlk.evowow.com/?item=48375) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48376](https://wotlk.evowow.com/?item=48376) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48377](https://wotlk.evowow.com/?item=48377) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48378](https://wotlk.evowow.com/?item=48378) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48379](https://wotlk.evowow.com/?item=48379) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48380](https://wotlk.evowow.com/?item=48380) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48381](https://wotlk.evowow.com/?item=48381) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48382](https://wotlk.evowow.com/?item=48382) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48383](https://wotlk.evowow.com/?item=48383) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48384](https://wotlk.evowow.com/?item=48384) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48385](https://wotlk.evowow.com/?item=48385) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48386](https://wotlk.evowow.com/?item=48386) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48387](https://wotlk.evowow.com/?item=48387) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48388](https://wotlk.evowow.com/?item=48388) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48389](https://wotlk.evowow.com/?item=48389) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48390](https://wotlk.evowow.com/?item=48390) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48391](https://wotlk.evowow.com/?item=48391) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48392](https://wotlk.evowow.com/?item=48392) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48393](https://wotlk.evowow.com/?item=48393) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48394](https://wotlk.evowow.com/?item=48394) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48395](https://wotlk.evowow.com/?item=48395) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48396](https://wotlk.evowow.com/?item=48396) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48397](https://wotlk.evowow.com/?item=48397) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48398](https://wotlk.evowow.com/?item=48398) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48399](https://wotlk.evowow.com/?item=48399) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48400](https://wotlk.evowow.com/?item=48400) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48429](https://wotlk.evowow.com/?item=48429) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48430](https://wotlk.evowow.com/?item=48430) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48433](https://wotlk.evowow.com/?item=48433) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48436](https://wotlk.evowow.com/?item=48436) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48445](https://wotlk.evowow.com/?item=48445) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48446](https://wotlk.evowow.com/?item=48446) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48447](https://wotlk.evowow.com/?item=48447) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48448](https://wotlk.evowow.com/?item=48448) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48449](https://wotlk.evowow.com/?item=48449) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48450](https://wotlk.evowow.com/?item=48450) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48451](https://wotlk.evowow.com/?item=48451) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48452](https://wotlk.evowow.com/?item=48452) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48453](https://wotlk.evowow.com/?item=48453) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48454](https://wotlk.evowow.com/?item=48454) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48455](https://wotlk.evowow.com/?item=48455) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35575 |
| [48456](https://wotlk.evowow.com/?item=48456) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48457](https://wotlk.evowow.com/?item=48457) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48458](https://wotlk.evowow.com/?item=48458) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48459](https://wotlk.evowow.com/?item=48459) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48460](https://wotlk.evowow.com/?item=48460) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48461](https://wotlk.evowow.com/?item=48461) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48462](https://wotlk.evowow.com/?item=48462) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48463](https://wotlk.evowow.com/?item=48463) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48464](https://wotlk.evowow.com/?item=48464) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48465](https://wotlk.evowow.com/?item=48465) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48466](https://wotlk.evowow.com/?item=48466) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48467](https://wotlk.evowow.com/?item=48467) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48468](https://wotlk.evowow.com/?item=48468) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48469](https://wotlk.evowow.com/?item=48469) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48470](https://wotlk.evowow.com/?item=48470) | regalia:protector=1 | — | `[0,[],[[47558,1]]]` | 35576 |
| [48472](https://wotlk.evowow.com/?item=48472) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48474](https://wotlk.evowow.com/?item=48474) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48476](https://wotlk.evowow.com/?item=48476) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48478](https://wotlk.evowow.com/?item=48478) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48480](https://wotlk.evowow.com/?item=48480) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48481](https://wotlk.evowow.com/?item=48481) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48482](https://wotlk.evowow.com/?item=48482) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48483](https://wotlk.evowow.com/?item=48483) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48484](https://wotlk.evowow.com/?item=48484) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48485](https://wotlk.evowow.com/?item=48485) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48486](https://wotlk.evowow.com/?item=48486) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48487](https://wotlk.evowow.com/?item=48487) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48488](https://wotlk.evowow.com/?item=48488) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48489](https://wotlk.evowow.com/?item=48489) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48490](https://wotlk.evowow.com/?item=48490) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48491](https://wotlk.evowow.com/?item=48491) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48492](https://wotlk.evowow.com/?item=48492) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48493](https://wotlk.evowow.com/?item=48493) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48494](https://wotlk.evowow.com/?item=48494) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48495](https://wotlk.evowow.com/?item=48495) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48496](https://wotlk.evowow.com/?item=48496) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48497](https://wotlk.evowow.com/?item=48497) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48498](https://wotlk.evowow.com/?item=48498) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48499](https://wotlk.evowow.com/?item=48499) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48500](https://wotlk.evowow.com/?item=48500) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48501](https://wotlk.evowow.com/?item=48501) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48502](https://wotlk.evowow.com/?item=48502) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48503](https://wotlk.evowow.com/?item=48503) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48504](https://wotlk.evowow.com/?item=48504) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48505](https://wotlk.evowow.com/?item=48505) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48529](https://wotlk.evowow.com/?item=48529) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48531](https://wotlk.evowow.com/?item=48531) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48533](https://wotlk.evowow.com/?item=48533) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48535](https://wotlk.evowow.com/?item=48535) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48537](https://wotlk.evowow.com/?item=48537) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48538](https://wotlk.evowow.com/?item=48538) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48539](https://wotlk.evowow.com/?item=48539) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48540](https://wotlk.evowow.com/?item=48540) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48541](https://wotlk.evowow.com/?item=48541) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48542](https://wotlk.evowow.com/?item=48542) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48543](https://wotlk.evowow.com/?item=48543) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48544](https://wotlk.evowow.com/?item=48544) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48545](https://wotlk.evowow.com/?item=48545) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48546](https://wotlk.evowow.com/?item=48546) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48547](https://wotlk.evowow.com/?item=48547) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35575 |
| [48548](https://wotlk.evowow.com/?item=48548) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48549](https://wotlk.evowow.com/?item=48549) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48550](https://wotlk.evowow.com/?item=48550) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48551](https://wotlk.evowow.com/?item=48551) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48552](https://wotlk.evowow.com/?item=48552) | regalia:vanquisher=1 | — | `[0,[],[[47559,1]]]` | 35576 |
| [48553](https://wotlk.evowow.com/?item=48553) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48554](https://wotlk.evowow.com/?item=48554) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48555](https://wotlk.evowow.com/?item=48555) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48556](https://wotlk.evowow.com/?item=48556) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48557](https://wotlk.evowow.com/?item=48557) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48558](https://wotlk.evowow.com/?item=48558) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48559](https://wotlk.evowow.com/?item=48559) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48560](https://wotlk.evowow.com/?item=48560) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48561](https://wotlk.evowow.com/?item=48561) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48562](https://wotlk.evowow.com/?item=48562) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48564](https://wotlk.evowow.com/?item=48564) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48566](https://wotlk.evowow.com/?item=48566) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48568](https://wotlk.evowow.com/?item=48568) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48572](https://wotlk.evowow.com/?item=48572) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48574](https://wotlk.evowow.com/?item=48574) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48575](https://wotlk.evowow.com/?item=48575) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48576](https://wotlk.evowow.com/?item=48576) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48577](https://wotlk.evowow.com/?item=48577) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48578](https://wotlk.evowow.com/?item=48578) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48579](https://wotlk.evowow.com/?item=48579) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48580](https://wotlk.evowow.com/?item=48580) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48581](https://wotlk.evowow.com/?item=48581) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48582](https://wotlk.evowow.com/?item=48582) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48583](https://wotlk.evowow.com/?item=48583) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48584](https://wotlk.evowow.com/?item=48584) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48585](https://wotlk.evowow.com/?item=48585) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48586](https://wotlk.evowow.com/?item=48586) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48587](https://wotlk.evowow.com/?item=48587) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48588](https://wotlk.evowow.com/?item=48588) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48589](https://wotlk.evowow.com/?item=48589) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48590](https://wotlk.evowow.com/?item=48590) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48591](https://wotlk.evowow.com/?item=48591) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48592](https://wotlk.evowow.com/?item=48592) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48593](https://wotlk.evowow.com/?item=48593) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48594](https://wotlk.evowow.com/?item=48594) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48595](https://wotlk.evowow.com/?item=48595) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48596](https://wotlk.evowow.com/?item=48596) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48597](https://wotlk.evowow.com/?item=48597) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48598](https://wotlk.evowow.com/?item=48598) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48599](https://wotlk.evowow.com/?item=48599) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48602](https://wotlk.evowow.com/?item=48602) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48603](https://wotlk.evowow.com/?item=48603) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48604](https://wotlk.evowow.com/?item=48604) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48605](https://wotlk.evowow.com/?item=48605) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48606](https://wotlk.evowow.com/?item=48606) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48607](https://wotlk.evowow.com/?item=48607) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48608](https://wotlk.evowow.com/?item=48608) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48609](https://wotlk.evowow.com/?item=48609) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48610](https://wotlk.evowow.com/?item=48610) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48611](https://wotlk.evowow.com/?item=48611) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48612](https://wotlk.evowow.com/?item=48612) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48613](https://wotlk.evowow.com/?item=48613) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48614](https://wotlk.evowow.com/?item=48614) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48615](https://wotlk.evowow.com/?item=48615) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48616](https://wotlk.evowow.com/?item=48616) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48617](https://wotlk.evowow.com/?item=48617) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48618](https://wotlk.evowow.com/?item=48618) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48619](https://wotlk.evowow.com/?item=48619) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48620](https://wotlk.evowow.com/?item=48620) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48621](https://wotlk.evowow.com/?item=48621) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48622](https://wotlk.evowow.com/?item=48622) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48623](https://wotlk.evowow.com/?item=48623) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48624](https://wotlk.evowow.com/?item=48624) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48625](https://wotlk.evowow.com/?item=48625) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48626](https://wotlk.evowow.com/?item=48626) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48627](https://wotlk.evowow.com/?item=48627) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48628](https://wotlk.evowow.com/?item=48628) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48629](https://wotlk.evowow.com/?item=48629) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48630](https://wotlk.evowow.com/?item=48630) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48631](https://wotlk.evowow.com/?item=48631) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48632](https://wotlk.evowow.com/?item=48632) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48633](https://wotlk.evowow.com/?item=48633) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48634](https://wotlk.evowow.com/?item=48634) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48635](https://wotlk.evowow.com/?item=48635) | triumph=50 | — | `[0,[[301,50]]]` | 34252, 35579 |
| [48636](https://wotlk.evowow.com/?item=48636) | triumph=30 | — | `[0,[[301,30]]]` | 34252, 35579 |
| [48637](https://wotlk.evowow.com/?item=48637) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48638](https://wotlk.evowow.com/?item=48638) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48639](https://wotlk.evowow.com/?item=48639) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48640](https://wotlk.evowow.com/?item=48640) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35577 |
| [48641](https://wotlk.evowow.com/?item=48641) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35577 |
| [48642](https://wotlk.evowow.com/?item=48642) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48643](https://wotlk.evowow.com/?item=48643) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48644](https://wotlk.evowow.com/?item=48644) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48645](https://wotlk.evowow.com/?item=48645) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48646](https://wotlk.evowow.com/?item=48646) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35575 |
| [48647](https://wotlk.evowow.com/?item=48647) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48648](https://wotlk.evowow.com/?item=48648) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48649](https://wotlk.evowow.com/?item=48649) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48650](https://wotlk.evowow.com/?item=48650) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48651](https://wotlk.evowow.com/?item=48651) | regalia:conqueror=1 | — | `[0,[],[[47557,1]]]` | 35576 |
| [48652](https://wotlk.evowow.com/?item=48652) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48653](https://wotlk.evowow.com/?item=48653) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48654](https://wotlk.evowow.com/?item=48654) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48655](https://wotlk.evowow.com/?item=48655) | triumph=50 | — | `[0,[[301,50]]]` | 35498, 35580 |
| [48656](https://wotlk.evowow.com/?item=48656) | triumph=30 | — | `[0,[[301,30]]]` | 35498, 35580 |
| [48657](https://wotlk.evowow.com/?item=48657) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48658](https://wotlk.evowow.com/?item=48658) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [48659](https://wotlk.evowow.com/?item=48659) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48660](https://wotlk.evowow.com/?item=48660) | triumph=75, trophy=1 | — | `[0,[[301,75]],[[47242,1]]]` | 35578 |
| [48661](https://wotlk.evowow.com/?item=48661) | triumph=45, trophy=1 | — | `[0,[[301,45]],[[47242,1]]]` | 35578 |
| [50078](https://wotlk.evowow.com/?item=50078) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37688 |
| [50079](https://wotlk.evowow.com/?item=50079) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37688 |
| [50080](https://wotlk.evowow.com/?item=50080) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37688 |
| [50081](https://wotlk.evowow.com/?item=50081) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37688 |
| [50082](https://wotlk.evowow.com/?item=50082) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37688 |
| [50087](https://wotlk.evowow.com/?item=50087) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37991, 37997 |
| [50088](https://wotlk.evowow.com/?item=50088) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37991, 37997 |
| [50089](https://wotlk.evowow.com/?item=50089) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37991, 37997 |
| [50090](https://wotlk.evowow.com/?item=50090) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37991, 37997 |
| [50094](https://wotlk.evowow.com/?item=50094) | frost=95 | — | `[0,[[341,95]]]` | 35498, 38316 |
| [50095](https://wotlk.evowow.com/?item=50095) | frost=60 | — | `[0,[[341,60]]]` | 35498, 38316 |
| [50096](https://wotlk.evowow.com/?item=50096) | frost=95 | — | `[0,[[341,95]]]` | 35498, 38316 |
| [50097](https://wotlk.evowow.com/?item=50097) | frost=95 | — | `[0,[[341,95]]]` | 35498, 38316 |
| [50098](https://wotlk.evowow.com/?item=50098) | frost=60 | — | `[0,[[341,60]]]` | 35498, 38316 |
| [50105](https://wotlk.evowow.com/?item=50105) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37991, 37997 |
| [50106](https://wotlk.evowow.com/?item=50106) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50107](https://wotlk.evowow.com/?item=50107) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37992, 37999 |
| [50108](https://wotlk.evowow.com/?item=50108) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50109](https://wotlk.evowow.com/?item=50109) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50113](https://wotlk.evowow.com/?item=50113) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37992, 37999 |
| [50114](https://wotlk.evowow.com/?item=50114) | frost=60 | — | `[0,[[341,60]]]` | 35500, 37993, 37998 |
| [50115](https://wotlk.evowow.com/?item=50115) | frost=95 | — | `[0,[[341,95]]]` | 35500, 37993, 37998 |
| [50116](https://wotlk.evowow.com/?item=50116) | frost=95 | — | `[0,[[341,95]]]` | 35500, 37993, 37998 |
| [50117](https://wotlk.evowow.com/?item=50117) | frost=60 | — | `[0,[[341,60]]]` | 35500, 37993, 37998 |
| [50118](https://wotlk.evowow.com/?item=50118) | frost=95 | — | `[0,[[341,95]]]` | 35500, 37993, 37998 |
| [50240](https://wotlk.evowow.com/?item=50240) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38181, 38182 |
| [50241](https://wotlk.evowow.com/?item=50241) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38181, 38182 |
| [50242](https://wotlk.evowow.com/?item=50242) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38181, 38182 |
| [50243](https://wotlk.evowow.com/?item=50243) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38181, 38182 |
| [50244](https://wotlk.evowow.com/?item=50244) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38181, 38182 |
| [50275](https://wotlk.evowow.com/?item=50275) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38283, 38284 |
| [50276](https://wotlk.evowow.com/?item=50276) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38283, 38284 |
| [50277](https://wotlk.evowow.com/?item=50277) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38283, 38284 |
| [50278](https://wotlk.evowow.com/?item=50278) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38283, 38284 |
| [50279](https://wotlk.evowow.com/?item=50279) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38283, 38284 |
| [50324](https://wotlk.evowow.com/?item=50324) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37696 |
| [50325](https://wotlk.evowow.com/?item=50325) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50326](https://wotlk.evowow.com/?item=50326) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50327](https://wotlk.evowow.com/?item=50327) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37696 |
| [50328](https://wotlk.evowow.com/?item=50328) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50391](https://wotlk.evowow.com/?item=50391) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38054 |
| [50392](https://wotlk.evowow.com/?item=50392) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38054 |
| [50393](https://wotlk.evowow.com/?item=50393) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38054 |
| [50394](https://wotlk.evowow.com/?item=50394) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38054 |
| [50396](https://wotlk.evowow.com/?item=50396) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38054 |
| [50765](https://wotlk.evowow.com/?item=50765) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38054 |
| [50766](https://wotlk.evowow.com/?item=50766) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38054 |
| [50767](https://wotlk.evowow.com/?item=50767) | frost=60 | — | `[0,[[341,60]]]` | 35496, 38054 |
| [50768](https://wotlk.evowow.com/?item=50768) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38054 |
| [50769](https://wotlk.evowow.com/?item=50769) | frost=95 | — | `[0,[[341,95]]]` | 35496, 38054 |
| [50819](https://wotlk.evowow.com/?item=50819) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37992, 37999 |
| [50820](https://wotlk.evowow.com/?item=50820) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50821](https://wotlk.evowow.com/?item=50821) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50822](https://wotlk.evowow.com/?item=50822) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37992, 37999 |
| [50823](https://wotlk.evowow.com/?item=50823) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50824](https://wotlk.evowow.com/?item=50824) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37992, 37999 |
| [50825](https://wotlk.evowow.com/?item=50825) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50826](https://wotlk.evowow.com/?item=50826) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50827](https://wotlk.evowow.com/?item=50827) | frost=60 | — | `[0,[[341,60]]]` | 35497, 37992, 37999 |
| [50828](https://wotlk.evowow.com/?item=50828) | frost=95 | — | `[0,[[341,95]]]` | 35497, 37992, 37999 |
| [50830](https://wotlk.evowow.com/?item=50830) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50831](https://wotlk.evowow.com/?item=50831) | frost=60 | — | `[0,[[341,60]]]` | 35500, 38840, 38841 |
| [50832](https://wotlk.evowow.com/?item=50832) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50833](https://wotlk.evowow.com/?item=50833) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50834](https://wotlk.evowow.com/?item=50834) | frost=60 | — | `[0,[[341,60]]]` | 35500, 38840, 38841 |
| [50835](https://wotlk.evowow.com/?item=50835) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50836](https://wotlk.evowow.com/?item=50836) | frost=60 | — | `[0,[[341,60]]]` | 35500, 38840, 38841 |
| [50837](https://wotlk.evowow.com/?item=50837) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50838](https://wotlk.evowow.com/?item=50838) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50839](https://wotlk.evowow.com/?item=50839) | frost=60 | — | `[0,[[341,60]]]` | 35500, 38840, 38841 |
| [50841](https://wotlk.evowow.com/?item=50841) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50842](https://wotlk.evowow.com/?item=50842) | frost=60 | — | `[0,[[341,60]]]` | 35500, 38840, 38841 |
| [50843](https://wotlk.evowow.com/?item=50843) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50844](https://wotlk.evowow.com/?item=50844) | frost=95 | — | `[0,[[341,95]]]` | 35500, 38840, 38841 |
| [50845](https://wotlk.evowow.com/?item=50845) | frost=60 | — | `[0,[[341,60]]]` | 35500, 38840, 38841 |
| [50846](https://wotlk.evowow.com/?item=50846) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37688 |
| [50847](https://wotlk.evowow.com/?item=50847) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37688 |
| [50848](https://wotlk.evowow.com/?item=50848) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37688 |
| [50849](https://wotlk.evowow.com/?item=50849) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37688 |
| [50850](https://wotlk.evowow.com/?item=50850) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37688 |
| [50853](https://wotlk.evowow.com/?item=50853) | frost=60 | — | `[0,[[341,60]]]` | 35498, 38316 |
| [50854](https://wotlk.evowow.com/?item=50854) | frost=95 | — | `[0,[[341,95]]]` | 35498, 38316 |
| [50855](https://wotlk.evowow.com/?item=50855) | frost=95 | — | `[0,[[341,95]]]` | 35498, 38316 |
| [50856](https://wotlk.evowow.com/?item=50856) | frost=60 | — | `[0,[[341,60]]]` | 35498, 38316 |
| [50857](https://wotlk.evowow.com/?item=50857) | frost=95 | — | `[0,[[341,95]]]` | 35498, 38316 |
| [50860](https://wotlk.evowow.com/?item=50860) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37696 |
| [50861](https://wotlk.evowow.com/?item=50861) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50862](https://wotlk.evowow.com/?item=50862) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50863](https://wotlk.evowow.com/?item=50863) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37696 |
| [50864](https://wotlk.evowow.com/?item=50864) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50865](https://wotlk.evowow.com/?item=50865) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37696 |
| [50866](https://wotlk.evowow.com/?item=50866) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50867](https://wotlk.evowow.com/?item=50867) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [50868](https://wotlk.evowow.com/?item=50868) | frost=60 | — | `[0,[[341,60]]]` | 35498, 37696 |
| [50869](https://wotlk.evowow.com/?item=50869) | frost=95 | — | `[0,[[341,95]]]` | 35498, 37696 |
| [51125](https://wotlk.evowow.com/?item=51125) | mark:normal:vanquisher=1 | 50098 | `[0,[],[[52025,1],[50098,1]]]` | 35498, 38316 |
| [51126](https://wotlk.evowow.com/?item=51126) | mark:normal:vanquisher=1 | 50097 | `[0,[],[[52025,1],[50097,1]]]` | 35498, 38316 |
| [51127](https://wotlk.evowow.com/?item=51127) | mark:normal:vanquisher=1 | 50096 | `[0,[],[[52025,1],[50096,1]]]` | 35498, 38316 |
| [51128](https://wotlk.evowow.com/?item=51128) | mark:normal:vanquisher=1 | 50095 | `[0,[],[[52025,1],[50095,1]]]` | 35498, 38316 |
| [51129](https://wotlk.evowow.com/?item=51129) | mark:normal:vanquisher=1 | 50094 | `[0,[],[[52025,1],[50094,1]]]` | 35498, 38316 |
| [51130](https://wotlk.evowow.com/?item=51130) | mark:normal:vanquisher=1 | 50853 | `[0,[],[[52025,1],[50853,1]]]` | 35498, 38316 |
| [51131](https://wotlk.evowow.com/?item=51131) | mark:normal:vanquisher=1 | 50854 | `[0,[],[[52025,1],[50854,1]]]` | 35498, 38316 |
| [51132](https://wotlk.evowow.com/?item=51132) | mark:normal:vanquisher=1 | 50856 | `[0,[],[[52025,1],[50856,1]]]` | 35498, 38316 |
| [51133](https://wotlk.evowow.com/?item=51133) | mark:normal:vanquisher=1 | 50855 | `[0,[],[[52025,1],[50855,1]]]` | 35498, 38316 |
| [51134](https://wotlk.evowow.com/?item=51134) | mark:normal:vanquisher=1 | 50857 | `[0,[],[[52025,1],[50857,1]]]` | 35498, 38316 |
| [51135](https://wotlk.evowow.com/?item=51135) | mark:normal:vanquisher=1 | 50113 | `[0,[],[[52025,1],[50113,1]]]` | 35497, 37992, 37999 |
| [51136](https://wotlk.evowow.com/?item=51136) | mark:normal:vanquisher=1 | 50109 | `[0,[],[[52025,1],[50109,1]]]` | 35497, 37992, 37999 |
| [51137](https://wotlk.evowow.com/?item=51137) | mark:normal:vanquisher=1 | 50108 | `[0,[],[[52025,1],[50108,1]]]` | 35497, 37992, 37999 |
| [51138](https://wotlk.evowow.com/?item=51138) | mark:normal:vanquisher=1 | 50107 | `[0,[],[[52025,1],[50107,1]]]` | 35497, 37992, 37999 |
| [51139](https://wotlk.evowow.com/?item=51139) | mark:normal:vanquisher=1 | 50106 | `[0,[],[[52025,1],[50106,1]]]` | 35497, 37992, 37999 |
| [51140](https://wotlk.evowow.com/?item=51140) | mark:normal:vanquisher=1 | 50824 | `[0,[],[[52025,1],[50824,1]]]` | 35497, 37992, 37999 |
| [51141](https://wotlk.evowow.com/?item=51141) | mark:normal:vanquisher=1 | 50828 | `[0,[],[[52025,1],[50828,1]]]` | 35497, 37992, 37999 |
| [51142](https://wotlk.evowow.com/?item=51142) | mark:normal:vanquisher=1 | 50825 | `[0,[],[[52025,1],[50825,1]]]` | 35497, 37992, 37999 |
| [51143](https://wotlk.evowow.com/?item=51143) | mark:normal:vanquisher=1 | 50826 | `[0,[],[[52025,1],[50826,1]]]` | 35497, 37992, 37999 |
| [51144](https://wotlk.evowow.com/?item=51144) | mark:normal:vanquisher=1 | 50827 | `[0,[],[[52025,1],[50827,1]]]` | 35497, 37992, 37999 |
| [51145](https://wotlk.evowow.com/?item=51145) | mark:normal:vanquisher=1 | 50823 | `[0,[],[[52025,1],[50823,1]]]` | 35497, 37992, 37999 |
| [51146](https://wotlk.evowow.com/?item=51146) | mark:normal:vanquisher=1 | 50820 | `[0,[],[[52025,1],[50820,1]]]` | 35497, 37992, 37999 |
| [51147](https://wotlk.evowow.com/?item=51147) | mark:normal:vanquisher=1 | 50819 | `[0,[],[[52025,1],[50819,1]]]` | 35497, 37992, 37999 |
| [51148](https://wotlk.evowow.com/?item=51148) | mark:normal:vanquisher=1 | 50822 | `[0,[],[[52025,1],[50822,1]]]` | 35497, 37992, 37999 |
| [51149](https://wotlk.evowow.com/?item=51149) | mark:normal:vanquisher=1 | 50821 | `[0,[],[[52025,1],[50821,1]]]` | 35497, 37992, 37999 |
| [51150](https://wotlk.evowow.com/?item=51150) | mark:normal:protector=1 | 50118 | `[0,[],[[52026,1],[50118,1]]]` | 35500, 37993, 37998 |
| [51151](https://wotlk.evowow.com/?item=51151) | mark:normal:protector=1 | 50117 | `[0,[],[[52026,1],[50117,1]]]` | 35500, 37993, 37998 |
| [51152](https://wotlk.evowow.com/?item=51152) | mark:normal:protector=1 | 50116 | `[0,[],[[52026,1],[50116,1]]]` | 35500, 37993, 37998 |
| [51153](https://wotlk.evowow.com/?item=51153) | mark:normal:protector=1 | 50115 | `[0,[],[[52026,1],[50115,1]]]` | 35500, 37993, 37998 |
| [51154](https://wotlk.evowow.com/?item=51154) | mark:normal:protector=1 | 50114 | `[0,[],[[52026,1],[50114,1]]]` | 35500, 37993, 37998 |
| [51155](https://wotlk.evowow.com/?item=51155) | mark:normal:vanquisher=1 | 50279 | `[0,[],[[52025,1],[50279,1]]]` | 35496, 38283, 38284 |
| [51156](https://wotlk.evowow.com/?item=51156) | mark:normal:vanquisher=1 | 50278 | `[0,[],[[52025,1],[50278,1]]]` | 35496, 38283, 38284 |
| [51157](https://wotlk.evowow.com/?item=51157) | mark:normal:vanquisher=1 | 50277 | `[0,[],[[52025,1],[50277,1]]]` | 35496, 38283, 38284 |
| [51158](https://wotlk.evowow.com/?item=51158) | mark:normal:vanquisher=1 | 50276 | `[0,[],[[52025,1],[50276,1]]]` | 35496, 38283, 38284 |
| [51159](https://wotlk.evowow.com/?item=51159) | mark:normal:vanquisher=1 | 50275 | `[0,[],[[52025,1],[50275,1]]]` | 35496, 38283, 38284 |
| [51160](https://wotlk.evowow.com/?item=51160) | mark:normal:conqueror=1 | 50324 | `[0,[],[[52027,1],[50324,1]]]` | 35498, 37696 |
| [51161](https://wotlk.evowow.com/?item=51161) | mark:normal:conqueror=1 | 50325 | `[0,[],[[52027,1],[50325,1]]]` | 35498, 37696 |
| [51162](https://wotlk.evowow.com/?item=51162) | mark:normal:conqueror=1 | 50326 | `[0,[],[[52027,1],[50326,1]]]` | 35498, 37696 |
| [51163](https://wotlk.evowow.com/?item=51163) | mark:normal:conqueror=1 | 50327 | `[0,[],[[52027,1],[50327,1]]]` | 35498, 37696 |
| [51164](https://wotlk.evowow.com/?item=51164) | mark:normal:conqueror=1 | 50328 | `[0,[],[[52027,1],[50328,1]]]` | 35498, 37696 |
| [51165](https://wotlk.evowow.com/?item=51165) | mark:normal:conqueror=1 | 50869 | `[0,[],[[52027,1],[50869,1]]]` | 35498, 37696 |
| [51166](https://wotlk.evowow.com/?item=51166) | mark:normal:conqueror=1 | 50865 | `[0,[],[[52027,1],[50865,1]]]` | 35498, 37696 |
| [51167](https://wotlk.evowow.com/?item=51167) | mark:normal:conqueror=1 | 50867 | `[0,[],[[52027,1],[50867,1]]]` | 35498, 37696 |
| [51168](https://wotlk.evowow.com/?item=51168) | mark:normal:conqueror=1 | 50866 | `[0,[],[[52027,1],[50866,1]]]` | 35498, 37696 |
| [51169](https://wotlk.evowow.com/?item=51169) | mark:normal:conqueror=1 | 50868 | `[0,[],[[52027,1],[50868,1]]]` | 35498, 37696 |
| [51170](https://wotlk.evowow.com/?item=51170) | mark:normal:conqueror=1 | 50860 | `[0,[],[[52027,1],[50860,1]]]` | 35498, 37696 |
| [51171](https://wotlk.evowow.com/?item=51171) | mark:normal:conqueror=1 | 50861 | `[0,[],[[52027,1],[50861,1]]]` | 35498, 37696 |
| [51172](https://wotlk.evowow.com/?item=51172) | mark:normal:conqueror=1 | 50863 | `[0,[],[[52027,1],[50863,1]]]` | 35498, 37696 |
| [51173](https://wotlk.evowow.com/?item=51173) | mark:normal:conqueror=1 | 50862 | `[0,[],[[52027,1],[50862,1]]]` | 35498, 37696 |
| [51174](https://wotlk.evowow.com/?item=51174) | mark:normal:conqueror=1 | 50864 | `[0,[],[[52027,1],[50864,1]]]` | 35498, 37696 |
| [51175](https://wotlk.evowow.com/?item=51175) | mark:normal:conqueror=1 | 50767 | `[0,[],[[52027,1],[50767,1]]]` | 35496, 38054 |
| [51176](https://wotlk.evowow.com/?item=51176) | mark:normal:conqueror=1 | 50768 | `[0,[],[[52027,1],[50768,1]]]` | 35496, 38054 |
| [51177](https://wotlk.evowow.com/?item=51177) | mark:normal:conqueror=1 | 50769 | `[0,[],[[52027,1],[50769,1]]]` | 35496, 38054 |
| [51178](https://wotlk.evowow.com/?item=51178) | mark:normal:conqueror=1 | 50765 | `[0,[],[[52027,1],[50765,1]]]` | 35496, 38054 |
| [51179](https://wotlk.evowow.com/?item=51179) | mark:normal:conqueror=1 | 50766 | `[0,[],[[52027,1],[50766,1]]]` | 35496, 38054 |
| [51180](https://wotlk.evowow.com/?item=51180) | mark:normal:conqueror=1 | 50394 | `[0,[],[[52027,1],[50394,1]]]` | 35496, 38054 |
| [51181](https://wotlk.evowow.com/?item=51181) | mark:normal:conqueror=1 | 50393 | `[0,[],[[52027,1],[50393,1]]]` | 35496, 38054 |
| [51182](https://wotlk.evowow.com/?item=51182) | mark:normal:conqueror=1 | 50396 | `[0,[],[[52027,1],[50396,1]]]` | 35496, 38054 |
| [51183](https://wotlk.evowow.com/?item=51183) | mark:normal:conqueror=1 | 50391 | `[0,[],[[52027,1],[50391,1]]]` | 35496, 38054 |
| [51184](https://wotlk.evowow.com/?item=51184) | mark:normal:conqueror=1 | 50392 | `[0,[],[[52027,1],[50392,1]]]` | 35496, 38054 |
| [51185](https://wotlk.evowow.com/?item=51185) | mark:normal:vanquisher=1 | 50105 | `[0,[],[[52025,1],[50105,1]]]` | 35497, 37991, 37997 |
| [51186](https://wotlk.evowow.com/?item=51186) | mark:normal:vanquisher=1 | 50090 | `[0,[],[[52025,1],[50090,1]]]` | 35497, 37991, 37997 |
| [51187](https://wotlk.evowow.com/?item=51187) | mark:normal:vanquisher=1 | 50089 | `[0,[],[[52025,1],[50089,1]]]` | 35497, 37991, 37997 |
| [51188](https://wotlk.evowow.com/?item=51188) | mark:normal:vanquisher=1 | 50088 | `[0,[],[[52025,1],[50088,1]]]` | 35497, 37991, 37997 |
| [51189](https://wotlk.evowow.com/?item=51189) | mark:normal:vanquisher=1 | 50087 | `[0,[],[[52025,1],[50087,1]]]` | 35497, 37991, 37997 |
| [51190](https://wotlk.evowow.com/?item=51190) | mark:normal:protector=1 | 50835 | `[0,[],[[52026,1],[50835,1]]]` | 35500, 38840, 38841 |
| [51191](https://wotlk.evowow.com/?item=51191) | mark:normal:protector=1 | 50836 | `[0,[],[[52026,1],[50836,1]]]` | 35500, 38840, 38841 |
| [51192](https://wotlk.evowow.com/?item=51192) | mark:normal:protector=1 | 50837 | `[0,[],[[52026,1],[50837,1]]]` | 35500, 38840, 38841 |
| [51193](https://wotlk.evowow.com/?item=51193) | mark:normal:protector=1 | 50838 | `[0,[],[[52026,1],[50838,1]]]` | 35500, 38840, 38841 |
| [51194](https://wotlk.evowow.com/?item=51194) | mark:normal:protector=1 | 50839 | `[0,[],[[52026,1],[50839,1]]]` | 35500, 38840, 38841 |
| [51195](https://wotlk.evowow.com/?item=51195) | mark:normal:protector=1 | 50830 | `[0,[],[[52026,1],[50830,1]]]` | 35500, 38840, 38841 |
| [51196](https://wotlk.evowow.com/?item=51196) | mark:normal:protector=1 | 50831 | `[0,[],[[52026,1],[50831,1]]]` | 35500, 38840, 38841 |
| [51197](https://wotlk.evowow.com/?item=51197) | mark:normal:protector=1 | 50832 | `[0,[],[[52026,1],[50832,1]]]` | 35500, 38840, 38841 |
| [51198](https://wotlk.evowow.com/?item=51198) | mark:normal:protector=1 | 50833 | `[0,[],[[52026,1],[50833,1]]]` | 35500, 38840, 38841 |
| [51199](https://wotlk.evowow.com/?item=51199) | mark:normal:protector=1 | 50834 | `[0,[],[[52026,1],[50834,1]]]` | 35500, 38840, 38841 |
| [51200](https://wotlk.evowow.com/?item=51200) | mark:normal:protector=1 | 50841 | `[0,[],[[52026,1],[50841,1]]]` | 35500, 38840, 38841 |
| [51201](https://wotlk.evowow.com/?item=51201) | mark:normal:protector=1 | 50842 | `[0,[],[[52026,1],[50842,1]]]` | 35500, 38840, 38841 |
| [51202](https://wotlk.evowow.com/?item=51202) | mark:normal:protector=1 | 50843 | `[0,[],[[52026,1],[50843,1]]]` | 35500, 38840, 38841 |
| [51203](https://wotlk.evowow.com/?item=51203) | mark:normal:protector=1 | 50844 | `[0,[],[[52026,1],[50844,1]]]` | 35500, 38840, 38841 |
| [51204](https://wotlk.evowow.com/?item=51204) | mark:normal:protector=1 | 50845 | `[0,[],[[52026,1],[50845,1]]]` | 35500, 38840, 38841 |
| [51205](https://wotlk.evowow.com/?item=51205) | mark:normal:conqueror=1 | 50244 | `[0,[],[[52027,1],[50244,1]]]` | 35496, 38181, 38182 |
| [51206](https://wotlk.evowow.com/?item=51206) | mark:normal:conqueror=1 | 50243 | `[0,[],[[52027,1],[50243,1]]]` | 35496, 38181, 38182 |
| [51207](https://wotlk.evowow.com/?item=51207) | mark:normal:conqueror=1 | 50242 | `[0,[],[[52027,1],[50242,1]]]` | 35496, 38181, 38182 |
| [51208](https://wotlk.evowow.com/?item=51208) | mark:normal:conqueror=1 | 50241 | `[0,[],[[52027,1],[50241,1]]]` | 35496, 38181, 38182 |
| [51209](https://wotlk.evowow.com/?item=51209) | mark:normal:conqueror=1 | 50240 | `[0,[],[[52027,1],[50240,1]]]` | 35496, 38181, 38182 |
| [51210](https://wotlk.evowow.com/?item=51210) | mark:normal:protector=1 | 50082 | `[0,[],[[52026,1],[50082,1]]]` | 35498, 37688 |
| [51211](https://wotlk.evowow.com/?item=51211) | mark:normal:protector=1 | 50081 | `[0,[],[[52026,1],[50081,1]]]` | 35498, 37688 |
| [51212](https://wotlk.evowow.com/?item=51212) | mark:normal:protector=1 | 50080 | `[0,[],[[52026,1],[50080,1]]]` | 35498, 37688 |
| [51213](https://wotlk.evowow.com/?item=51213) | mark:normal:protector=1 | 50079 | `[0,[],[[52026,1],[50079,1]]]` | 35498, 37688 |
| [51214](https://wotlk.evowow.com/?item=51214) | mark:normal:protector=1 | 50078 | `[0,[],[[52026,1],[50078,1]]]` | 35498, 37688 |
| [51215](https://wotlk.evowow.com/?item=51215) | mark:normal:protector=1 | 50846 | `[0,[],[[52026,1],[50846,1]]]` | 35498, 37688 |
| [51216](https://wotlk.evowow.com/?item=51216) | mark:normal:protector=1 | 50847 | `[0,[],[[52026,1],[50847,1]]]` | 35498, 37688 |
| [51217](https://wotlk.evowow.com/?item=51217) | mark:normal:protector=1 | 50849 | `[0,[],[[52026,1],[50849,1]]]` | 35498, 37688 |
| [51218](https://wotlk.evowow.com/?item=51218) | mark:normal:protector=1 | 50848 | `[0,[],[[52026,1],[50848,1]]]` | 35498, 37688 |
| [51219](https://wotlk.evowow.com/?item=51219) | mark:normal:protector=1 | 50850 | `[0,[],[[52026,1],[50850,1]]]` | 35498, 37688 |
| [51220](https://wotlk.evowow.com/?item=51220) | mark:heroic:protector=1 | 51219 | `[0,[],[[52029,1],[51219,1]]]` | 35498, 37688 |
| [51221](https://wotlk.evowow.com/?item=51221) | mark:heroic:protector=1 | 51218 | `[0,[],[[52029,1],[51218,1]]]` | 35498, 37688 |
| [51222](https://wotlk.evowow.com/?item=51222) | mark:heroic:protector=1 | 51217 | `[0,[],[[52029,1],[51217,1]]]` | 35498, 37688 |
| [51223](https://wotlk.evowow.com/?item=51223) | mark:heroic:protector=1 | 51216 | `[0,[],[[52029,1],[51216,1]]]` | 35498, 37688 |
| [51224](https://wotlk.evowow.com/?item=51224) | mark:heroic:protector=1 | 51215 | `[0,[],[[52029,1],[51215,1]]]` | 35498, 37688 |
| [51225](https://wotlk.evowow.com/?item=51225) | mark:heroic:protector=1 | 51214 | `[0,[],[[52029,1],[51214,1]]]` | 35498, 37688 |
| [51226](https://wotlk.evowow.com/?item=51226) | mark:heroic:protector=1 | 51213 | `[0,[],[[52029,1],[51213,1]]]` | 35498, 37688 |
| [51227](https://wotlk.evowow.com/?item=51227) | mark:heroic:protector=1 | 51212 | `[0,[],[[52029,1],[51212,1]]]` | 35498, 37688 |
| [51228](https://wotlk.evowow.com/?item=51228) | mark:heroic:protector=1 | 51211 | `[0,[],[[52029,1],[51211,1]]]` | 35498, 37688 |
| [51229](https://wotlk.evowow.com/?item=51229) | mark:heroic:protector=1 | 51210 | `[0,[],[[52029,1],[51210,1]]]` | 35498, 37688 |
| [51230](https://wotlk.evowow.com/?item=51230) | mark:heroic:conqueror=1 | 51209 | `[0,[],[[52030,1],[51209,1]]]` | 35496, 38181, 38182 |
| [51231](https://wotlk.evowow.com/?item=51231) | mark:heroic:conqueror=1 | 51208 | `[0,[],[[52030,1],[51208,1]]]` | 35496, 38181, 38182 |
| [51232](https://wotlk.evowow.com/?item=51232) | mark:heroic:conqueror=1 | 51207 | `[0,[],[[52030,1],[51207,1]]]` | 35496, 38181, 38182 |
| [51233](https://wotlk.evowow.com/?item=51233) | mark:heroic:conqueror=1 | 51206 | `[0,[],[[52030,1],[51206,1]]]` | 35496, 38181, 38182 |
| [51234](https://wotlk.evowow.com/?item=51234) | mark:heroic:conqueror=1 | 51205 | `[0,[],[[52030,1],[51205,1]]]` | 35496, 38181, 38182 |
| [51235](https://wotlk.evowow.com/?item=51235) | mark:heroic:protector=1 | 51204 | `[0,[],[[52029,1],[51204,1]]]` | 35500, 38840, 38841 |
| [51236](https://wotlk.evowow.com/?item=51236) | mark:heroic:protector=1 | 51203 | `[0,[],[[52029,1],[51203,1]]]` | 35500, 38840, 38841 |
| [51237](https://wotlk.evowow.com/?item=51237) | mark:heroic:protector=1 | 51202 | `[0,[],[[52029,1],[51202,1]]]` | 35500, 38840, 38841 |
| [51238](https://wotlk.evowow.com/?item=51238) | mark:heroic:protector=1 | 51201 | `[0,[],[[52029,1],[51201,1]]]` | 35500, 38840, 38841 |
| [51239](https://wotlk.evowow.com/?item=51239) | mark:heroic:protector=1 | 51200 | `[0,[],[[52029,1],[51200,1]]]` | 35500, 38840, 38841 |
| [51240](https://wotlk.evowow.com/?item=51240) | mark:heroic:protector=1 | 51199 | `[0,[],[[52029,1],[51199,1]]]` | 35500, 38840, 38841 |
| [51241](https://wotlk.evowow.com/?item=51241) | mark:heroic:protector=1 | 51198 | `[0,[],[[52029,1],[51198,1]]]` | 35500, 38840, 38841 |
| [51242](https://wotlk.evowow.com/?item=51242) | mark:heroic:protector=1 | 51197 | `[0,[],[[52029,1],[51197,1]]]` | 35500, 38840, 38841 |
| [51243](https://wotlk.evowow.com/?item=51243) | mark:heroic:protector=1 | 51196 | `[0,[],[[52029,1],[51196,1]]]` | 35500, 38840, 38841 |
| [51244](https://wotlk.evowow.com/?item=51244) | mark:heroic:protector=1 | 51195 | `[0,[],[[52029,1],[51195,1]]]` | 35500, 38840, 38841 |
| [51245](https://wotlk.evowow.com/?item=51245) | mark:heroic:protector=1 | 51194 | `[0,[],[[52029,1],[51194,1]]]` | 35500, 38840, 38841 |
| [51246](https://wotlk.evowow.com/?item=51246) | mark:heroic:protector=1 | 51193 | `[0,[],[[52029,1],[51193,1]]]` | 35500, 38840, 38841 |
| [51247](https://wotlk.evowow.com/?item=51247) | mark:heroic:protector=1 | 51192 | `[0,[],[[52029,1],[51192,1]]]` | 35500, 38840, 38841 |
| [51248](https://wotlk.evowow.com/?item=51248) | mark:heroic:protector=1 | 51191 | `[0,[],[[52029,1],[51191,1]]]` | 35500, 38840, 38841 |
| [51249](https://wotlk.evowow.com/?item=51249) | mark:heroic:protector=1 | 51190 | `[0,[],[[52029,1],[51190,1]]]` | 35500, 38840, 38841 |
| [51250](https://wotlk.evowow.com/?item=51250) | mark:heroic:vanquisher=1 | 51189 | `[0,[],[[52028,1],[51189,1]]]` | 35497, 37991, 37997 |
| [51251](https://wotlk.evowow.com/?item=51251) | mark:heroic:vanquisher=1 | 51188 | `[0,[],[[52028,1],[51188,1]]]` | 35497, 37991, 37997 |
| [51252](https://wotlk.evowow.com/?item=51252) | mark:heroic:vanquisher=1 | 51187 | `[0,[],[[52028,1],[51187,1]]]` | 35497, 37991, 37997 |
| [51253](https://wotlk.evowow.com/?item=51253) | mark:heroic:vanquisher=1 | 51186 | `[0,[],[[52028,1],[51186,1]]]` | 35497, 37991, 37997 |
| [51254](https://wotlk.evowow.com/?item=51254) | mark:heroic:vanquisher=1 | 51185 | `[0,[],[[52028,1],[51185,1]]]` | 35497, 37991, 37997 |
| [51255](https://wotlk.evowow.com/?item=51255) | mark:heroic:conqueror=1 | 51184 | `[0,[],[[52030,1],[51184,1]]]` | 35496, 38054 |
| [51256](https://wotlk.evowow.com/?item=51256) | mark:heroic:conqueror=1 | 51183 | `[0,[],[[52030,1],[51183,1]]]` | 35496, 38054 |
| [51257](https://wotlk.evowow.com/?item=51257) | mark:heroic:conqueror=1 | 51182 | `[0,[],[[52030,1],[51182,1]]]` | 35496, 38054 |
| [51258](https://wotlk.evowow.com/?item=51258) | mark:heroic:conqueror=1 | 51181 | `[0,[],[[52030,1],[51181,1]]]` | 35496, 38054 |
| [51259](https://wotlk.evowow.com/?item=51259) | mark:heroic:conqueror=1 | 51180 | `[0,[],[[52030,1],[51180,1]]]` | 35496, 38054 |
| [51260](https://wotlk.evowow.com/?item=51260) | mark:heroic:conqueror=1 | 51179 | `[0,[],[[52030,1],[51179,1]]]` | 35496, 38054 |
| [51261](https://wotlk.evowow.com/?item=51261) | mark:heroic:conqueror=1 | 51178 | `[0,[],[[52030,1],[51178,1]]]` | 35496, 38054 |
| [51262](https://wotlk.evowow.com/?item=51262) | mark:heroic:conqueror=1 | 51177 | `[0,[],[[52030,1],[51177,1]]]` | 35496, 38054 |
| [51263](https://wotlk.evowow.com/?item=51263) | mark:heroic:conqueror=1 | 51176 | `[0,[],[[52030,1],[51176,1]]]` | 35496, 38054 |
| [51264](https://wotlk.evowow.com/?item=51264) | mark:heroic:conqueror=1 | 51175 | `[0,[],[[52030,1],[51175,1]]]` | 35496, 38054 |
| [51265](https://wotlk.evowow.com/?item=51265) | mark:heroic:conqueror=1 | 51174 | `[0,[],[[52030,1],[51174,1]]]` | 35498, 37696 |
| [51266](https://wotlk.evowow.com/?item=51266) | mark:heroic:conqueror=1 | 51173 | `[0,[],[[52030,1],[51173,1]]]` | 35498, 37696 |
| [51267](https://wotlk.evowow.com/?item=51267) | mark:heroic:conqueror=1 | 51172 | `[0,[],[[52030,1],[51172,1]]]` | 35498, 37696 |
| [51268](https://wotlk.evowow.com/?item=51268) | mark:heroic:conqueror=1 | 51171 | `[0,[],[[52030,1],[51171,1]]]` | 35498, 37696 |
| [51269](https://wotlk.evowow.com/?item=51269) | mark:heroic:conqueror=1 | 51170 | `[0,[],[[52030,1],[51170,1]]]` | 35498, 37696 |
| [51270](https://wotlk.evowow.com/?item=51270) | mark:heroic:conqueror=1 | 51169 | `[0,[],[[52030,1],[51169,1]]]` | 35498, 37696 |
| [51271](https://wotlk.evowow.com/?item=51271) | mark:heroic:conqueror=1 | 51168 | `[0,[],[[52030,1],[51168,1]]]` | 35498, 37696 |
| [51272](https://wotlk.evowow.com/?item=51272) | mark:heroic:conqueror=1 | 51167 | `[0,[],[[52030,1],[51167,1]]]` | 35498, 37696 |
| [51273](https://wotlk.evowow.com/?item=51273) | mark:heroic:conqueror=1 | 51166 | `[0,[],[[52030,1],[51166,1]]]` | 35498, 37696 |
| [51274](https://wotlk.evowow.com/?item=51274) | mark:heroic:conqueror=1 | 51165 | `[0,[],[[52030,1],[51165,1]]]` | 35498, 37696 |
| [51275](https://wotlk.evowow.com/?item=51275) | mark:heroic:conqueror=1 | 51164 | `[0,[],[[52030,1],[51164,1]]]` | 35498, 37696 |
| [51276](https://wotlk.evowow.com/?item=51276) | mark:heroic:conqueror=1 | 51163 | `[0,[],[[52030,1],[51163,1]]]` | 35498, 37696 |
| [51277](https://wotlk.evowow.com/?item=51277) | mark:heroic:conqueror=1 | 51162 | `[0,[],[[52030,1],[51162,1]]]` | 35498, 37696 |
| [51278](https://wotlk.evowow.com/?item=51278) | mark:heroic:conqueror=1 | 51161 | `[0,[],[[52030,1],[51161,1]]]` | 35498, 37696 |
| [51279](https://wotlk.evowow.com/?item=51279) | mark:heroic:conqueror=1 | 51160 | `[0,[],[[52030,1],[51160,1]]]` | 35498, 37696 |
| [51280](https://wotlk.evowow.com/?item=51280) | mark:heroic:vanquisher=1 | 51159 | `[0,[],[[52028,1],[51159,1]]]` | 35496, 38283, 38284 |
| [51281](https://wotlk.evowow.com/?item=51281) | mark:heroic:vanquisher=1 | 51158 | `[0,[],[[52028,1],[51158,1]]]` | 35496, 38283, 38284 |
| [51282](https://wotlk.evowow.com/?item=51282) | mark:heroic:vanquisher=1 | 51157 | `[0,[],[[52028,1],[51157,1]]]` | 35496, 38283, 38284 |
| [51283](https://wotlk.evowow.com/?item=51283) | mark:heroic:vanquisher=1 | 51156 | `[0,[],[[52028,1],[51156,1]]]` | 35496, 38283, 38284 |
| [51284](https://wotlk.evowow.com/?item=51284) | mark:heroic:vanquisher=1 | 51155 | `[0,[],[[52028,1],[51155,1]]]` | 35496, 38283, 38284 |
| [51285](https://wotlk.evowow.com/?item=51285) | mark:heroic:protector=1 | 51154 | `[0,[],[[52029,1],[51154,1]]]` | 35500, 37993, 37998 |
| [51286](https://wotlk.evowow.com/?item=51286) | mark:heroic:protector=1 | 51153 | `[0,[],[[52029,1],[51153,1]]]` | 35500, 37993, 37998 |
| [51287](https://wotlk.evowow.com/?item=51287) | mark:heroic:protector=1 | 51152 | `[0,[],[[52029,1],[51152,1]]]` | 35500, 37993, 37998 |
| [51288](https://wotlk.evowow.com/?item=51288) | mark:heroic:protector=1 | 51151 | `[0,[],[[52029,1],[51151,1]]]` | 35500, 37993, 37998 |
| [51289](https://wotlk.evowow.com/?item=51289) | mark:heroic:protector=1 | 51150 | `[0,[],[[52029,1],[51150,1]]]` | 35500, 37993, 37998 |
| [51290](https://wotlk.evowow.com/?item=51290) | mark:heroic:vanquisher=1 | 51149 | `[0,[],[[52028,1],[51149,1]]]` | 35497, 37992, 37999 |
| [51291](https://wotlk.evowow.com/?item=51291) | mark:heroic:vanquisher=1 | 51148 | `[0,[],[[52028,1],[51148,1]]]` | 35497, 37992, 37999 |
| [51292](https://wotlk.evowow.com/?item=51292) | mark:heroic:vanquisher=1 | 51147 | `[0,[],[[52028,1],[51147,1]]]` | 35497, 37992, 37999 |
| [51293](https://wotlk.evowow.com/?item=51293) | mark:heroic:vanquisher=1 | 51146 | `[0,[],[[52028,1],[51146,1]]]` | 35497, 37992, 37999 |
| [51294](https://wotlk.evowow.com/?item=51294) | mark:heroic:vanquisher=1 | 51145 | `[0,[],[[52028,1],[51145,1]]]` | 35497, 37992, 37999 |
| [51295](https://wotlk.evowow.com/?item=51295) | mark:heroic:vanquisher=1 | 51144 | `[0,[],[[52028,1],[51144,1]]]` | 35497, 37992, 37999 |
| [51296](https://wotlk.evowow.com/?item=51296) | mark:heroic:vanquisher=1 | 51143 | `[0,[],[[52028,1],[51143,1]]]` | 35497, 37992, 37999 |
| [51297](https://wotlk.evowow.com/?item=51297) | mark:heroic:vanquisher=1 | 51142 | `[0,[],[[52028,1],[51142,1]]]` | 35497, 37992, 37999 |
| [51298](https://wotlk.evowow.com/?item=51298) | mark:heroic:vanquisher=1 | 51141 | `[0,[],[[52028,1],[51141,1]]]` | 35497, 37992, 37999 |
| [51299](https://wotlk.evowow.com/?item=51299) | mark:heroic:vanquisher=1 | 51140 | `[0,[],[[52028,1],[51140,1]]]` | 35497, 37992, 37999 |
| [51300](https://wotlk.evowow.com/?item=51300) | mark:heroic:vanquisher=1 | 51139 | `[0,[],[[52028,1],[51139,1]]]` | 35497, 37992, 37999 |
| [51301](https://wotlk.evowow.com/?item=51301) | mark:heroic:vanquisher=1 | 51138 | `[0,[],[[52028,1],[51138,1]]]` | 35497, 37992, 37999 |
| [51302](https://wotlk.evowow.com/?item=51302) | mark:heroic:vanquisher=1 | 51137 | `[0,[],[[52028,1],[51137,1]]]` | 35497, 37992, 37999 |
| [51303](https://wotlk.evowow.com/?item=51303) | mark:heroic:vanquisher=1 | 51136 | `[0,[],[[52028,1],[51136,1]]]` | 35497, 37992, 37999 |
| [51304](https://wotlk.evowow.com/?item=51304) | mark:heroic:vanquisher=1 | 51135 | `[0,[],[[52028,1],[51135,1]]]` | 35497, 37992, 37999 |
| [51305](https://wotlk.evowow.com/?item=51305) | mark:heroic:vanquisher=1 | 51134 | `[0,[],[[52028,1],[51134,1]]]` | 35498, 38316 |
| [51306](https://wotlk.evowow.com/?item=51306) | mark:heroic:vanquisher=1 | 51133 | `[0,[],[[52028,1],[51133,1]]]` | 35498, 38316 |
| [51307](https://wotlk.evowow.com/?item=51307) | mark:heroic:vanquisher=1 | 51132 | `[0,[],[[52028,1],[51132,1]]]` | 35498, 38316 |
| [51308](https://wotlk.evowow.com/?item=51308) | mark:heroic:vanquisher=1 | 51131 | `[0,[],[[52028,1],[51131,1]]]` | 35498, 38316 |
| [51309](https://wotlk.evowow.com/?item=51309) | mark:heroic:vanquisher=1 | 51130 | `[0,[],[[52028,1],[51130,1]]]` | 35498, 38316 |
| [51310](https://wotlk.evowow.com/?item=51310) | mark:heroic:vanquisher=1 | 51129 | `[0,[],[[52028,1],[51129,1]]]` | 35498, 38316 |
| [51311](https://wotlk.evowow.com/?item=51311) | mark:heroic:vanquisher=1 | 51128 | `[0,[],[[52028,1],[51128,1]]]` | 35498, 38316 |
| [51312](https://wotlk.evowow.com/?item=51312) | mark:heroic:vanquisher=1 | 51127 | `[0,[],[[52028,1],[51127,1]]]` | 35498, 38316 |
| [51313](https://wotlk.evowow.com/?item=51313) | mark:heroic:vanquisher=1 | 51126 | `[0,[],[[52028,1],[51126,1]]]` | 35498, 38316 |
| [51314](https://wotlk.evowow.com/?item=51314) | mark:heroic:vanquisher=1 | 51125 | `[0,[],[[52028,1],[51125,1]]]` | 35498, 38316 |

## Unsupported duplicate IDs excluded

A cross-check of native set IDs against the already pinned [AzerothCore item template](https://github.com/azerothcore/azerothcore-wotlk/blob/db533ad7537a0641d076b13e5611f29f33558d06/data/sql/base/db_world/item_template.sql) identified these 285 additional records in the same sets (190 T9, 95 T10). None exists in the app's pinned catalog. They are excluded rather than assigned inferred purchase recipes. This is a catalog-support exclusion, not a claim about whether a live vendor sells them. Source and exclusion check date: **2026-09-12**; no vendor-price verification is claimed for excluded IDs.

| Tier | Native set ID | Excluded IDs |
| --- | --- | --- |
| 9 | 843 | 48725, 48726, 48727, 48728, 48729 |
| 9 | 844 | 48730, 48731, 48732, 48733, 48734 |
| 9 | 845 | 48735, 48736, 48737, 48738, 48739 |
| 9 | 846 | 48740, 48741, 48742, 48743, 48744 |
| 9 | 847 | 48745, 48746, 48747, 48748, 48749 |
| 9 | 848 | 48750, 48751, 48752, 48753, 48754 |
| 9 | 849 | 48755, 48756, 48757, 48758, 48759 |
| 9 | 850 | 48760, 48761, 48762, 48763, 48764 |
| 9 | 851 | 48774, 48775, 48776, 48777, 48778 |
| 9 | 852 | 48769, 48770, 48771, 48772, 48773 |
| 9 | 853 | 48786, 48787, 48788, 48789, 48790 |
| 9 | 854 | 48781, 48782, 48783, 48784, 48785 |
| 9 | 855 | 48799, 48800, 48801, 48802, 48803 |
| 9 | 856 | 48794, 48795, 48796, 48797, 48798 |
| 9 | 857 | 48809, 48810, 48811, 48812, 48813 |
| 9 | 858 | 48804, 48805, 48806, 48807, 48808 |
| 9 | 859 | 48819, 48820, 48821, 48822, 48823 |
| 9 | 860 | 48814, 48815, 48816, 48817, 48818 |
| 9 | 861 | 48824, 48825, 48826, 48827, 48828 |
| 9 | 862 | 48829, 48830, 48831, 48832, 48833 |
| 9 | 863 | 48841, 48842, 48843, 48844, 48845 |
| 9 | 864 | 48836, 48837, 48838, 48839, 48840 |
| 9 | 865 | 48846, 48847, 48848, 48849, 48850 |
| 9 | 866 | 48851, 48852, 48853, 48854, 48855 |
| 9 | 867 | 48865, 48866, 48867, 48868, 48869 |
| 9 | 868 | 48860, 48861, 48862, 48863, 48864 |
| 9 | 869 | 48875, 48876, 48877, 48878, 48879 |
| 9 | 870 | 48870, 48871, 48872, 48873, 48874 |
| 9 | 871 | 48885, 48886, 48887, 48888, 48889 |
| 9 | 872 | 48880, 48881, 48882, 48883, 48884 |
| 9 | 873 | 48895, 48896, 48897, 48898, 48899 |
| 9 | 874 | 48890, 48891, 48892, 48893, 48894 |
| 9 | 875 | 48900, 48901, 48902, 48903, 48904 |
| 9 | 876 | 48905, 48906, 48907, 48908, 48909 |
| 9 | 877 | 48915, 48916, 48917, 48918, 48919 |
| 9 | 878 | 48910, 48911, 48912, 48913, 48914 |
| 9 | 879 | 48927, 48928, 48929, 48930, 48931 |
| 9 | 880 | 48922, 48923, 48924, 48925, 48926 |
| 10 | 883 | 51712, 51713, 51714, 51715, 51716 |
| 10 | 884 | 51762, 51763, 51764, 51765, 51766 |
| 10 | 885 | 51732, 51733, 51734, 51735, 51736 |
| 10 | 886 | 51737, 51738, 51739, 51740, 51741 |
| 10 | 887 | 51692, 51693, 51694, 51695, 51696 |
| 10 | 888 | 51702, 51703, 51704, 51705, 51706 |
| 10 | 889 | 51697, 51698, 51699, 51700, 51701 |
| 10 | 890 | 51742, 51743, 51744, 51745, 51746 |
| 10 | 891 | 51707, 51708, 51709, 51710, 51711 |
| 10 | 892 | 51747, 51748, 51749, 51750, 51751 |
| 10 | 893 | 51757, 51758, 51759, 51760, 51761 |
| 10 | 894 | 51752, 51753, 51754, 51755, 51756 |
| 10 | 895 | 51767, 51768, 51769, 51770, 51771 |
| 10 | 896 | 51772, 51773, 51774, 51775, 51776 |
| 10 | 897 | 51682, 51683, 51684, 51685, 51686 |
| 10 | 898 | 51687, 51688, 51689, 51690, 51691 |
| 10 | 899 | 51722, 51723, 51724, 51725, 51726 |
| 10 | 900 | 51717, 51718, 51719, 51720, 51721 |
| 10 | 901 | 51727, 51728, 51729, 51730, 51731 |
