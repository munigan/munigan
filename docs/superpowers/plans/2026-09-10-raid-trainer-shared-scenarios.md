# Shared Raid Training Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver four Defile training families with shared encounter behavior, believable movement by 25 actors, overlapping mechanics, and accurate assessment/replay.

**Architecture:** A drill selects lesson objectives over a deterministic encounter scenario. One simulation module owns time and world state; mechanic modules supply hazards and forced effects while one raid movement module resolves voluntary movement. Profile data, authored scenario variants and complete checkpoints preserve reuse and reproducibility.

**Tech Stack:** Existing TypeScript, Next.js 16.3.4, React 19.2.8, Canvas 2D, WebAudio, Vitest 5, Playwright 1.63, pnpm 10.33.0 and Node 24. No new runtime dependencies.

**Spec:** [Approved shared-scenarios design](../specs/2026-09-10-raid-trainer-shared-scenarios-design.md).

## Global Constraints

The following requirements are copied from the spec and apply to every task:

- “Working reference: Warmane 3.3.5, 25-player Heroic.”
- “The controlled actor is a melee damage dealer; the existing class portrait is identification, not a promise of class spells.”
- “The Frostmourne-return exercise begins on the platform after the return.”
- “Changing the drill focus must not change the physical world when profile, scenario, variant, seed and input are identical.”
- “Keep the fixed 60 Hz simulation independent of React, canvas, audio and wall-clock timers.”
- “Actors may overlap; there is no physical body-blocking between friendly tokens.”
- “Difficulty comes from authored overlap, formation density, valid target variation, teammate response variation and coaching level.”
- “Timers-only becomes the default for the new drills.”
- “Retry and the R shortcut restore the same starting situation and seed.”
- “Keep the approved Quick Bar and one Start game action.”
- “Keep the circular portraits, arena artwork, black body, top vignette, flat attached-icon timer bars and shortcut keycaps approved in Paper.”

Read the relevant guides in `node_modules/next/dist/docs/` before editing Next/React integration. The installed client-directive and image guides were inspected during planning. Keep immutable serializable scenario definitions across the client entry seam and preload required canvas images before starting.

The current checkout contains substantial unrelated, mostly uncommitted work. At execution, read the using-git-worktrees skill and preserve the complete current trainer implementation when selecting a checkout. A clean checkout of HEAD alone lacks the existing untracked trainer files. Never reset this tree, stage all files or discard unrelated work. Commit only each task's explicit paths, after inspecting the staged diff. Do not publish or deploy as part of this plan.

---

## Execution map

Tasks 1–7 build and verify the scenario engine alongside the currently running experiment. Tasks 8–10 connect it to the approved UI. Task 11 removes superseded runtime paths and verifies the complete product. This temporary parallel runtime lets the user keep the existing app working during the migration; the final app has one active simulation path.

| File                                               | Responsibility                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/features/raid-trainer/scenario-model.ts`      | Serializable definitions, runtime state and recorded event contracts               |
| `src/features/raid-trainer/scenario-content.ts`    | One profile, roster, strategies, curated variants, run selection and validation    |
| `src/features/raid-trainer/scenario-runtime.ts`    | Fixed-step runner and authoritative event ordering                                 |
| `src/features/raid-trainer/scenario-defile.ts`     | Shared cast, pool, tick, growth and expiry lifecycle                               |
| `src/features/raid-trainer/raid-strategy.ts`       | Observations, assignments, seeded decisions and one voluntary movement integration |
| `src/features/raid-trainer/scenario-valkyrs.ts`    | NPC pickup, forced carry, automated control, release and loss                      |
| `src/features/raid-trainer/scenario-spirits.ts`    | Spirit activation, pursuit, interception and explosions                            |
| `src/features/raid-trainer/scenario-assessment.ts` | Findings from recorded events and role obligations                                 |
| `src/features/raid-trainer/scenario-recording.ts`  | Bounded frames, complete checkpoints and event selection                           |
| `src/features/raid-trainer/scenario-view.ts`       | Safe public view, timer forecasts and cue selection                                |
| `src/features/raid-trainer/render-scenario.ts`     | Approved arena rendering with added mechanics                                      |
| Existing setup/controller/review/audio files       | Consume the new run and view, retaining the approved controls                      |
| `docs/design/raid-trainer-gameplay-calibration.md` | Concrete values, evidence status and later calibration observations                |

Keep module functions internal unless named in the task interfaces below. Do not create an app-wide event bus, a scripting language or a generic plugin registry.

## Concrete first profile and authored excerpts

These are executable starting values, not a declaration of exact Warmane parity. `profile.id` is `lk-25h-positioning-v1`; display it as “25-player Heroic positioning practice.” The details explain that combat support and some timing/geometry are approximated. No field starts as timing-verified. Record all rows in the calibration document and machine-readable evidence records. This satisfies the spec's requirement to choose values explicitly instead of inheriting old experiment constants.

| Parameter                                                    | Initial value                                    | Evidence status and purpose                                                          |
| ------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Arena                                                        | Centre `(0,0)`, radius 45 yards                  | Teaching calibration for the circular playable platform                              |
| Actor speed / collision radius                               | 7 yards/s / 0.35 yards                           | Teaching calibration; separate from portrait dimensions                              |
| Defile cast / target reveal delay                            | 2 s / 0.1 s from cast start                      | Cast documented in Warmane community guide; reveal delay is a teaching approximation |
| Defile initial radius                                        | 5 yards                                          | Teaching approximation requiring collision-footage calibration                       |
| Defile first tick / interval / lifetime                      | 1 s / 1 s / 30 s                                 | Teaching approximation; explicitly test first-tick timing                            |
| Defile growth                                                | Radius multiplied by `1.1 ** hitCount` per tick  | Teaching approximation, not copied from the old linear growth model                  |
| Spirit wave / spawn interval / activation age                | 10 / 0.5 s / 30 s from each spirit's birth       | Reference-informed practice values; not verified for Warmane                         |
| Spirit speed / trigger radius / explosion radius             | 5 yards/s / 1 yard / 5 yards                     | Teaching approximation; trigger and explosion distances are independent fields       |
| Spirit maximum age                                           | 60 s                                             | Practice safety limit; reaching it ends the drill as unresolved, not successful      |
| Val’kyr wave size                                            | 3 NPC passengers                                 | Documented 25-player structure; player excluded for this focused drill               |
| Val’kyr descent / carry speed                                | 2 s / 2 yards/s                                  | Automated support approximation                                                      |
| Val’kyr stun / rescue                                        | First 3 s after pickup / release at pickup + 8 s | Authored support script, not inferred player DPS                                     |
| NPC reaction delay / decision interval / route commitment    | Seeded 0.2–0.65 s / 0.25 s / 0.45 s              | Human-behavior teaching parameters; no future knowledge                              |
| Formation radius / starting offset radius / route half-width | 2 / 1.25 / 2.5 yards                             | Strategy parameters, not spell mechanics                                             |
| Record frequency / maximum excerpt / maximum events          | 10 Hz plus event steps / 60 s / 2000 events      | Engineering limits; overflow must report an interrupted recording                    |

Numeric evidence records use `documented`, `reference-informed` or `teaching`, plus source URL/design-decision explanation and units. The phrase “timing-verified” requires a versioned capture comparison, not a guide citation. If later measurements change a value, bump the profile revision and update expected fixtures together. Reject missing values instead of silently falling back.

Sources already inspected: [Warmane guide](https://forum.warmane.com/showthread.php?t=324235), [Warmane positioning discussion](https://forum.warmane.com/showthread.php?t=415337), [Paragon strategy](https://paragon.fi/node/160.html), [DBM pinned revision](https://github.com/DeadlyBossMods/DBM-WotLK/blob/fb69197a6c5eca13fd6c683b081b1bcb713042ef/DBM-Raids-WoTLK/Icecrown/TheFrozenThrone/LichKing.lua). The [AzerothCore implementation](https://github.com/azerothcore/azerothcore-wotlk/blob/master/src/server/scripts/Northrend/IcecrownCitadel/boss_the_lich_king.cpp) was also inspected as an independent emulator example; it is not Warmane's code. It distinguishes contact detection from the explosion and has separate targeting exclusions. Do not infer Warmane eligibility or exact radii from it.

Authored excerpt times below are seconds from the exercise start. They preserve the documented relative situations but are teaching schedules, not claimed to be timestamps from a captured pull. No timer randomization changes their order.

| Variant ID           | Defile cast | Pickup times   | Other events / initial state                                                            | End |
| -------------------- | ----------- | -------------- | --------------------------------------------------------------------------------------- | --- |
| `before-standard`    | 8           | 15, 15.5, 16   | Start stacked; finish formation check 24                                                | 27  |
| `before-tight`       | 8           | 10.5, 11, 11.5 | Target separates; others hold stack; finish check 20                                    | 23  |
| `after-standard`     | 13          | 6, 6.5, 7      | Stack released after final pickup; finish check 23                                      | 26  |
| `after-tight`        | 8.25        | 7, 7.5, 8      | Stack released after final pickup; finish check 20                                      | 23  |
| `spirits-moving`     | 8           | None           | Ten spirits born at -24 through -19.5; relocate at 4; check at 20                       | 35  |
| `spirits-settled`    | 8           | None           | Ten spirits born at -24 through -19.5; raid starts at destination; check at 20          | 35  |
| `frostmourne-return` | 3           | None           | Return at 0; no initial spirit wave; new wave starts at 10; relocate at 12; check at 24 | 58  |

Every variant expands to `-you` and `-neighbor` target cases. A `neighbor` is selected at reveal from free melee/ranged NPCs within 8 yards, excluding tanks, soaker and passengers. Generate initial formations ensuring a candidate exists. If player movement changes proximity, choose the closest eligible NPC instead; do not terminate or leak the choice early.

Phase-two strategy: initial/final anchor `(0,8)`, boss `(0,4)` and drop preference to either side of the raid rather than along its southward Val’kyr route. After the final pickup, ordinary raiders may loosen to 4–6 yards around the anchor; at the finish check they must be back within 2 yards. A targeted actor is temporarily exempt while placing/exiting its pool. Phase-three strategy: start anchor `(0,-22)`, destination `(0,22)`, spirit origin `(0,-28)`, soaker intercept anchor `(0,9)` and boss following 4 yards toward the incoming spirits from the current raid anchor. Mirror east/west preferences using the seed; do not rotate the arena art. The return case starts at `(0,0)` and uses `(0,22)` as its destination. In `spirits-settled`, the raid already occupies the destination and the soaker already occupies the intercept position.

At spirit contact, evaluate all actors within the burst radius. The soaker's protected exposure is recorded as intentional and does not increment accidental raid exposure; other nearby actors are still hit. Protection is a named automated-support assumption for this drill, not a simulated unlimited class cooldown.

## Shared contracts used by the tasks

Define these in `scenario-model.ts`. The names in subsequent tasks refer to this contract. Fields may be split into private implementation types, but do not silently rename cross-task exports.

```ts
export type Point = { x: number; y: number };
export type Family =
  "before-valkyrs" | "after-valkyrs" | "vile-spirits" | "frostmourne-return";
