# Top Gear compatibility and release evidence

The implemented scope is the local Top Gear path approved by “You can start the implementation.” After local implementation, the user authorized setup using the selected Trigger.dev project. Development is now connected and a real Top Gear run completed through Trigger; see [setup evidence](top-gear-trigger.md). No hosted execution or production readiness claim follows from Development tests.

## Mechanical sources

- Engine, schemas, presets and automatic rotation functions: Poli93/wotlk commit `563e4a08cb15729f1fdcbcf68e6d68224553bfef`.
- Exporter adapter: [pinned character/bag exporter](https://github.com/Poli93/wowsimsexporter-wotlk-335/blob/e69635092425bf4beadca22570fc7b975a73c95e/WowSimsExporter/WowSimsExporter.lua). English glyph names map to class-specific pinned IDs. Profession ranks are retained. Crafting professions are not subject to a blanket 450 gate. The rank gate is limited to Mining/Skinning/Herbalism, whose maximum bonuses are applied unconditionally by the pinned `sim/core/professions.go` (+60 stamina, +40 crit and maximum-rank Lifeblood). Lower-rank gathering bonuses are not modeled yet. Regression coverage includes a real run with Engineering 425 and Jewelcrafting 400.
- Additional equip-limit category and skill metadata: AzerothCore item templates at `db533ad7537a0641d076b13e5611f29f33558d06`, with client 3.3.5 ItemLimitCategory data from Kaev/AzerothcoreDBCToSQL at `ef28c4205b329e11cc1327e8d817dbfa967a6797`. Exact source URLs/hashes are recorded in `data/wotlk/equipment-limits.json`. This supplements eligibility only; DPS/item stats still come from Poli93. Category semantics are described in the [TrinityCore 3.3.5 schema](https://trinitycore.info/files/DBC/335/itemlimitcategory).
- All 8,404 catalog item/gem entries present in this restriction source are covered. Five Classic-only IDs without 3.3.5 source coverage are explicitly unsupported. Normal/heroic trinket category conflicts and cross-color unique gem categories are checked.
- Realm is not part of the normalized mechanics or work key. No Onyxia-specific tuning is introduced.

The CLI overlay only adds structured `json-sim` output and a stats-only mode. It clones requests before calling `ComputeStats` and `RunRaidSim`. Original CLI commands are preserved. Native-host and Linux-amd64 binaries are produced with Go 1.23.4; checksums are generated under ignored `dist/simulator`.

## Evidence represented by tests

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

No boss/raid droptimizer, token redemption, paywall, account flow, automatic gem/enchant changes or cap repair is included.
