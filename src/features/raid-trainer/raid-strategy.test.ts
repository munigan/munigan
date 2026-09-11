import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import type { Attempt } from "./scenario-model";
import { advanceAttempt } from "./scenario-runtime";

const still = { x: 0, y: 0 };
function npcOnly(variant = "before-tight-neighbor") {
  const a = running(variant);
  a.run.scenario.events = [];
  a.world.actors = a.world.actors.filter((actor) => actor.id === "raid-06");
  return a;
}
function pool(a: Attempt, x: number, y: number, radius = 5) {
  a.world.pools.push({
    id: "obstacle",
    x,
    y,
    radius,
    targetId: "you",
    bornAt: 0,
    expiresAt: 60,
    nextTick: 60,
    growths: 0,
  });
}

it("does not observe an unrevealed target and then responds after reveal", () => {
  const a = running("before-tight-neighbor");
  advanceAttempt(a, 8.05, still);
  expect(
    a.world.actors
      .filter((x) => x.mind)
      .every((x) => x.mind!.observed.targetIds.length === 0),
  ).toBe(true);
  advanceAttempt(a, 0.8, still);
  expect(a.world.actors.some((x) => x.mind?.observed.targetIds.length)).toBe(
    true,
  );
});

it("retains the old perception until the actor's reaction deadline", () => {
  const a = npcOnly();
  const actor = a.world.actors[0];
  actor.mind!.reaction = 0.65;
  pool(a, 10, 8);
  advanceAttempt(a, 0.6, still);
  expect(actor.mind!.observed.hazards).toEqual([]);
  advanceAttempt(a, 0.1, still);
  expect(actor.mind!.observed.hazards).toMatchObject([{ x: 10, y: 8 }]);
  a.world.pools[0].x = 20;
  advanceAttempt(a, 0.1, still);
  expect(actor.mind!.observed.hazards[0].x).toBe(10);
});

it("lets adjacent raiders share a committed heading without body blocking", () => {
  const a = npcOnly();
  const actor = a.world.actors[0];
  actor.x = -10;
  actor.y = 8;
  Object.assign(actor.mind!, {
    goal: { x: 10, y: 8 },
    holdUntil: 2,
    decideAt: 0,
  });
  const other = structuredClone(actor);
  other.id = "adjacent";
  other.x += 0.1;
  a.world.actors.push(other);
  advanceAttempt(a, 0.4, still);
  expect(actor.x).toBeCloseTo(-7.2, 8);
  expect(other.x - actor.x).toBeCloseTo(0.1, 8);
  expect(actor.y).toBe(8);
});

it("sends the assigned soaker to the intercept while ordinary raiders stay stacked", () => {
  const a = running("spirits-settled-you");
  a.run.scenario.events = [];
  const soaker = a.world.actors.find((x) => x.role === "soaker")!;
  soaker.y = 0;
  advanceAttempt(a, 4, still);
  expect(Math.hypot(soaker.x, soaker.y - 9)).toBeLessThan(0.5);
  const ordinary = a.world.actors.filter(
    (x) => x.mind && x.role !== "soaker" && x.role !== "tank",
  );
  expect(ordinary.every((x) => Math.hypot(x.x, x.y - 22) <= 2)).toBe(true);
});

it("detours around a known pool and reaches formation without oscillating", () => {
  const a = npcOnly();
  const actor = a.world.actors[0];
  actor.x = -15;
  actor.y = 8;
  actor.mind!.goal = { x: -15, y: 8 };
  pool(a, -7, 8, 3);
  let nearest = Infinity;
  advanceAttempt(a, 7, still, () => {
    nearest = Math.min(nearest, Math.hypot(actor.x + 7, actor.y - 8));
  });
  expect(nearest).toBeGreaterThanOrEqual(3.35);
  expect(Math.hypot(actor.x, actor.y - 8)).toBeLessThan(2);
});

it("abandons a committed unsafe route only after observing the new pool", () => {
  const a = npcOnly();
  const actor = a.world.actors[0];
  actor.x = -10;
  actor.y = 8;
  Object.assign(actor.mind!, {
    reaction: 0.2,
    goal: { x: 10, y: 8 },
    holdUntil: 3,
  });
  pool(a, -5, 8, 2);
  advanceAttempt(a, 0.15, still);
  expect(actor.y).toBe(8);
  advanceAttempt(a, 0.3, still);
  expect(Math.abs(actor.y - 8)).toBeGreaterThan(0.2);
});

it("keeps moving through a targeted NPC's drop and escapes before its first tick", () => {
  const a = running("before-tight-neighbor");
  advanceAttempt(a, 12, still);
  const cast = a.world.casts[0];
  const target = a.world.actors.find((x) => x.id === cast.targetId)!;
  expect(
    a.world.events.filter(
      (x) => x.kind === "damage" && x.actorIds.includes(target.id),
    ),
  ).toEqual([]);
  expect(a.world.pools[0].radius).toBe(5);
  const ordinary = a.world.actors.filter(
    (x) => x.mind && x.id !== target.id && x.role !== "tank",
  );
  expect(ordinary.every((x) => Math.hypot(x.x, x.y - 8) <= 2)).toBe(true);
  advanceAttempt(a, 7, still);
  expect(Math.hypot(target.x, target.y - 8)).toBeLessThan(2);
});