export type Focus = "defile" | "vile-spirits";
export type Mode = "guided" | "timers";
export type Status =
  "ready" | "countdown" | "running" | "paused" | "complete" | "failed";
export type Evidence = {
  status: "documented" | "reference-informed" | "teaching";
  unit: string;
  source: string;
};
export type Profile = {
  id: string;
  revision: number;
  arenaRadius: number;
  runSpeed: number;
  actorRadius: number;
  defile: {
    cast: number;
    revealDelay: number;
    radius: number;
    firstTick: number;
    tick: number;
    life: number;
    growthFactor: number;
  };
  spirits: {
    count: number;
    spawnInterval: number;
    activationAge: number;
    speed: number;
    triggerRadius: number;
    burstRadius: number;
    maxAge: number;
  };
  valkyrs: {
    count: number;
    descent: number;
    speed: number;
    stun: number;
    rescue: number;
  };
  npc: {
    reactionMin: number;
    reactionMax: number;
    decisionInterval: number;
    commitment: number;
  };
  evidence: Record<string, Evidence>;
};
export type Circle = Point & { id: string; radius: number };
export type Observation = {
  at: number;
  eventIds: string[];
  hazards: Circle[];
  targetIds: string[];
};
export type Mind = {
  reaction: number;
  observeAt: number;
  decideAt: number;
  holdUntil: number;
  direction: number;
  goal: Point;
  observed: Observation;
  reason: string;
};
export type Actor = Point & {
  id: string;
  name: string;
  control: "player" | "npc";
  role: "melee" | "ranged" | "healer" | "tank" | "soaker";
  classIcon: string;
  color: string;
  radius: number;
  available: boolean;
  carriedBy: string | null;
  mind: Mind | null;
};
export type Strategy = {
  start: Point;
  finish: Point;
  spiritOrigin: Point;
  soak: Point;
  formationRadius: number;
  routeHalfWidth: number;
  relocateAt: number | null;
  releaseStackAt: number | null;
  finishCheckAt: number;
  settledInitially: boolean;
};
export type ScriptEvent = { id: string; at: number; checkpointId: string } & (
  | { kind: "defile"; target: "you" | "neighbor" }
  | { kind: "pickup"; actorId: string }
  | { kind: "relocate" | "return" | "finish" }
  | { kind: "spirit-wave"; origin: Point }
  | { kind: "check-formation"; anchor: "start" | "finish" }
);
export type Scenario = {
  id: string;
  revision: number;
  family: Family;
  variantId: string;
  duration: number;
  profileId: string;
  strategy: Strategy;
  events: ScriptEvent[];
  initialSpirits: { origin: Point; firstBirthAt: number } | null;
  checkpoints: { id: string; at: number }[];
};
export type RunSpec = {
  profile: Profile;
  scenario: Scenario;
  seed: number;
  focus: Focus;
  mode: Mode;
};
export type Cast = {
  id: string;
  startedAt: number;
  revealAt: number;
  resolvesAt: number;
  targetCase: "you" | "neighbor";
  targetId: string | null;
  resolved: boolean;
};
export type Pool = Circle & {
  targetId: string;
  bornAt: number;
  expiresAt: number;
  nextTick: number;
  growths: number;
};
export type Spirit = Point & {
  id: string;
  bornAt: number;
  activeAt: number;
  targetId: string | null;
  explodedAt: number | null;
  expiresAt: number;
};
export type Valkyr = Point & {
  id: string;
  passengerId: string;
  pickupAt: number;
  releaseAt: number;
  destination: Point;
  state: "descending" | "carrying" | "released" | "lost";
};
export type WorldEvent = {
  id: string;
  at: number;
  kind:
    | "cast"
    | "target"
    | "pool"
    | "damage"
    | "pickup"
    | "release"
    | "loss"
    | "relocate"
    | "return"
    | "spirit-spawn"
    | "spirit-active"
    | "explosion"
    | "formation"
    | "end";
  sourceId: string;
  mechanic: "defile" | "valkyrs" | "vile-spirits" | "strategy";
  actorIds: string[];
  position: Point | null;
  checkpointId: string;
  amount: number;
  protectedActorIds: string[];
};
export type Finding = {
  id: string;
  eventId: string;
  at: number;
  actorId: string;
  mechanic: WorldEvent["mechanic"];
  code: "exposure" | "outside-formation" | "route-overlap" | "formation-exempt";
  severity: "info" | "miss";
  detail: string;
};
export type World = {
  elapsed: number;
  step: number;
  status: Status;
  actors: Actor[];
  casts: Cast[];
  pools: Pool[];
  spirits: Spirit[];
  valkyrs: Valkyr[];
  events: WorldEvent[];
  anchor: Point;
  stage: "stack" | "spread" | "relocate" | "settled";
  endReason:
    | "completed"
    | "actor-lost"
    | "platform-unusable"
    | "spirit-unresolved"
    | "recording-limit"
    | null;
};
export type Attempt = {
  run: RunSpec;
  world: World;
  seed: number;
  rngState: number;
  cursor: number;
  remainder: number;
  findings: Finding[];
};
export type TimerView = {
  id: string;
  label: string;
  icon: string;
  remaining: number;
  duration: number;
  kind: "cast" | "upcoming";
  mechanic: WorldEvent["mechanic"];
};
export type CueView = {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: "neutral" | "warning" | "danger" | "success";
};
export type PublicWorld = Omit<World, "actors" | "casts"> & {
  actors: Omit<Actor, "mind">[];
  casts: Omit<Cast, "targetCase">[];
};
export type View = {
  world: PublicWorld;
  findings: Finding[];
  timers: TimerView[];
  cue: CueView | null;
};
export type ScenarioRenderOptions = {
  showTrail?: boolean;
  showGrowth?: boolean;
  recordedTrail?: Point[];
  highlightedEvent?: WorldEvent | null;
  highlightedLabel?: string;
  highlightedDetail?: string;
};
export type Checkpoint = {
  runId: string;
  scenarioRevision: number;
  profileRevision: number;
  seed: number;
  world: World;
  rngState: number;
  cursor: number;
  findings: Finding[];
};
export type Frame = {
  world: Omit<World, "events">;
  eventCount: number;
  findingCount: number;
};
export type Recording = {
  frames: Frame[];
  events: WorldEvent[];
  findings: Finding[];
  checkpoints: Record<string, Checkpoint>;
};
```

Role is independent of input ownership. Never reuse the old `role: "player" | "raid"` discriminator as a combat responsibility. Event IDs are monotonic sequence IDs scoped to an attempt; mechanic-instance IDs are distinct. No Maps, DOM objects or closures belong in checkpoint state.

### Task 1: Validate concrete content and profile provenance

**Files:** Create `scenario-model.ts`, `scenario-content.ts`, `scenario-content.test.ts` and `docs/design/raid-trainer-gameplay-calibration.md`.

**Interfaces:** Produce `lichKingPracticeProfile: Profile`, `scenarioFamilies: readonly Family[]`, `makeRun(variantId: string, seed: number, focus?: Focus, mode?: Mode): RunSpec`, `validateRun(run: RunSpec): string[]`, and `createRoster(run: RunSpec): Actor[]`.

- [ ] **Step 1: Write the failing definition tests.**

```ts
import { expect, it } from "vitest";
import { createRoster, makeRun, validateRun } from "./scenario-content";
it("defines 25 actors and never inherits old cast timing", () => {
  const run = makeRun("before-standard-you", 7);
  expect(validateRun(run)).toEqual([]);
  expect(createRoster(run)).toHaveLength(25);
  expect(run.profile.defile.cast).toBe(2);
  expect(run.profile.evidence["defile.cast"].status).toBe("documented");
  expect(createRoster(run).filter((a) => a.control === "player")).toHaveLength(
    1,
  );
});
it("rejects missing provenance and impossible event references", () => {
  const run = structuredClone(makeRun("before-standard-you", 7));
  delete run.profile.evidence["defile.radius"];
  expect(validateRun(run)).toContain("Missing evidence: defile.radius");
  run.scenario.events.push({
    id: "invalid",
    at: 1,
    checkpointId: "missing",
    kind: "pickup",
    actorId: "absent",
  });
  expect(validateRun(run)).toContain("Unknown checkpoint: missing");
  expect(validateRun(run)).toContain("Unknown actor: absent");
});
```

- [ ] **Step 2:** Run `pnpm exec vitest run --project unit src/features/raid-trainer/scenario-content.test.ts`; expect failure because exports do not exist.
- [ ] **Step 3:** Implement the contracts and rows above. Create all seven variants with two target cases. Give each a checkpoint at zero; add a later checkpoint only if it precedes every decision assessed by that event. Add the remaining validation tests: duplicate IDs, nonfinite/nonpositive geometry, reveal after resolution, unsupported family, events past the endpoint, missing profile, 2000-event limit and passengers that are controlled by the player. Use an explicit `throw new Error("Unknown scenario variant: " + variantId)` for invalid selection.

```ts
export const scenarioFamilies = [
  "before-valkyrs",
  "after-valkyrs",
  "vile-spirits",
  "frostmourne-return",
] as const;
export function sampleUnit(seed: number, actorIndex: number): number {
  let n = (seed ^ Math.imul(actorIndex + 1, 0x9e3779b9)) >>> 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  return (n >>> 0) / 4294967296;
}
```

Use this stateless helper privately for roster offsets and initial preferences. Generate 2 tanks (one assigned as soaker), 5 healers, 10 melee including `you`, and 8 ranged; IDs `you`, `tank`, `soaker`, and `raid-01` through `raid-22`. Use the existing class artwork and class colors: warrior tank, paladin soaker; priest/paladin/shaman/druid/priest healers; deathknight/rogue/warrior/paladin melee; mage/warlock/hunter/druid/shaman ranged. Cycle within those role-appropriate lists. Choose three free, non-tank NPC IDs as the authored passengers and keep their IDs stable within a variant. Scale radial starting offsets using the square root of the sampled distance for a uniform disk. Runtime stochastic choices use the saved RNG state, not this helper with changing wall time.

- [ ] **Step 4:** Record every numeric value, units and evidence in the calibration document, including that Vile Spirit contact radius is unverified. If a reviewed server capture becomes available, record its provenance and measurements; otherwise retain the explicit teaching labels. Do not claim a source measured these values.
- [ ] **Step 5:** Run the definition tests and `pnpm typecheck`; expect pass. Inspect the exact files and commit as `feat: define reusable raid training scenarios`.

### Task 2: Establish deterministic time and shared Defile behavior

**Files:** Create `scenario-runtime.ts`, `scenario-defile.ts`, `scenario-runtime.test.ts`, `scenario-defile.test.ts`, and `tests/support/raid-scenario.ts`.

**Interfaces:** Consume Task 1 definitions. Produce `createAttempt(run: RunSpec): Attempt`, `advanceAttempt(attempt: Attempt, seconds: number, input: Point): void`, and test helper `running(variantId: string, seed?: number, focus?: Focus): Attempt`. Internal mechanic exports: `startDefile(attempt: Attempt, event: Extract<ScriptEvent, {kind: "defile"}>): void` and `stepDefile(attempt: Attempt): void`.

- [ ] **Step 1: Add a runnable fixture and failing behavior tests.**

```ts
// tests/support/raid-scenario.ts
import type { Focus } from "../../src/features/raid-trainer/scenario-model";
import { makeRun } from "../../src/features/raid-trainer/scenario-content";
import { createAttempt } from "../../src/features/raid-trainer/scenario-runtime";
export function running(variantId: string, seed = 7, focus: Focus = "defile") {
  const attempt = createAttempt(makeRun(variantId, seed, focus));
  attempt.world.status = "running";
  return attempt;
}
```

```ts
import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
it("places Defile at resolution after the target has moved", () => {
  const attempt = running("before-standard-you");
  advanceAttempt(attempt, 8, { x: 0, y: 0 });
  advanceAttempt(attempt, 2, { x: 1, y: 0 });
  const you = attempt.world.actors.find((a) => a.id === "you")!;
  expect(attempt.world.pools[0].x).toBeCloseTo(you.x, 8);
  expect(attempt.world.pools[0].bornAt).toBe(10);
  expect(attempt.world.events.filter((e) => e.kind === "damage")).toHaveLength(
    0,
  );
});
it("keeps time identical across uneven frames", () => {
  const a = running("before-standard-you"),
    b = running("before-standard-you");
  advanceAttempt(a, 1, { x: 1, y: 1 });
  for (let i = 0; i < 144; i++) advanceAttempt(b, 1 / 144, { x: 1, y: 1 });
  expect(b.world).toEqual(a.world);
});
```

- [ ] **Step 2:** Run the two new unit files; expect missing runner exports, then meaningful behavioral failures.
- [ ] **Step 3:** Implement a fixed-step remainder accumulator and monotonic event IDs. Validate the run at creation. Sort due authored events by `(at, authoredIndex)` once; advance the cursor exactly once per event. Ignore nonfinite, nonpositive delta and advancement while paused/ready/countdown. The UI owns the countdown; it sets `world.status` to running when GO occurs. All 60 Hz steps run in the headless interface; the UI may clamp RAF deltas as it already does.

```ts
// Pool tick core, inside stepDefile after common hit detection.
const hit = attempt.world.actors.filter(
  (actor) =>
    actor.available &&
    !actor.carriedBy &&
    Math.hypot(actor.x - pool.x, actor.y - pool.y) < pool.radius + actor.radius,
);
pool.radius *= Math.pow(attempt.run.profile.defile.growthFactor, hit.length);
pool.growths += hit.length;
pool.nextTick += attempt.run.profile.defile.tick;
```

The surrounding implementation iterates existing pools, removes expired pools, emits one damage event per hit set, and does not loop actors while changing the radius. Assign `targetId` only at `revealAt`; issue distinct cast-start and target-reveal events. Resolve at the moving target's current coordinates. Do not apply six-tick artificial death. Until the assessment task lands, complete at the authored endpoint.

- [ ] **Step 4:** Add tests for reveal delay, first tick, expiry, multiple victims, actor-order independence, pause and negative delta. Use one-actor fixtures to isolate growth/expiry; do not weaken full-raid behavior to satisfy them. Run unit files and typecheck.
- [ ] **Step 5:** Commit explicit paths as `feat: run deterministic shared Defile mechanics`.

### Task 3: Resolve believable raid movement through one module

**Files:** Create `raid-strategy.ts`, `raid-strategy.test.ts`; modify `scenario-runtime.ts`.

**Interfaces:** `stepRaidMovement(attempt: Attempt, input: Point, dt: number): void` consumes observed mechanic state and strategy. It is the only voluntary position integrator. Internal `observeRaid(attempt: Attempt): void` updates saved `Mind.observed`; no presentation code reads or changes minds.

- [ ] **Step 1: Test reaction delay and route sharing.**

```ts
import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
it("does not let NPCs react to an unrevealed target", () => {
  const a = running("before-tight-neighbor");
  advanceAttempt(a, 8.05, { x: 0, y: 0 });
  expect(
    a.world.actors
      .filter((x) => x.mind)
      .every((x) => x.mind!.observed.targetIds.length === 0),
  ).toBe(true);
  advanceAttempt(a, 0.8, { x: 0, y: 0 });
  expect(a.world.actors.some((x) => x.mind?.observed.targetIds.length)).toBe(
    true,
  );
});
```

- [ ] **Step 2:** Run `pnpm exec vitest run --project unit src/features/raid-trainer/raid-strategy.test.ts`; ensure the observation deadline test fails against instant reaction behavior.
- [ ] **Step 3:** Update observations only at the actor's deadline and retain a copy of hazard positions/target identities. Consider the role, observed target, currently applicable formation and danger. Hold the route until `holdUntil` unless a newly observed hazard intersects it. Evaluate 16 candidate headings over the next 0.5 seconds and score goal distance, known hazard intersection, arena bounds and turn change. Use sorted candidate order and seeded initial direction for ties; no `Math.random()` or wall time.

```ts
// Voluntary integration, once per actor; forced passengers are excluded.
const dx = goal.x - actor.x,
  dy = goal.y - actor.y;
