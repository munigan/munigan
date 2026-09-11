# Warmane armory import research

## Implemented integration

- Third import mode alongside addon export and simulator profile, translated into English and Brazilian Portuguese, with the existing review/preset/optional-bag flow.
- `GET /api/import/warmane?name=...&realm=...` validates bounded character names and allowlisted realms, then fetches one profile from the fixed Warmane HTTPS host. No public third-party proxy, credentials or simulation submission is involved. Requests time out after 12 seconds, reject redirects and cap response bodies at 512 KB. Responses are not cached.
- Cheerio parses HTML only on the server. Only normalized character JSON is returned. Complete slot-container validation prevents missing slots from shifting gear; unknown gem IDs fail visibly rather than becoming empty sockets.
- Primary profession ranks below 450 are preserved. Warmane can publish racial bonuses above 450 (verified Jewelcrafting 455/455 on Shamaj/Blackrock); supported racial skill ceilings are normalized to the simulator's 450 maximum. Secondary professions are excluded.
- Talents/glyphs are intentionally absent, matching the automatic Poli93 importer. Review identifies their source as the selected preset and the form/instructions explain the limitation.
- Live verification imported Barbarius/Icecrown through review into equipment selection with 16 equipped items, preserving head item 51227, enchant 3817 and gems `[41398, 40117, 0]`. Shamaj/Blackrock verified racial profession rank handling. No simulation was submitted.
- `data/wotlk/warmane-gem-ids.json` contains all 617 deployed mappings, extracted from the source map below. SHA-256: `6922284fc1ed8913bb19dea274ca87e0966e2ceeab1b443afb178b89329079f6`; original `warmane_gems.ts` SHA-256: `8b15b2e34ec85d094254e68ee1db49f860ee54535547c5a8342ad9b15356db81`. Upstream MIT attribution is retained in `public/licenses/Poli93-wotlk.txt`.

