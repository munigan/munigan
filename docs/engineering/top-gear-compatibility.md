# Top Gear compatibility and release evidence

The implemented scope is the local Top Gear path approved by “You can start the implementation.” After local implementation, the user authorized setup using the selected Trigger.dev project. Development is now connected and a real Top Gear run completed through Trigger; see [setup evidence](top-gear-trigger.md). No hosted execution or production readiness claim follows from Development tests.

## Mechanical sources

**Item profiles (2026-09-08):** the run panel selects Original WotLK 3.3.5a (new-import default) or Blizzard Wrath Classic. Original uses 878 source-derived static item overrides and 28 native effect groups; 12 items with unavailable/unverified mechanics are explicitly unsupported. Mjolnir is 226 / 102 crit / 665 proc in Original and 239 / 115 / 751 in Classic. Profile and revision are frozen into snapshots and work/result identities. Pre-selector reports/drafts remain Classic. Retries reuse completed work only when its item profile and current gear-identity revision match. See the [implementation and verification](top-gear-item-versions.md) and [source audit](../../data/wotlk/original-items-audit.json). This is itemization support; full realm-specific/class-mechanics certification is not claimed.

- Engine, schemas, presets and automatic rotation functions: Poli93/wotlk commit `563e4a08cb15729f1fdcbcf68e6d68224553bfef`.
- Exporter adapter: [pinned character/bag exporter](https://github.com/Poli93/wowsimsexporter-wotlk-335/blob/e69635092425bf4beadca22570fc7b975a73c95e/WowSimsExporter/WowSimsExporter.lua). English glyph names map to class-specific pinned IDs. Profession ranks are retained. Crafting professions are not subject to a blanket 450 gate. The rank gate is limited to Mining/Skinning/Herbalism, whose maximum bonuses are applied unconditionally by the pinned `sim/core/professions.go` (+60 stamina, +40 crit and maximum-rank Lifeblood). Lower-rank gathering bonuses are not modeled yet. Regression coverage includes a real run with Engineering 425 and Jewelcrafting 400.
- Additional equip-limit category and skill metadata: AzerothCore item templates at `db533ad7537a0641d076b13e5611f29f33558d06`, with client 3.3.5 ItemLimitCategory data from Kaev/AzerothcoreDBCToSQL at `ef28c4205b329e11cc1327e8d817dbfa967a6797`. Exact source URLs/hashes are recorded in `data/wotlk/equipment-limits.json`. This supplements eligibility only; DPS/item stats still come from Poli93. Category semantics are described in the [TrinityCore 3.3.5 schema](https://trinitycore.info/files/DBC/335/itemlimitcategory).
- All 8,404 catalog item/gem entries present in this restriction source are covered. Five Classic-only IDs without 3.3.5 source coverage are explicitly unsupported. Normal/heroic trinket category conflicts and cross-color unique gem categories are checked.
- Realm is not part of the normalized mechanics or work key. No Onyxia-specific tuning is introduced.

The CLI overlay adds structured `json-sim` output, a stats-only mode, and `--item-version original|classic` (default Classic for existing native callers). It clones requests before `ComputeStats` and `RunRaidSim`; Original applies trusted compiled static data and runtime effect hooks, then restores the prior profile. Original CLI commands are preserved. Native-host and Linux-amd64 binaries are produced with Go 1.23.4; checksums are generated under ignored `dist/simulator`.

## Equivalent gear pairs (2026-09-08)

Ring and trinket pairs are unordered for set identity, allowance estimates, simulation planning, and report comparisons. Each item retains its gems and enchant; physical-copy restrictions and slot locks still apply. Main-hand/off-hand placement remains mechanically distinct. The equipped reference is simulated once using its original placement, and shared rings/trinkets remain in their reference slots when displaying replacements.

Work keys include `pairs-v2`; older ordered-pair work is recomputed on retry. Historical reports are grouped before pagination using reference placement and a deterministic hash tie-break, never the highest noisy DPS roll. The stored report is unchanged. Unchanged Original items use complete Wowhead tooltips, including Equip/Use effects, sockets, and enchant information. Items in the Original override or unsupported lists retain the version-aware stats preview so Classic upgrades cannot leak into Original tooltips. These previews include item, gem, and enchant icons resolved from the pinned catalog.

Verification: 40 unit/UI tests, 12 database integration tests, and all five browser tests pass, including actual native runs through Trigger.dev Development. Desktop/mobile tooltip placement and modal Escape behavior were checked. Typecheck, lint, and production build pass.

## Shared item tooltips

`ItemIcon` in `src/features/inventory/Item.tsx` takes the full item instance and renders its image with an enhancement-aware tooltip link. It is used in inventory, unsupported bags, changed-item rows, the gear strip, and full-set details; `ItemLink` supports text-only links through the same profile selection.

Provider and Original tooltips share their frame, typography, colors, and viewport-positioning helper. An 8px viewport margin is preserved on resize and scroll, with overflow scrolling for tall content. Provider tooltips move into an active modal to remain interactive and return to the document when it closes. Browser regressions cover 320×240, 390×320, and desktop bounds, wheel scrolling, and full-set modal interaction.

## Automatic gems (2026-09-08)

New imports and restored selections enable editable normal/meta/JC gem defaults under **Gems & sockets**. Defaults come from the equipped gem palette, with specialization-family fallbacks when no gems were imported. Existing occupied sockets are retained unless JC quota or meta activation needs repair. This is one deterministic arrangement per item set; it does not search additional DPS gem combinations or repair hit/expertise caps. The imported equipped set remains the comparison baseline.

Before full-set legality checks, `prepareGems` fills native sockets plus the simulator's assumed belt buckle and blacksmith sockets, replaces excess JC gems with ordinary stat equivalents, and relocates missing Dragon’s Eyes by replacing regular gems. It aims for three JC gems, then repairs meta colors with minimal greedy substitutions. Unique gems are retained and their limits are enforced. Sets with insufficient available sockets report the unmet requirement. Meta conditions come from the pinned simulator's `ui/core/proto_utils/gems.ts`; regenerate with `python3 -B tools/data/meta-gems.py`. One catalog meta with no pinned activation rule is excluded from selectable defaults.

The native engine does not validate meta activation itself. For runs with automatic gemming enabled, inactive metas are removed from native input just as the simulator browser does, including on the equipped reference. Their physical sockets remain visible with an explicit inactive-meta warning. Reports persist gem overrides by physical item instance; icons, tooltips, copied equipment and reused drafts all use those recorded gems. Existing reports without gem configuration retain their original behavior. Work identities include `gems-v1`, the configured defaults and resolved gear, so ungemmed results cannot be reused as gemmed simulations.

Verification: 12 dedicated gem tests cover defaults, untouched baseline, buckle/native/blacksmith sockets, exact CLI equipment, JC relocation and overflow, meta activation/inactivation, paired-slot stability, request validation and recorded report gems. A fresh run of the supplied DK character/bag exports evaluated 48/48 sets at 500 iterations each. All 47 candidates retained three Dragon’s Eyes with no gem warnings; the equipped reference remained 11,356.0185 DPS, and the top result was 11,388.3185 DPS. The browser workflow also verifies editable defaults and a native run starting from an empty-socket bag item. All 58 unit/UI tests, 12 database checks, four affected browser tests, typecheck, lint and production build pass.

## Evidence represented by tests

### Automatic enchants and extra sockets

The **Gems, enchants & sockets** control now also enables copying missing enchants and profession bonuses. Candidate items keep existing enchants. Missing enchants first use a compatible equipped-slot enchant (rings share a canonical reference order); weapon types, class restrictions and professions are checked through the pinned catalog. If no compatible equipped enchant is available, qualified professions can supply DPS defaults for ring enchants, fur linings, shoulder inscriptions, cloak embroidery and engineering glove/cloak/boot enhancements. These defaults require 400 profession skill, or 405 for the automatic Nitro Boosts fallback; unknown ranks follow the simulator's existing maximum-rank assumption. Equipped enchants are preferred over automatic alternatives.

Eternal Belt Buckles are represented as extra belt sockets, not as the belt's enchant ID. Blacksmith wrist/glove sockets require the profession and at least 400 skill when rank is known. These sockets coexist with enchants/tinkers and are filled by the configured gem rules. Item details identify the buckle or blacksmith socket. Pinned catalog metadata supplies enchant effects; profession-specific ring/socket restrictions are cross-checked against [Enchant Ring — Assault](https://www.wowhead.com/wotlk/spell=44645/enchant-ring-assault) and the [Wrath slot enhancement reference](https://warcraft.wiki.gg/wiki/Northrend_enchantments_by_slot).

Enchant overrides are saved by physical item instance, passed into native simulation, and used in report icons, tooltips, differences, copied gear and reused drafts. The equipped baseline and historical reports remain as imported. `enchants-v1` separates automatic-enchant work from previous results. The combinations table now has a rounded 8px outer border with intact row separators.

Verification: eight enhancement tests cover copying, preserving existing enchants, disabling the option, profession/rank restrictions, caster/melee ring defaults, ring-order stability, runeforges, staff compatibility and socket/enchant coexistence. All 66 unit/UI tests, 12 database checks and four affected browser tests pass. A fresh 48-set run using the supplied DK exports verified every unenchanted bag-glove candidate received Hyperspeed Accelerators, all candidate JC quotas remained at three, and the baseline remained unchanged. Desktop and 390px mobile table layouts were visually checked with no horizontal overflow.

- Pure checks: preserved physical copies and enhancements, category limits, legal paired slots, joint head/chest enumeration, locks and reference-only C, allowance boundary, negative and zero-baseline gains, tied recommendation without rank changes, invalid imports, category-scoped binary profile import, explicit protobuf defaults in full JSON, and legality of all extracted talent presets.
- Native checks: wrapped-versus-original CLI DPS at identical input/seed, final stats, deterministic owned-set evaluation, live cancellation and timeout, and all **40 talent presets across 13 DPS simulator modules** returning finite positive DPS.
- Database checks: concurrent idempotent admission, distinct submissions cannot overspend the daily budget, full queue rejection creates no reservation/outbox entry, ownership, immutable completed work on duplicate delivery, cancellation retaining rows, queued expiry settlement without CPU workers, transient evaluator retry, provider-targeted busy-claim recovery and dispatch-generation fencing.
- Browser checks: anonymous navigation, import/review/unsupported bag exclusion/settings/draft restore, admission-error recovery, a real web→PostgreSQL→separate native worker→report run, all 17 equipment slots, reference-preserving differences, readonly sharing, draft reuse without report mutation and report widths of 320/390/768/1440 pixels without horizontal overflow. Unit/UI checks cover hidden-tab polling and terminal expired links.

The smoke matrix covers every exported preset; it is **not** a claim that every rotation is optimal or every in-game mechanic has client parity. The pinned Rogue automatic rotation explicitly falls back to its Assassination rotation for Subtlety. Users can import an APL. No replacement rotation has been invented.

## Local limits and benchmark

The development policy is 500 actual iterations per set, at most 120 admitted sets of 5,000 budget units each (600,000 units per run), two shared workers, 900 seconds per job, a 60-second native-process timeout and at most two attempts per set. The free set allowance was increased to 120 at the user's request. Work units are accounting units, separate from actual iterations. Reservations cover the maximum attempts and are reconciled against attempted work; cached completed results on retry consume no new attempt.

See `top-gear-local-benchmark.json` for measured native wall time at 180 seconds/500 iterations on this machine. These single-worker samples do not establish production costs, concurrency behavior on Trigger, long multi-target capacity, or a public precision guarantee.

## Remaining release gates

1. Capture real Warmane 3.3.5a client exports for character/bags, localized glyphs, duplicate enhanced copies, empty sockets, professions and all supported DPS families. Compare representative output to the pinned browser simulator and actual client restrictions.
2. Configure hosted database/environment access in the connected Trigger project; verify actual Linux container execution, cancellation of a live child, forced crash/lease recovery, lost dispatch acknowledgment, queue expiry and peak child-process concurrency with at least three jobs against cap two. Development execution and dry-run binary packaging are verified separately.
3. Benchmark worst-case admitted duration/target/spec combinations on the chosen worker machine. Select production iteration, time, cost and abuse limits from that evidence; production admission is closed without explicit configuration.
4. Verify the deployment's trusted client-IP header is overwritten by its proxy, set origin and capability keys, and exercise public quota and expiry behavior. Perform a manual keyboard/screen-reader and contrast review alongside the automated narrow-width checks.

No boss/raid droptimizer, token redemption, paywall, account flow or cap repair is included.