const length = Math.hypot(dx, dy);
const distance = Math.min(length, attempt.run.profile.runSpeed * dt);
if (length > 1e-8 && !actor.carriedBy) {
  actor.x += (dx / length) * distance;
  actor.y += (dy / length) * distance;
}
```

For player input, normalize the directional vector and integrate at the same run speed, preserving immediate control. Clamp voluntary movement to `arenaRadius - actor.radius`; record this as the drill's platform constraint. NPCs may choose a shared heading; never add repulsion that physically prevents overlapping friendly actors. Known danger outranks a formation goal except for an assigned protected soak. Being the Defile target temporarily replaces formation with a lateral drop/exit goal. Ordinary raiders retain the stack in `before-tight` and separate from the observed target as a group where needed. After pickups they may loosen and later rejoin. A pool along the direct path must cause a detour, not permanent oscillation.

- [ ] **Step 4:** Add fixtures that place two NPCs at adjacent points with the same preferred direction, test stable movement before commitment expires, test a role-specific soaker goal, and test a detour around a pool. Check diagonal player speed equals straight-line speed. Run the three runtime/mechanic/strategy unit files and typecheck.
- [ ] **Step 5:** Commit as `feat: coordinate raid movement with delayed reactions`.

### Task 4: Add Val’kyr support and tight event ordering

**Files:** Create `scenario-valkyrs.ts`, `scenario-valkyrs.test.ts`; modify `scenario-runtime.ts`, `scenario-content.ts`.

**Interfaces:** `stepValkyrs(attempt: Attempt, dt: number): void` handles forced carry only. Instantiate descending Val’kyrs at `pickupAt - profile.valkyrs.descent`; `applyPickup(attempt: Attempt, event: Extract<ScriptEvent, {kind: "pickup"}>): void` attaches an eligible passenger at the authored milestone.

- [ ] **Step 1: Test that a passenger receives only forced movement.**

```ts
import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
it("carries and releases an NPC without a second voluntary move", () => {
  const a = running("after-standard-you");
  advanceAttempt(a, 10, { x: 0, y: 0 });
  const valk = a.world.valkyrs.find((v) => v.state === "carrying")!;
  const actor = a.world.actors.find((x) => x.id === valk.passengerId)!;
  expect(actor.carriedBy).toBe(valk.id);
  expect({ x: actor.x, y: actor.y }).toEqual({ x: valk.x, y: valk.y });
  advanceAttempt(a, 5, { x: 0, y: 0 });
  expect(
    a.world.events.some(
      (e) => e.kind === "release" && e.actorIds.includes(actor.id),
    ),
  ).toBe(true);
});
```

- [ ] **Step 2:** Run `pnpm exec vitest run --project unit src/features/raid-trainer/scenario-valkyrs.test.ts`; expect absent lifecycle state.
- [ ] **Step 3:** Calculate the nearest radial edge destination from the actual pickup point. If exactly at centre, use the authored southward strategy direction. Keep three seconds of automated stun, then move at two yards/s. At eight seconds release the passenger at the current position and resume its normal observation/return logic. Reaching the edge before rescue emits `loss`, marks the actor unavailable and produces a truthful end reason when a required actor is lost. Never silently teleport a passenger back to its home.

```ts
const elapsed = attempt.world.elapsed;
if (valk.state === "carrying" && elapsed >= valk.releaseAt) {
  valk.state = "released";
  passenger.carriedBy = null;
  if (passenger.mind)
    passenger.mind.observeAt = elapsed + passenger.mind.reaction;
}
```

The runner order is: scheduled pickups/control effects; target reveal; observations; voluntary movement; forced movement; cast resolution/contact/ticks; assessment. At equal timestamps pickups occur before Defile target sampling, so passengers are excluded consistently. Each pickup also produces a formation milestone using the positions at that instant; Task 6 assesses the controlled actor's obligation at that milestone. The shipped content intentionally avoids an ambiguous equal-time ordering; a fixture still verifies the rule. Validate NPC-only victims and prohibit multiple concurrent carriers for an actor.

- [ ] **Step 4:** Test each before/after variant's event order, the immediate-after pickup case, no early NPC spreading in the tight-before case, edge loss and timed rescue. Run all scenario unit tests and typecheck.
- [ ] **Step 5:** Commit as `feat: train Defile around Val'kyr pickups`.