Verified 2026-09-10 against the [deployed Poli93 simulator](https://poli93.github.io/wotlk/deathknight/). The current GitHub `master` importer lacks Warmane code; the deployed JavaScript source map includes it. Treat the deployed source as the reference, rather than changing the pinned simulator checkout.

## Primary source and retrieval

The deployed entry imports `preset_utils-5d1119f5.chunk.js`. Its [source map](https://poli93.github.io/wotlk/bundle/preset_utils-5d1119f5.chunk.js.map) contains `sourcesContent` for `../../../ui/core/components/importers.ts` (index 25) and `../../../ui/core/constants/warmane_gems.ts` (index 24). Extracted research copies are `/tmp/warmane-importers.ts` and `/tmp/warmane-warmane_gems.ts`; these are temporary, not repository dependencies. The mapping has **617 distinct entries**, not merely the WotLK epic gems. It describes its provenance as `SpellItemEnchantment.dbc`, build 12340, mapping nonzero `Src_ItemID` by enchantment `ID`.

Active deployed classes are `IndividualWarmaneImporter` (source lines 657–865) and the final `IndividualWarmaneAutoImporter` (lines 1303–1606; despite its name this is the manual HTML importer). Two earlier variants are commented out. Automatic import uses:

`https://idansim.tjyeee.workers.dev/?character={encodedName}&server={encodedRealm}&page=profile`

The realm list is **Onyxia, Icecrown, Lordaeron, Blackrock**. The worker is a CORS proxy. Its implementation was not located or inspected. The active automatic importer requests only the profile to reduce rate limiting; it deliberately leaves talents and glyphs untouched. The manual importer accepts separately copied profile and talents HTML. These behaviors are present in the [deployed bundle](https://poli93.github.io/wotlk/bundle/preset_utils-5d1119f5.chunk.js) and its source map.

## Profile schema

The armory profile endpoint is `https://armory.warmane.com/character/{name}/{realm}/profile`. Direct server-side retrieval succeeded for [Barbarius on Icecrown](https://armory.warmane.com/character/Barbarius/Icecrown/profile); downloaded HTML was saved as `/tmp/warmane-profile.html`.

- Character identity is displayed in `.information-left .name` and `.level-race-class`, e.g. `Level 80 Orc Warrior, Icecrown`.
- Equipment links are `a[rel^="item="]`. Their `rel` contains `item={itemId}`, optional `ench={enchantmentEffectId}`, and `gems={enchantmentId}:{enchantmentId}:...`. Enchants pass through unchanged; each gem enchantment ID must be converted to its **item ID** using the 617-entry map. Retain zeros in their original socket positions.
- Slot identity comes from the link’s closest `.item-slot` and that element’s index among its parent’s children. `.item-left` indices 0–7 map to head, neck, shoulder, back, chest, ignored shirt, ignored tabard, wrist. `.item-right` indices 0–7 map to hands, waist, legs, feet, finger1, finger2, trinket1, trinket2. `.item-bottom` indices 0–2 map to main hand, off hand, ranged.
- Simulator equipment indices are 0–16 in this order: head, neck, shoulder, back, chest, wrist, hands, waist, legs, feet, finger1, finger2, trinket1, trinket2, main hand, off hand, ranged. See [common.proto](https://github.com/Poli93/wotlk/blob/master/proto/common.proto).
- Race names are matched from `.level-race-class`; spaces are removed before simulator enum conversion. The upstream importer assumes the currently open simulator class; a generic importer should validate and select the actual character class.
- Professions are `.profskills .stub .text`; the nested `.value` contains `current/max`. Remove `.value` to obtain the name. Both active deployed importers keep recognized professions at skill **350 or higher**, maximum two. The 400 threshold appears only in an obsolete commented implementation.

## Talents and glyphs

The separate endpoint is `https://armory.warmane.com/character/{name}/{realm}/talents`. Direct retrieval succeeded for [Barbarius](https://armory.warmane.com/character/Barbarius/Icecrown/talents), saved as `/tmp/warmane-talents.html`.

1. Find `td.selected[data-spec]` for the active spec ID, currently `0` for this fixture. Its linked text supplies the specialization label (`Arms`).
2. Within `#spec-{id}`, traverse `.talent-frame` trees and each tree’s `.talent-points` in DOM order. Take the first character of each points string (`3/5` → `3`), concatenate, trim trailing zeroes per tree, and join the three trees with `-`.
3. Within `div[data-glyphs="{id}"]`, read `.glyph.major a` and `.glyph.minor a`; extract `spell={id}` from each `href`. Convert spell IDs using the simulator database `glyphIds` rows `{itemId, spellId}`. The pinned database already contains 348 mappings; lookup semantics are [database.ts](https://github.com/Poli93/wotlk/blob/master/ui/core/proto_utils/database.ts).

Verified fixture output: talents `0320332023335100202212013231251-30502013-`; major glyph item IDs `[43421, 43416, 43423]`; minor glyph item IDs `[43396, 43395, 43397]`.

## Integration caveats

- Do not use `/api/character/{name}/{realm}/summary` for full equipment import: it lacks gem, enchant, and full talent data. The deployed source contains a disabled fallback documenting those omissions.
- The current automatic gem parser preserves empty socket positions; the manual parser filters zero IDs first, which can shift gems. Follow the automatic behavior.
- Unknown gem mappings become `0` upstream, with a console warning. Surface incomplete data instead of silently describing the result as complete.
- The manual source allocates 19 item entries although the simulator uses 17 equipment slots; produce the correct 17-slot representation.
- Warmane returns HTML and may rate limit or serve anti-bot/error pages. A 200 response or long body alone is insufficient proof of a valid character. Validate identity, character class, recognized equipment containers, and required talent data.
- For this application, a same-origin server route can fetch the fixed Warmane host directly, avoiding reliance on the unrelated public proxy. Fetching talents is an additional request; preserve a recoverable partial result or actionable retry if it fails. This is an integration recommendation, not a guarantee provided by Warmane.
