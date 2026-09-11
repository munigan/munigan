# Feature background artwork

Generated with the built-in image generation tool on 2026-09-11. Final assets: `public/images/backgrounds/`, with 960px and 1672px AVIF/WebP variants. Source PNGs preserved locally under `.cache/background-sources/` and not shipped. One representative race per specialization rather than exact imported race matching. Phase/rotation variants share artwork.

## Prompt template

16:9 dark cinematic painterly World of Warcraft Wrath of the Lich King website background. Character in rightmost third; recognizable head inside frame. Left 60% quiet charcoal fog and sparse environment, leaving negative space for content. Muted colors, restrained class-specific lighting, atmospheric depth, dark bottom fade. No text, logos, UI or collage. Content remains in front of decorative artwork; mobile uses a right-biased crop and lower opacity.

## Naxxramas fallback prompt

Naxxramas plague quarter, broad quiet surfaces, gothic arches far right, subtle green slime near the app action green (#78E34D), dim reflections on wet stone. Left 60% charcoal negative space; sparse environment, no characters, soft depth, bottom fade. Used until the visible character's specialization is known, and on general pages.

## Character scene prompts

- **druid-balance:** A Tauren balance druid in recognizable moonkin form, antlered owl-bear silhouette, muted moonlight in ancient Crystalsong woodland.
- **druid-feral:** A Night Elf feral druid transformed into a violet-gray saber cat with long ears, quiet snowy pine forest of Northrend.
- **shaman-elemental:** A Draenei elemental shaman, blue skin and curved horns, mail armor, very restrained lightning between hands, weathered storm shrine in Storm Peaks.
- **shaman-enhancement:** An Orc enhancement shaman with two small axes and faint wind enchantment, stone totems in a windswept Northrend pass.
- **hunter-beast-mastery:** An Orc beast mastery hunter with a large wolf companion, rugged leather and mail, misty Grizzly Hills forest.
- **hunter-marksmanship:** A Night Elf marksmanship hunter holding a longbow lowered at rest, weathered ranger mail, snowy Dragonblight forest.
- **hunter-survival:** A Dwarf survival hunter with a crossbow and subtle trap beside boots, fur-lined mail, rugged snowy Northrend mountain trail.
- **mage-arcane:** A Blood Elf arcane mage in ornate muted violet robes, tiny arcane motes around one hand, ancient Dalaran stone terrace.
- **mage-fire:** A Human fire mage in weathered crimson robes holding a small ember, dark scorched stone in Wyrmrest's Ruby Sanctum.
- **mage-frost:** A Gnome frost mage with recognizable short proportions in blue robes, faint ice crystals around hand, cold Icecrown ruins.
- **mage-frostfire:** A Human frostfire mage in dark robes, restrained intertwined blue ice and amber ember in hand, frozen scorched stone ruins.
- **rogue-assassination:** An Undead assassination rogue in worn leather with two daggers bearing faint green poison, deserted Naxxramas plague corridor.
- **rogue-combat:** A Human combat rogue with paired curved swords and practical leather armor, ruined Northrend harbor in fog.
- **rogue-subtlety:** A Night Elf subtlety rogue in dark leather and hood, paired daggers lowered, long ears visible, deep violet shadow in Dalaran underbelly.
- **paladin-retribution:** A Blood Elf retribution paladin with a two-handed greatsword, muted gold plate armor, faint holy rim light near Argent Crusade stone chapel.
- **priest-shadow:** An Undead shadow priest with softly translucent violet shadowform, hooded robes, abandoned Icecrown cathedral.
- **priest-smite:** A Human priest in ivory and muted gold robes with a staff, small holy light in hand, solemn Argent Crusade chapel.
- **warlock-affliction:** An Undead affliction warlock, ragged dark robes and restrained sickly green curse wisps, plague-ridden Naxxramas stonework.
- **warlock-demonology:** An Orc demonology warlock in dark robes, looming but faint felguard companion silhouette, quiet fel-scarred Northrend ruins.
- **warlock-destruction:** A Blood Elf destruction warlock in dark crimson robes, small fel-green and amber flame in hand, scorched gothic stone corridor.
- **warrior-arms:** An Orc arms warrior with a single large two-handed axe, heavy weathered plate, solemn snowy Argent Tournament training ground.
- **warrior-fury:** An Orc fury warrior with two heavy axes, weathered plate armor, quiet frost-covered Northrend battlefield.
- **deathknight-blood:** A Human blood death knight in dark runic plate with one two-handed sword, subtle crimson rune glow, Icecrown blood hall.
- **deathknight-frost:** A Human frost death knight with pale skin and blue eyes, dark heavy runic plate and paired swords, icy Icecrown fortress.
- **deathknight-unholy:** An Orc unholy death knight with two-handed runeblade and dim green runes, heavy black plate, Naxxramas plague quarter.

## Delivery

AVIF quality 48, effort 6; WebP quality 73, effort 6. No upscaling or embedded metadata. The native picture element requests one responsive asset for the current theme. Import preview, equipment selection, and reports register the visible spec with the shared shell; unmounting or leaving that route returns to Naxxramas. Unknown specs also use Naxxramas.