### Task 5: Add spirit pursuit, soaking, relocation and platform return

**Files:** Create `scenario-spirits.ts`, `scenario-spirits.test.ts`; modify runtime/content/raid strategy.

**Interfaces:** `spawnSpiritWave(attempt: Attempt, sourceId: string, origin: Point, firstBirthAt: number): void`, `stepSpirits(attempt: Attempt, dt: number): void`. `initialSpirits` calls the same spawning function with negative birth times; their existing age is preserved.

- [ ] **Step 1: Write the activation and explosion tests.**

```ts
import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
it("preserves pre-existing spirit ages in a shortened excerpt", () => {
  const a = running("spirits-moving-you");
  expect(a.world.spirits[0].bornAt).toBe(-24);
  advanceAttempt(a, 5.9, { x: 0, y: 0 });
  expect(a.world.spirits[0].targetId).toBeNull();
  advanceAttempt(a, 0.2, { x: 0, y: 0 });
  expect(a.world.spirits[0].targetId).not.toBeNull();
});
```

- [ ] **Step 2:** Run the spirit unit file and observe the missing lifecycle failure.
- [ ] **Step 3:** Select each spirit's target from available, non-carried ordinary raiders at activation. Use actor IDs in stable order and saved RNG. Move toward its current target, retarget only when the target becomes unavailable, and trigger on first contact with any eligible actor. Resolve swept-segment contact so a moving spirit cannot tunnel through a soaker between frames. Burst at the contact position, hit all nearby actors once, record protected soaker exposure separately, and retain the exploded visual for 0.6 seconds. Expired unresolved spirits end the drill with `spirit-unresolved`.