it("normalizes diagonal player motion and clamps to the playable platform", () => {
  const straight = running("before-tight-you");
  const diagonal = structuredClone(straight);
  for (const a of [straight, diagonal]) {
    a.run.scenario.events = [];
    const you = a.world.actors.find((x) => x.id === "you")!;
    you.x = 0;
    you.y = 0;
  }
  advanceAttempt(straight, 1, { x: 1, y: 0 });
  advanceAttempt(diagonal, 1, { x: 1, y: 1 });
  const you = diagonal.world.actors.find((x) => x.id === "you")!;
  expect(Math.hypot(you.x, you.y)).toBeCloseTo(7, 8);
  expect(straight.world.actors.find((x) => x.id === "you")!.x).toBeCloseTo(
    7,
    8,
  );
  advanceAttempt(diagonal, 10, { x: 1, y: 1 });
  expect(Math.hypot(you.x, you.y)).toBeCloseTo(44.65, 8);
});

it("never integrates voluntary motion for a carried or unavailable actor", () => {
  const a = npcOnly();
  const actor = a.world.actors[0];
  actor.x = 0;
  actor.y = 0;
  actor.carriedBy = "carrier";
  actor.mind!.goal = { x: 20, y: 20 };
  advanceAttempt(a, 1, still);
  expect({ x: actor.x, y: actor.y }).toEqual({ x: 0, y: 0 });
  actor.carriedBy = null;
  actor.available = false;
  advanceAttempt(a, 1, still);
  expect({ x: actor.x, y: actor.y }).toEqual({ x: 0, y: 0 });
});

it("restores pending perceptions and committed routes deterministically", () => {
  const a = running("before-tight-neighbor", 19);
  advanceAttempt(a, 8.3, still);
  const restored = structuredClone(a);
  advanceAttempt(a, 4, still);
  for (let i = 0; i < 240; i++) advanceAttempt(restored, 1 / 60, still);
  expect(restored.world).toEqual(a.world);
  expect(restored.rngState).toBe(a.rngState);
  expect(restored.cursor).toBe(a.cursor);
  expect(
    a.world.actors.every((actor) => (actor.mind?.pending?.length ?? 0) <= 3),
  ).toBe(true);
});

it("reacts to a revealed target only after that actor's own delay", () => {
  const a = running("before-tight-you");
  const actor = a.world.actors.find((x) => x.id === "raid-06")!;
  actor.mind!.reaction = 0.65;
  advanceAttempt(a, 8.7, still);
  expect(actor.mind!.observed.targetIds).toEqual([]);
  advanceAttempt(a, 0.55, still);
  expect(actor.mind!.observed.targetIds).toEqual(["you"]);
});

it("lets only the assigned soaker approach a protected spirit and still avoids pools", () => {
  const a = npcOnly("spirits-settled-you");
  const actor = a.world.actors[0];
  actor.role = "soaker";
  actor.x = 0;
  actor.y = 0;
  actor.mind!.goal = { x: 0, y: 0 };
  a.world.spirits.push({
    id: "active",
    x: 0,
    y: 9,
    bornAt: -30,
    activeAt: 0,
    expiresAt: 60,
    explodedAt: null,
    targetId: null,
  });
  advanceAttempt(a, 3, still);
  expect(Math.hypot(actor.x, actor.y - 9)).toBeLessThan(0.5);
  pool(a, 0, 9, 2);
  advanceAttempt(a, 2, still);
  expect(Math.hypot(actor.x, actor.y - 9)).toBeGreaterThan(2.35);
});

it("loosens after the last pickup then returns before the formation check", () => {
  const a = running("after-tight-you");
  a.run.scenario.events = [];
  advanceAttempt(a, 11, still);
  const ordinary = a.world.actors.filter((x) => x.mind && x.role !== "tank");
  expect(ordinary.every((x) => Math.hypot(x.x, x.y - 8) >= 3.9)).toBe(true);
  advanceAttempt(a, 9, still);
  expect(ordinary.every((x) => Math.hypot(x.x, x.y - 8) <= 2)).toBe(true);
});

it("relocates raiders to the authored destination with the tank toward incoming spirits", () => {
  const a = running("spirits-moving-you");
  a.run.scenario.events = [];
  advanceAttempt(a, 16, still);
  const tank = a.world.actors.find((x) => x.role === "tank")!;
  expect(Math.hypot(tank.x, tank.y - 18)).toBeLessThan(0.5);
  const ordinary = a.world.actors.filter(
    (x) => x.mind && x.role !== "tank" && x.role !== "soaker",
  );
  expect(ordinary.every((x) => Math.hypot(x.x, x.y - 22) <= 2)).toBe(true);
});

it("drops laterally along the target’s current row during relocation", () => {
  const a = running("spirits-moving-neighbor");
  advanceAttempt(a, 9.2, { x: 0, y: 1 });
  const target = a.world.actors.find(
    (actor) => actor.id === a.world.casts[0].targetId,
  )!;
  const startY = target.y;
  advanceAttempt(a, 0.7, still);
  expect(target.y).toBeCloseTo(startY, 8);
});

it("retains the tight stack during the neighbor's lateral drop and first pickup", () => {
  const a = running("before-tight-neighbor");
  advanceAttempt(a, 8, still);
  let furthest = 0;
  advanceAttempt(a, 2.5, still, () => {
    const target = a.world.casts[0].targetId;
    for (const actor of a.world.actors.filter(
      (x) => x.mind && x.id !== target && x.role !== "tank",
    )) {
      furthest = Math.max(furthest, Math.hypot(actor.x, actor.y - 8));
    }
  });
  expect(furthest).toBeLessThanOrEqual(2);
});
