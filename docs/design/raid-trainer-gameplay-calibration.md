# Raid trainer gameplay calibration

Working reference: Warmane 3.3.5, 25-player Heroic. Profile `lk-25h-positioning-v1`, revision 2, is displayed as “25-player Heroic positioning practice.” It is a positioning exercise with approximated combat support, timing, and geometry. No value in this profile is timing-verified. The controlled actor is a melee damage dealer; its class portrait identifies the token and does not promise class spells.

## Profile values

| Parameter | Value and unit | Evidence | Rationale or source |
| --- | --- | --- | --- |
| Arena centre / radius | `(0, 0)` / 45 yards | Teaching | Circular playable-platform calibration. |
| Actor speed / collision radius | 7 yards/s / 0.35 yards | Teaching | Movement calibration; collision radius is separate from portrait size. Friendly actors may overlap. |
| Defile cast / reveal delay | 2 s / 0.1 s from cast start | Documented / teaching | Cast duration follows the [Warmane community guide](https://forum.warmane.com/showthread.php?t=324235); reveal delay is an authored teaching approximation. |
| Defile initial radius | 5 yards | Teaching | Requires collision-footage calibration. |
| Defile first tick / interval / lifetime | 1 s / 1 s / 30 s | Teaching | Authored tick lifecycle. |
| Defile growth | Radius × `1.1 ** hitCount` each tick | Teaching | Authored multiplicative model, independent of the previous experiment. |
| Spirit wave / spawn interval / activation age | 10 spirits / 0.5 s / 30 s from each birth | Reference-informed | Practice values informed by references; unverified for Warmane. |
| Spirit speed | 5 yards/s | Teaching | Movement calibration. |
| Spirit contact / explosion radius | 1 yard / 5 yards | Teaching, unverified | Contact radius is explicitly unverified. Contact detection and explosion exposure remain independent fields. |
| Spirit maximum age | 60 s | Teaching | Safety limit; expiry is unresolved rather than success. |
| Val’kyr wave size | 3 NPC passengers | Documented | 25-player structure from the Warmane community guide; the player is excluded in this focused drill. |
| Val’kyr descent / carry speed | 2 s / 2 yards/s | Teaching | Automated-support approximation. |
| Val’kyr stun / rescue | First 3 s after pickup / pickup + 8 s | Teaching | Authored support script, independent of inferred player damage. |
| NPC reaction range | 0.2–0.65 s | Teaching | Seeded human-response approximation. |
| NPC decision interval / route commitment | 0.25 s / 0.45 s | Teaching | No future knowledge is available to NPC decisions. |
| Soaker intercept correction | 4 yards | Teaching | Independent automated-support bound; measured rationale below. |
| Formation / starting offset / route half-width | 2 / 1.25 / 2.5 yards | Teaching | Strategy parameters. Starting samples use square-root radial scaling for a uniform disk. |
| Recording frequency / excerpt / event cap | 10 Hz plus event steps / 60 s / 2000 events | Teaching | Engineering limits. Overflow interrupts recording. |

The source set also includes the [Warmane positioning discussion](https://forum.warmane.com/showthread.php?t=415337), [Paragon strategy](https://paragon.fi/node/160.html), [DBM pinned revision](https://github.com/DeadlyBossMods/DBM-WotLK/blob/fb69197a6c5eca13fd6c683b081b1bcb713042ef/DBM-Raids-WoTLK/Icecrown/TheFrozenThrone/LichKing.lua), and [AzerothCore implementation](https://github.com/azerothcore/azerothcore-wotlk/blob/master/src/server/scripts/Northrend/IcecrownCitadel/boss_the_lich_king.cpp). AzerothCore is an independent emulator example, not Warmane code. These references did not measure the teaching values above.

## Authored scenarios

All times are seconds from exercise start. They are teaching schedules, not timestamps measured from a captured pull. Each variant has `you` and `neighbor` target cases.

| Variant | Defile | Pickups | Other authored state | End |
| --- | ---: | --- | --- | ---: |
| `before-standard` | 8 | 15, 15.5, 16 | Starts stacked; formation check at 24 | 27 |
| `before-tight` | 8 | 10.5, 11, 11.5 | Target separates; others hold; check at 20 | 23 |
| `after-standard` | 13 | 6, 6.5, 7 | Stack releases at 7; check at 23 | 26 |
| `after-tight` | 8.25 | 7, 7.5, 8 | Stack releases at 8; check at 20 | 23 |
| `spirits-moving` | 8 | — | Ten births from −24 through −19.5; relocate at 4; check at 20 | 35 |
| `spirits-settled` | 8 | — | Ten births from −24 through −19.5; raid and soaker begin settled; check at 20 | 35 |
| `frostmourne-return` | 3 | — | On platform after return at 0; new wave at 10; relocate at 12; check at 24 | 58 |

Phase two uses raid anchor `(0, 8)`, boss `(0, 4)`, formation radius 2 yards, and drop preferences to either side of the raid. After the last pickup, ordinary raiders may loosen to 4–6 yards and must return within 2 yards by the finish check.

Phase three uses start `(0, −22)`, destination `(0, 22)`, spirit origin `(0, −28)`, soaker intercept `(0, 9)`, and a boss position 4 yards toward incoming spirits from the current raid anchor. The Frostmourne-return case starts at `(0, 0)` and moves toward `(0, 22)`. The seed mirrors east/west preferences without rotating arena art.

At spirit contact, every actor within the 5-yard burst is evaluated. The soaker’s protected exposure is intentional; nearby actors are still hit. This protection is an authored automated-support assumption, not an unlimited class cooldown.

No reviewed versioned server capture is available for this revision. A later capture must record server/version provenance and measurements before any value is labeled timing-verified; changed calibration requires a profile revision bump and fixture updates.

## Revision 2: measured support and recovery rules

Profile revision 2 retains the profile ID and every spell, movement and reaction value above. Phase-three scenario revisions are now 2; phase-two scenario revisions remain 1. Revision-one checkpoints reject rather than silently changing their physical setup. `strategy.soakInterceptRadius` is a separately validated **4-yard** automated-support bound; `routeHalfWidth` remains **2.5 yards** for grading.

The ordinary-input seed-18 settled-neighbor trace exposed a diverted spirit whose closest approach to `(0,9)` was about 4.48 yards. Even ideal contact needed more than `4.48 − (1 + 0.35) ≈ 3.13` yards of lateral correction, making the old 2.5-yard correction bound physically insufficient. Four yards supplies a bounded teaching margin. This is an authored support correction, not a measured Warmane rule.

NPCs invalidate a committed formation route only after their target warning is delivered through the existing observation/reaction delay. During relocation, their Defile escape uses the current row instead of spending lateral escape speed toward the destination anchor. The assigned soaker prioritizes the leading observed threat and extrapolates its approach toward the observed raid anchor over the observation age at the authored spirit speed. Delivered spirit motion refreshes the interception route. The goal remains inside the 4-yard intercept region, avoids observed Defile, and stays outside a conservative raid/tank clearance:

`burst radius + max(formation radius, 4-yard boss/tank offset) + victim actor radius + trigger radius + soaker actor radius = 10.7 yards from the raid anchor`

The last two terms account for a burst center lying beyond the soaker at contact. When a predicted goal crosses that margin, the controller stops at the last safe point on the segment from its intercept anchor. Only its **own actual contact** gives the soaker immediate completed-action feedback: that spirit is removed from its observed and queued hazards and the obsolete route is invalidated. Remote contacts and new threats keep delayed perception. This explicit automated-support assumption prevents an already-soaked spirit from being resurrected by queued snapshots; it adds no protection to nearby actors and no hidden-target knowledge.

## Assessment approximations retained from Task 6

Platform usability uses an actor-clear **1-yard grid** and a four-neighbor flood fill. It seeds the nearest clear point, deliberately allowing escape from an occupied pool; it is not proof of a damage-free path to that seed. It considers the union of pools and never calls corridor intersection alone a blocked route.

A targeted actor receives a serialized, bounded formation recovery allowance initialized once at pool birth:

`until = pool birth + (drop-to-anchor distance + 2 * (initial pool radius + actor radius)) / run speed`

A tight-before target responding at 8.1 seconds places its pool about 13.3 yards from the anchor at 10 seconds. Clearing the initial pool alone needs at least `5.35 / 7` seconds, while pickups occur at 10.5, 11 and 11.5. The allowance avoids demanding instant formation return on first geometric clearance. It is an authored recovery budget, not an exact minimum safe-path proof. Saved anchor/radius/completed state lives in `Pool.formationRecovery`; early rejoin or the deadline permanently completes it. Later pickups and current distance cannot renew it, and the final formation remains enforceable.

Phase-two carrier corridors use the **nearest radial pickup route** shared with actual Val’kyr movement: `(0,8)` projects to `(0,+45)`; exact-center fallback is `(0,-45)`. Phase-three corridor grading uses the authored start-to-finish route. Drop/corridor overlap remains a positioning miss, separate from physical platform unusability.

## Ordinary-input verification

`tests/support/raid-scenario.ts` retains explicit direction/duration segments for all fourteen target cases. Starting at GO, cumulative segment durations are their timestamps; `playTrace` calls only `advanceAttempt`. The same trace is run twice at seed 7 and once at seed 18, with exact attempt equality for the repeat and clean completion required for every run. Both primary and supporting misses must be absent. Every phase-three run requires ten explosions whose sole victim and protected actor is the soaker. Separate fixtures retain stack camping, following the target, corridor overlap and intentional spirit exposure failures. These prove the teaching scenarios are playable with ordinary movement; they do not certify server fidelity.