```ts
// Circle membership for explosion victims, measured from contact position.
const affected = attempt.world.actors.filter(
  (a) =>
    a.available &&
    !a.carriedBy &&
    Math.hypot(a.x - contact.x, a.y - contact.y) <=
      attempt.run.profile.spirits.burstRadius + a.radius,
);
const protectedIds = affected
  .filter((a) => a.role === "soaker")
  .map((a) => a.id);
```

On `relocate`, update the shared strategy stage and anchor rather than moving actors instantly. The soaker heads to the intercept anchor and can make small interception corrections while staying clear of the raid. `return` is a recorded scenario event at zero: show a brief return visual and normal target warnings; do not add an extra frozen countdown after the exercise starts. A new wave at ten seconds uses full thirty-second activation ages rather than accelerated spirits.

- [ ] **Step 4:** Test protected soaker plus unprotected nearby player, one explosion per spirit, tunneling, actor-order independence, unavailable-target replacement, relocation while Defile is active, and the return wave activating at forty seconds. Run scenario unit tests and typecheck.
- [ ] **Step 5:** Commit as `feat: share Defile with spirit relocation scenarios`.

### Task 6: Assess obligations without confusing exposure and death

**Files:** Create `scenario-assessment.ts`, `scenario-assessment.test.ts`; modify runtime.

**Interfaces:** `assessStep(attempt: Attempt, newEvents: readonly WorldEvent[]): void`; `summarizeAttempt(attempt: Attempt): { outcome: "clean" | "imperfect" | "failed"; primary: Finding[]; supporting: Finding[]; endReason: World["endReason"] }`.

- [ ] **Step 1: Test focus-independent world and focus-dependent findings.**

```ts
import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
import { summarizeAttempt } from "./scenario-assessment";
it("does not change the world when the training focus changes", () => {
  const a = running("spirits-settled-you", 3, "defile");
  const b = running("spirits-settled-you", 3, "vile-spirits");
  advanceAttempt(a, 16, { x: 0, y: 0 });
  advanceAttempt(b, 16, { x: 0, y: 0 });
  expect(a.world).toEqual(b.world);
  expect(
    summarizeAttempt(a).primary.every((f) => f.mechanic === "defile"),
  ).toBe(true);
  expect(
    summarizeAttempt(b).primary.every((f) => f.mechanic === "vile-spirits"),
  ).toBe(true);
});
```

