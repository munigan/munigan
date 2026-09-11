# Character stat caps

Implemented 2026-09-09 in `src/domain/equipment/character-stats.ts`, shared by
report presentation and build recommendations.

## Build recommendations

Recommend the highest-DPS eligible build tied to the top result under the existing
simulation uncertainty check that meets every applicable hit/expertise cap. The
same cap calculation powers the dialog and row percentages, including conditional
bonuses, target level, and weapon racials. Missing or non-finite relevant stats
cannot qualify. Equal DPS falls back to fewer swaps, then a stable result ID.

Evaluate all results before pagination, including historical reports on read;
stored simulations remain unchanged. Pin the recommended row for default selection
on every page. Explicit user selection takes precedence. If no build qualifies,
omit the recommendation and default to highest DPS.

The dialog compares the selected combination's simulator `finalStats`, not its
raw item ratings. It shows green at/above the relevant cap and red below it,
with the difference in rating points. Display rounding never labels a fractional
shortfall “0 below”. A green melee special-attack cap does not imply that dual-wield
white attacks cannot miss; their higher cap is labeled separately.

## References

Wrath guide cross-checks (accessed 2026-09-09):

- [Frost Death Knight](https://wowtbc.gg/wotlk/class-guides/frost-death-knight/): Nerves of Cold Steel, Tundra Stalker and weapon racials.
- [Fury Warrior](https://wowtbc.gg/wotlk/class-guides/fury-warrior/): Precision, Heroic Presence and racial expertise.
- [Combat Rogue](https://wowtbc.gg/wotlk/class-guides/combat-rogue/): poison hit and Weapon Expertise.
- [Enhancement Shaman](https://wowtbc.gg/wotlk/class-guides/enhancement-shaman/): spell hit, Unleashed Rage and Orc weapons.
- [Elemental Shaman](https://wowtbc.gg/wotlk/class-guides/elemental-shaman/): Elemental Precision.
- [Arcane Mage](https://wowtbc.gg/wotlk/class-guides/arcane-mage/): Arcane Focus and Precision.
- [Fire Mage](https://wowtbc.gg/wotlk/class-guides/fire-mage/): distinct Fire/Frostfire builds.
- [Shadow Priest](https://wowtbc.gg/wotlk/class-guides/shadow-priest/): Shadow Focus and Misery.
- [Balance Druid](https://wowtbc.gg/wotlk/class-guides/balance-druid/): Balance of Power and Improved Faerie Fire.
- [Marksmanship Hunter](https://wowtbc.gg/wotlk/class-guides/marksmanship-hunter/): Focused Aim and ranged hit.
- [Feral Druid](https://wowtbc.gg/wotlk/class-guides/feral-dps-druid/): melee hit and expertise.
- [Retribution Paladin](https://wowtbc.gg/wotlk/class-guides/retribution-paladin/): Seal of Vengeance glyph.
- [Affliction Warlock](https://wowtbc.gg/wotlk/class-guides/affliction-warlock/): Suppression.

The authoritative conversion and inclusion rules come from the locally pinned
WoWSims engine (`.cache/wotlk/sim`), the same engine producing these reports:

- `core/base_stats_auto_gen.go`: level-80 rating conversions.
- `core/constants.go`, `core/unit.go`: Armor Penetration is rating / 13.99,
  clamped to 0–100%. This is penetration from rating, not total armor removed
  by armor debuffs, weapon-specific effects, or temporary procs.
- `core/target.go`: level 80–83 miss/dodge/parry tables; level 83 is 8% melee
  specials, 17% spells, and 26 expertise for dodge. Front-facing reports use
  the parry cap (56 at level 83). Missing target level defaults to 83.
- `core/buffs.go`, `core/character.go`: Heroic Presence, including a Draenei's
  own presence, is already included in `finalStats`; do not add it twice.
- Class talent files: Precision, Focused Aim, Nerves of Cold Steel,
  Suppression, Balance of Power, Tundra Stalker, Rage of Rivendare,
  Weapon Expertise, Primal Precision, Unleashed Rage, etc. already modify
  the returned stats. The selected loadout determines conditional bonuses.
- `core/racials.go`: Human sword/mace +3 expertise; Dwarf mace +5; Orc axe/fist
  +5. Already included in `finalStats` if all active weapons qualify.
  Otherwise applied per weapon to spell bonuses, requiring separate hand checks.
- Mage, Priest and Shaman spell files: Arcane Focus, Shadow Focus and
  Elemental Precision live on spells rather than the stat array. Add once
  for the indicated spell school. The automatic Fire build with Ice Shards
  uses Frostfire; its extra Precision applies only to Frostfire Bolt (as
  documented in `mage/frostfire_bolt.go`). The dialog names that scope.
- `core/debuffs.go`: configured Misery / improved Faerie Fire do not stack.
  Own Misery or improved Faerie Fire is assumed maintained when talented;
  the dialog explicitly labels this active-debuff condition.
- `paladin/sov.go`: Vengeance glyph adds 10 expertise while the selected
  Vengeance seal is active. It is a combat aura, removed during simulator
  cleanup before `FillPlayerStats`; it must be added to the cap check.

## Presentation and limits

The primary table shows damage-relevant attributes, not every nonzero stat.
Casters use Intellect, Spirit (except Elemental), Spell Power/Crit/Haste.
Hunters use Agility, Intellect, ranged AP, Armor Penetration, Crit/Haste.
Melee uses Strength, Agility, AP, Armor Penetration, Crit/Haste; Paladin and
Enhancement also use Intellect for mana/spells or talent conversions.
Defensive/resource/resistance stats and secondary disclosures remain removed.

These are deterministic cap checks for the first configured target and the
named attack types, not a gearing recommendation or a simulation of proc uptime.
Talented self-debuffs and the selected seal are assumed active as labeled.
Custom rotations that do not maintain those effects can have a different
in-combat cap; temporary hit/expertise procs are not assumed active.

Unit coverage checks rounding boundaries, class filtering, talent/buff
non-duplication, spell schools, debuff non-stacking, target levels, front-facing
expertise, all supported weapon racials, mixed hands, selected set changes,
and the Vengeance glyph. Browser coverage checks colors, descriptions,
percentages, keyboard dismissal, desktop columns and mobile overflow.

## Combination summaries

Each ranked row now includes its own key percentages, cached for the current
report rows and snapshot so changing the selected preview does not recalculate
all summaries. Hit and expertise reuse the dialog's cap rules and colors.
Expertise percentages express dodge/parry reduction (one expertise = 0.25%),
with expertise points and cap context available in hover/accessibility text.
Mixed racial weapons retain separate hand summaries.

Passive talent contributions are listed individually in the combination stat's
tooltip and beneath its total in the stats dialog, for example “Includes +5
expertise from Tundra Stalker”. These are annotations of the existing total;
they never add the bonus again or change cap/recommendation calculations.
`src/domain/equipment/talent-stat-bonuses.ts` uses the report's saved talent
ranks and each row's weapons to describe direct hit, expertise, armor penetration,
crit, and rating-based haste contributions. Talent names follow the English game
names already used by settings; surrounding text and numbers are localized.
Spell-scoped and situational cap bonuses retain their existing descriptions.

The breakdown describes direct contributions to the reported ratings, not an
exhaustive decomposition of attributes, buffs, procs, or stat dependencies.
Master Conjuror lists only the talent's extra rating from the selected stone.
Weapon-dependent crit follows the engine's main-hand stat presentation. The
pinned engine applies Warrior Mace Specialization's rating even without a mace;
the annotation follows that returned total. Native differential tests compare
each named contribution in all supported presets with the same gear and that
talent removed.

Casters show spell hit, spell haste and spell crit. Physical specs show melee
(or ranged) hit, expertise where applicable, Armor Penetration and melee/ranged
crit; hybrid/poison spell-hit checks remain included. Haste and crit convert the
reported ratings using the pinned engine's 32.789989 and 45.905987 rating per
percentage point. They do not imply inclusion of attack-specific crit bonuses,
target suppression, temporary procs, or multiplicative haste buffs; hover and
screen-reader descriptions state their scope. Missing results say “Stats
unavailable”. The grid uses equal-height rows and wraps summaries on narrow screens.

## Compact comparison presentation

The approved [Option 01 in Paper](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/W-0)
uses aligned stat, effective percentage, reference, cap, and rating-to-cap columns.
On narrow screens each stat becomes a compact summary with cap context below.
A shared ledger lists each identical bonus once with all affected stat/hand labels;
weapon racials remain scoped to the applicable hand. Conditional and spell-scoped
bonuses and dual-wield auto-attack caps are listed separately as cap context.
Tooltips keep dashed number triggers, show status before the cap reference, and
separate named talent amounts under “Already included”. All numerical cap and
simulation calculations remain unchanged.