- [ ] **Step 2:** Run assessment tests; expect the summarizer export failure, then verify real category differences with deterministic exposure fixtures.
- [ ] **Step 3:** Emit idempotent findings keyed by `(eventId, actorId, code)`. Formation events snapshot applicable obligations: exempt current passengers, the actor targeted by an unresolved/recent pool, and an actor whose observed immediate hazard makes the formation unsafe. Exemptions expire when the hazard is cleared, not at an arbitrary universal delay. Record the reason instead of silently omitting it.

```ts
export function summarizeAttempt(attempt: Attempt) {
  const misses = attempt.findings.filter((f) => f.severity === "miss");
  return {
    outcome:
      attempt.world.status === "failed"
        ? ("failed" as const)
        : misses.length
          ? ("imperfect" as const)
          : ("clean" as const),
    primary: attempt.findings.filter((f) => f.mechanic === attempt.run.focus),
    supporting: attempt.findings.filter(
      (f) => f.mechanic !== attempt.run.focus,
    ),
    endReason: attempt.world.endReason,
  };
}
```

For route overlap, measure circle-to-segment distance against the strategy's travel corridor including its half-width. Use copy “pool overlapped the planned route”; do not call a route blocked based on intersection alone. For platform-unusable termination, sample a 1-yard navigable grid inside the platform and flood-fill from the controlled actor's nearest reachable clear cell; only terminate when no reachable clear cell exists. Reuse this grid for the optional route-blocked finding if needed; the first version need only report overlap.

- [ ] **Step 4:** Test idle edge camping fails a formation objective, target/passenger exemption, protected soaking excluded from accidental exposure, raid-only Defile damage, no death at six ticks, recovery after a hit, and an entire-platform pool. Run scenario unit tests and typecheck.
- [ ] **Step 5:** Commit as `feat: explain primary and supporting raid mistakes`.

### Task 7: Record complete checkpoints and repeatable variation selection

**Files:** Create `scenario-recording.ts`, `scenario-recording.test.ts`; modify content.

**Interfaces:** `createRecording(): Recording`, `recordStep(recording: Recording, attempt: Attempt): void`, `restoreCheckpoint(run: RunSpec, checkpoint: Checkpoint): Attempt`, `resumePractice(run: RunSpec, recording: Recording, checkpointId: string): {attempt: Attempt; recording: Recording}`, `frameView(recording: Recording, index: number): World`, and `nextRun(current: RunSpec, family: Family | "mixed", variationIndex: number): RunSpec`.

- [ ] **Step 1: Test that replay restoration includes delayed NPC decisions.**

```ts
import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
import {
  createRecording,
  recordStep,
  restoreCheckpoint,
} from "./scenario-recording";
it("resumes the exact scenario from a saved decision checkpoint", () => {
  const a = running("spirits-moving-neighbor", 19);
  const recording = createRecording();
  recordStep(recording, a);
  const id = a.run.scenario.checkpoints[0].id;
  const b = restoreCheckpoint(a.run, recording.checkpoints[id]);
  b.world.status = "running";
  advanceAttempt(a, 12, { x: 1, y: 0 });
  advanceAttempt(b, 12, { x: 1, y: 0 });
  expect(b.world).toEqual(a.world);
  expect(b.rngState).toBe(a.rngState);
});
```

- [ ] **Step 2:** Run recording tests and observe absent checkpoint behavior.
- [ ] **Step 3:** Store events/findings once in recording logs; frames hold counts and the world without cumulative logs. Capture every sixth step, every new event, every checkpoint and every terminal state. Complete checkpoints include RNG, script cursor, actor minds, hazards, carriers, strategy stage and assessment history. Restore into countdown status with zero wall-time remainder; resuming starts from that exact simulation step.

```ts
export function frameView(recording: Recording, index: number): World {
  const frame = recording.frames[index];
  if (!frame) throw new Error("Replay frame is unavailable");
  return structuredClone({
    ...frame.world,
    events: recording.events.slice(0, frame.eventCount),
  });
}
```

Use scenario ID plus both revisions to reject incompatible checkpoints. Event seek uses immutable ID, not timestamp/kind matching. Keep 10 Hz history bounded to 60 seconds, plus at most one extra capture per simulation step. On recording overflow, pause/end with `recording-limit` and a visible interruption message instead of silently truncating a replay claimed complete. For Mixed practice, cycle the four family IDs using `variationIndex % 4`; within the selected family cycle supported variant IDs and target cases. Use a new seed derived from the current seed and variation index. Retry does not increment variation index or change seed.

Practicing a checkpoint creates a recording branch with no stale future events. Keep that truncation inside the recording module:

```ts
export function resumePractice(
  run: RunSpec,
  recording: Recording,
  checkpointId: string,
) {
  const checkpoint = recording.checkpoints[checkpointId];
  if (!checkpoint) throw new Error("Practice checkpoint is unavailable");
  const attempt = restoreCheckpoint(run, checkpoint);
  const elapsed = checkpoint.world.elapsed;
  return {
    attempt,
    recording: structuredClone({
      frames: recording.frames.filter(
        (frame) => frame.world.elapsed <= elapsed,
      ),
      events: checkpoint.world.events,
      findings: checkpoint.findings,
      checkpoints: Object.fromEntries(
        Object.entries(recording.checkpoints).filter(
          ([, value]) => value.world.elapsed <= elapsed,
        ),
      ),
    }),
  };
}
```

- [ ] **Step 4:** Test checkpoint at a nonzero time with an active pool and a carried NPC; test revisions mismatch, event IDs surviving clones, frame bounds, start/end seeks, removal of future events when branching practice, repeat/new seed separation and all four families visited before repetition. Run scenario unit tests and typecheck.
- [ ] **Step 5:** Commit as `feat: replay and retry complete encounter situations`.

### Task 8: Derive safe HUD, cue and audio views

**Files:** Create `scenario-view.ts`, `scenario-view.test.ts`; modify `audio-cues.ts`, `audio-cues.test.ts`.

**Interfaces:** `readAttempt(attempt: Attempt): View`, `readWorldView(run: RunSpec, world: World, findings: Finding[]): View`, and `scenarioAudioCues(before: View, after: View): AudioCue[]` where `AudioCue` is the existing exported union.

- [ ] **Step 1: Test target secrecy and supporting danger visibility.**

```ts
import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
import { readAttempt } from "./scenario-view";
it("shows both mechanic timers without revealing the Defile target early", () => {
  const a = running("before-tight-you");
  advanceAttempt(a, 8.05, { x: 0, y: 0 });
  const view = readAttempt(a);
  expect(view.world.casts[0].targetId).toBeNull();
  expect("targetCase" in view.world.casts[0]).toBe(false);
  expect("mind" in view.world.actors[0]).toBe(false);
  expect(view.timers.some((t) => t.mechanic === "defile")).toBe(true);
  expect(view.timers.some((t) => t.mechanic === "valkyrs")).toBe(true);
  expect(view.cue?.title).not.toContain("on you");
});
```

- [ ] **Step 2:** Run the view and audio tests, ensuring early-warning failures are observable.
- [ ] **Step 3:** Build a cloned `PublicWorld` that omits NPC minds, cast target-case configuration and future-born spirits from the render path. The renderer receives only observable positions/targets through `View`; it must not inspect the run definition to reveal hidden targets. Show one next timer per active mechanic, plus an active cast timer. Derive actual time remaining from authored/resolved events, never a second interval. Cast start and target reveal remain separate; voice target cues play only on reveal. Supporting explosions outrank advance coaching, then player targeting, nearby teammate targeting, then formation coaching. In Timers mode remove advance tutorial instructions but retain all active hazard and target warnings.

```ts
// Existing samples are reused; no new spoken phrases are implied.
const fresh = after.world.events.filter(
  (e) => !before.world.events.some((old) => old.id === e.id),
);
const cues: AudioCue[] = [];
if (fresh.some((e) => e.kind === "target" && e.actorIds.includes("you")))
  cues.push("target");
else if (fresh.some((e) => e.kind === "target")) cues.push("other");
if (
  fresh.some(
    (e) =>
      (e.kind === "damage" || e.kind === "explosion") &&
      e.actorIds.includes("you") &&
      !e.protectedActorIds.includes("you"),
  )
)
  cues.push("damage");
return cues;
```

Add completion/failure, countdown, pool and guided regroup behavior around this event selection. Allow multiple relevant cue types in a frame, but coalesce duplicate damage ticks into one cue. Preserve the audio engine's cancellation token, pause silence and muted replay default.

- [ ] **Step 4:** Test live/replay event cues, no new target spoilers, timer/state synchronization through a delayed event, guided-versus-timers world equality and fast replay crossing multiple events. Run view/audio unit tests and typecheck.
- [ ] **Step 5:** Commit as `feat: show contextual raid timers and warnings`.

### Task 9: Render overlapping mechanics in the approved scene

**Files:** Create `render-scenario.ts`; modify `arena-assets.ts`, `public/raid-trainer/credits.txt`; create `public/raid-trainer/art/valkyr.svg`, `public/raid-trainer/art/vile-spirit.svg`; add `tests/experiments/raid-trainer-scenario-render.browser.mjs`.

**Interfaces:** `drawScenario(canvas: HTMLCanvasElement, run: RunSpec, view: View, options: ScenarioRenderOptions): void`; use the declared scenario render options instead of altering the old renderer's type while it still runs. A highlighted event without a position receives an inspector entry but no arena bubble. `prepareScenarioAssets(run: RunSpec): Promise<void>` shares the existing decoded-image cache and timeout/cancellation handling.

- [ ] **Step 1:** Create a browser rendering fixture using the existing Playwright/Next tooling. Drive representative world states through the real renderer and capture live targeting, a carried passenger, spirit interception, return, 25-player stack and replay overlays. Assert no missing required images and no page errors; use screenshots for visual checks, not pixel snapshots for continuously moving actors.
- [ ] **Step 2:** Run the fixture and record that new mechanic states do not yet render.
- [ ] **Step 3:** Reuse the approved artwork and camera proportions. Map world yards to the 840px scene; keep boss/player portrait dimensions in display pixels while hazard radii use world scaling.

```ts
const scale = (840 * 0.82) / (2 * run.profile.arenaRadius);
const toScene = (p: Point) => ({ x: 420 + p.x * scale, y: 420 + p.y * scale });
```

Extract the existing arena/base token drawing into this renderer with minimal stylistic change. Draw hazards first, ordinary NPCs second, important actors third and callouts last. De-emphasize ordinary labels while stacked, but always identify YOU, target, soaker and marker. Do not displace physics positions to make the circles readable. Use small restrained local SVG silhouettes for a winged carrier and a spirit, authored in the existing cyan/gold palette; record them as original app artwork. Keep the boss/class portraits unchanged. Show spirit activation with a restrained change of opacity, pursuit with direction, and explosion with its actual 5-yard circle for 0.6 seconds. Draw Val’kyr descent/carry/release and a brief return ring. In replay, show selected actor paths from recorded frames; never regenerate motion from current AI.

- [ ] **Step 4:** Run the render fixture at 1440×900 and 390×844. Inspect it against Paper page 18/19 and the previous state audit. Retain black `#07080A`, attached flat timer icons, compact replay transport, top vignette and visible keycaps.
- [ ] **Step 5:** Commit as `feat: render coordinated raid mechanics`.

### Task 10: Connect setup, controller, results and replay

**Files:** Modify `training-catalog.ts`, `TrainerSetup.tsx`, `TrainerExperiment.tsx`, `use-trainer.ts`, `GameReview.tsx`, `GameReview.test.tsx`, `trainer-setup.css`, `trainer.css`, `practice-state.ts`, `replay.ts`, and their tests; create `tests/e2e/raid-trainer-scenarios.spec.ts`.

**Interfaces:** Catalogue drills expose `focus: Focus`, `families: readonly Family[]` and default selection metadata. `TrainerSetup.onStart` receives `RunSpec` instead of the old complete `EncounterDefinition`. `useTrainer(run: RunSpec, initialPreferences, onPreferencesChange, autoStart)` retains current controls and adds `newVariation()`. Public state becomes `View` plus the existing countdown/replay/preferences fields. `start()` now means retry the same run after the first start; `newVariation()` changes it explicitly.

- [ ] **Step 1: Add the browser flow before integration.**

```ts
import { expect, test } from "@playwright/test";
test("starts a selected scenario with one Start action", async ({ page }) => {
  await page.goto("/raid-trainer");
  await page.getByRole("combobox", { name: "Scenario" }).click();
  await page
    .getByRole("option", { name: "Defile during Vile Spirits", exact: true })
    .click();
  await expect(
    page.getByText("Also active: Vile Spirits", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(page.locator(".rt-game")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cancel pull/ })).toBeVisible();
});
```

- [ ] **Step 2:** Run `pnpm exec playwright test tests/e2e/raid-trainer-scenarios.spec.ts`; expect the scenario selector to be absent.
- [ ] **Step 3:** Add the compact selector with existing `Select`/`SelectOption`, defaulting to Mixed practice; selected-family copy explains supporting mechanics and actual excerpt duration. Bind the chosen run once at Start, validate it, preload all required assets, then enter focus. Preserve preparation request IDs, cancel/error/retry and focus restoration. Do not add a second required Ready approval.

```tsx
<Select
  aria-label="Scenario"
  value={family}
  onValueChange={(value) => setFamily(value as Family | "mixed")}
>
  <SelectOption value="mixed">Mixed practice</SelectOption>
  <SelectOption value="before-valkyrs">Defile before Val’kyrs</SelectOption>
  <SelectOption value="after-valkyrs">
    Defile after Val’kyr pickups
  </SelectOption>
  <SelectOption value="vile-spirits">Defile during Vile Spirits</SelectOption>
  <SelectOption value="frostmourne-return">
    Defile after Frostmourne return
  </SelectOption>
</Select>
```

Here `family` is React state typed `Family | "mixed"` and initialized to `"mixed"`. The selected family picks the first authored variant; Mixed uses the session's variation index. Detailed scope says NPCs handle support, the player is not selected for Val’kyr pickup, and this is a positioning practice profile. Remove misleading Wrath Classic edition text for this profile.

- [ ] **Step 4:** Connect the hook to one Attempt, Recording and View. Run `recordStep` on each fixed step via an optional `afterStep?: (attempt: Attempt) => void` parameter added to `advanceAttempt` in this task; prior calls remain valid. Preserve clear-held-keys, focus pause, cancellation, countdown and audio lifecycle. Ready/retry/new variation all focus the canvas. Do not let R, Space or Enter hijack a select/dialog/control.
- [ ] **Step 5:** Adapt `GameReview` to the new assessment and immutable event IDs. Keep the exact approved transport. Show focus findings and supporting findings separately, use the actual end reason, retain clean/imperfect/recovered states, and remove the fabricated “six ticks means death” copy. “Practice this moment” calls `resumePractice` and replaces both the attempt and recording; “New variation” is secondary to Retry. Timeline includes relevant pickup/return/explosion markers while preserving cast/placement/damage identities. Existing event legend can stay absent as approved; accessible marker labels identify event types.
- [ ] **Step 6:** Add unit/UI tests for clean Defile plus spirit exposure, no-primary-hit replay, invalid profile setup error and corrupted checkpoint fallback to same-scenario retry. Add browser checks for all family options, supporting timers, same-seed retry, new variation, focus pause, ready/countdown/cancel, guide/audio fallback, touch movement and replay seek/speeds.
- [ ] **Step 7:** Run `pnpm exec vitest run --project unit --project ui src/features/raid-trainer` and `pnpm exec playwright test tests/e2e/raid-trainer-scenarios.spec.ts`; run typecheck. Commit as `feat: launch and review contextual raid training`.

### Task 11: Verify complete scenarios and remove superseded runtime code

**Files:** Modify `tests/e2e/raid-trainer-game.spec.ts`, `tests/e2e/raid-trainer-setup.spec.ts`, `tests/experiments/raid-trainer.audio.browser.mjs`, `docs/design/raid-trainer-paper-state-audit.md`, `docs/design/raid-trainer-gameplay-calibration.md`, `docs/design/raid-trainer-immersive-implementation.md`; remove obsolete `simulation.ts`, `mechanics.ts`, `movement.ts`, `encounters.ts`, `render-arena.ts` and old model/runtime exports only after all imports migrate. If the introductory preset remains, express it as scenario data through the new engine; do not retain a second engine for it.

**Interfaces:** No new public interfaces. Preserve the new runtime/view contracts and all user-visible controls.

- [ ] **Step 1:** Port the original behavior coverage before removing old tests: fixed-step equality, cast-at-resolution placement, pool ticks/expiry, pause, asset cancellation, audio race cancellation, exact checkpoint, responsive replay and keyboard/touch focus. Do not keep assertions that the newly replaced drill always lasts 57 seconds or always ends after six hits.
- [ ] **Step 2:** Create a deterministic success input trace for each variant/target case and keep its explicit timestamped directions in `tests/support/raid-scenario.ts`. Derive these by playing the rules, not by making the player immune or moving world actors from the test. Re-run each trace with identical seed, then with another supported NPC variation. Maintain separate failure traces for stack camping, following a target, route overlap and spirit exposure. A failure to find any successful ordinary-movement trace is a scenario-design defect, not grounds to weaken its assertions.

```ts
export type InputSegment = {
  seconds: number;
  direction: { x: number; y: number };
};
// Trace playback exercises the same interface as real input.
export function playTrace(attempt: Attempt, trace: readonly InputSegment[]) {
  for (const segment of trace)
    advanceAttempt(attempt, segment.seconds, segment.direction);
}
```

The helper imports `Attempt` and `advanceAttempt` from the new modules. Actual success traces are recorded during execution after movement is available; their measured content cannot be invented in this plan. Committing the trace data and demonstrating the successful outcomes is the deliverable of this step.

- [ ] **Step 3:** Capture every approved state at 1440×900, then live/replay at 390×844, 800×650 and 1100×650. Check attached flat timers, top vignette, keycaps, compact replay panel, no overlapping controls, 25-player legibility and body `#07080A`. Capture new mechanics at pickup, carry, release, spirit activation, contact/burst and return. Save captures to `.cache/raid-trainer/scenarios/` and update the state audit with evidence and intentional dynamic differences.
- [ ] **Step 4:** Run the final checks below. Inspect failures before fixes; do not repeatedly broaden testing after successful checks without a new change or concern.

```bash
pnpm exec vitest run --project unit --project ui src/features/raid-trainer
pnpm exec playwright test tests/e2e/raid-trainer-game.spec.ts tests/e2e/raid-trainer-setup.spec.ts tests/e2e/raid-trainer-scenarios.spec.ts
node tests/experiments/raid-trainer.audio.browser.mjs
pnpm typecheck
pnpm exec eslint src/features/raid-trainer tests/e2e/raid-trainer-game.spec.ts tests/e2e/raid-trainer-setup.spec.ts tests/e2e/raid-trainer-scenarios.spec.ts tests/support/raid-scenario.ts
pnpm exec prettier --check src/features/raid-trainer tests/e2e/raid-trainer-scenarios.spec.ts tests/support/raid-scenario.ts
```

- [ ] **Step 5:** Search imports before deleting obsolete files using `rg` scoped to `src/features/raid-trainer` and tests. Replace remaining old display option types with `ScenarioRenderOptions`, update tests and rerun affected checks. Update credits/calibration docs and explicitly report which rules remain teaching approximations. Commit only this task's paths as `refactor: finish shared raid scenario migration`.

## Plan self-review and spec coverage

| Spec requirement                                                         | Delivery                     |
| ------------------------------------------------------------------------ | ---------------------------- |
| Shared profile/mechanics/strategy/scenario/drill contracts and 25 actors | Task 1                       |
| Concrete parameters, evidence, invalid definition handling               | Task 1 and calibration table |
| One deterministic simulation, no old fixed targets or six-hit death      | Tasks 2 and 6                |
| Purposeful NPCs, observations, shared paths, role exceptions             | Task 3                       |
| Before/after pickups and tight overlaps                                  | Task 4                       |
| Spirit relocation, protected soaking and return excerpt                  | Task 5                       |
| Primary/supporting results and truthful findings                         | Task 6                       |
| Complete replay/checkpoints, same retry/new variation                    | Task 7                       |
| Supporting timers, target secrecy, audio and guided/timers separation    | Task 8                       |
| Paper appearance, new mechanic visuals and legibility                    | Task 9                       |
| One Start action, simple scenario selector and every lifecycle state     | Task 10                      |
| Successful traces, all-state visual QA and one final runtime             | Task 11                      |

Self-review must check contract names across tasks, especially `readAttempt`, `RunSpec`, event IDs versus source IDs, the optional runner callback introduced in Task 10, and `Frame` excluding cumulative logs. Unverified exact-server fidelity remains explicitly outside the first profile's claim; the plan includes complete practice values rather than leaving missing runtime parameters.

## Execution handoff

Plan creation changes only documentation. Choose subagent-driven execution with one bounded task and review at a time, or inline execution using executing-plans. There are sequential dependencies between these tasks; do not run neighboring tasks concurrently against shared runtime files. Preserve the user's current working trainer when establishing the execution checkout.
