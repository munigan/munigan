import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { stepDefile } from "./scenario-defile";
import { advanceAttempt } from "./scenario-runtime";

const still = { x: 0, y: 0 };
function isolated() {
  const attempt = running("frostmourne-return-you");
  attempt.world.actors = attempt.world.actors.filter(
    (actor) => actor.id === "you",
  );
  return attempt;
}

it("places Defile after the target's final movement step at resolution", () => {
  const attempt = running("before-standard-you");
  advanceAttempt(attempt, 8, still);
  const initialX = attempt.world.actors.find((actor) => actor.id === "you")!.x;
  advanceAttempt(attempt, 2, { x: 1, y: 0 });
  const you = attempt.world.actors.find((actor) => actor.id === "you")!;
  expect(you.x).toBeCloseTo(initialX + 14, 8);
  expect(attempt.world.pools[0].x).toBeCloseTo(you.x, 8);
  expect(attempt.world.pools[0].bornAt).toBe(10);
  expect(
    attempt.world.events.filter((event) => event.kind === "damage"),
  ).toHaveLength(0);
});

it("does not assign or publish the target until the reveal delay elapses", () => {
  const attempt = running("before-standard-you");
  advanceAttempt(attempt, 8, still);
  expect(attempt.world.casts[0].targetId).toBeNull();
  expect(
    attempt.world.events.filter((event) => event.kind === "cast"),
  ).toMatchObject([{ at: 8, actorIds: [] }]);
  advanceAttempt(attempt, 5 / 60, still);
  expect(attempt.world.casts[0].targetId).toBeNull();
  expect(
    attempt.world.events.filter((event) => event.kind === "target"),
  ).toHaveLength(0);
  advanceAttempt(attempt, 1 / 60, still);
  expect(attempt.world.casts[0].targetId).toBe("you");
  expect(
    attempt.world.events.filter((event) => event.kind === "target"),
  ).toMatchObject([{ at: 8.1, actorIds: ["you"] }]);
});

it("waits a full second after birth before its first damage and growth", () => {
  const attempt = isolated();
  advanceAttempt(attempt, 5 + 59 / 60, still);
  expect(attempt.world.pools[0]).toMatchObject({
    radius: 5,
    growths: 0,
    nextTick: 6,
  });
  expect(
    attempt.world.events.filter((event) => event.kind === "damage"),
  ).toHaveLength(0);
  advanceAttempt(attempt, 1 / 60, still);
  expect(attempt.world.pools[0]).toMatchObject({
    radius: 5.5,
    growths: 1,
    nextTick: 7,
  });
  expect(
    attempt.world.events.filter((event) => event.kind === "damage"),
  ).toMatchObject([{ at: 6, actorIds: ["you"], amount: 1 }]);
});

it("expires at its lifetime boundary without ticking at expiry", () => {
  const attempt = isolated();
  advanceAttempt(attempt, 5, still);
  // Isolate lifetime from the runtime termination caused by a platform-sized pool.
  attempt.world.elapsed = 35 - 1 / 60;
  stepDefile(attempt);
  expect(attempt.world.pools).toHaveLength(1);
  expect(
    attempt.world.events.filter((event) => event.kind === "damage"),
  ).toHaveLength(29);
  attempt.world.elapsed = 35;
  stepDefile(attempt);
  expect(attempt.world.pools).toHaveLength(0);
  expect(
    attempt.world.events.filter((event) => event.kind === "damage"),
  ).toHaveLength(29);
  expect(attempt.world.actors[0].available).toBe(true);
  expect(attempt.world.status).toBe("running");
});

it("uses the pre-growth radius for one common hit set independent of actor order", () => {
  const a = isolated();
  const actor = a.world.actors[0];
  actor.x = 0;
  actor.y = 0;
  a.world.actors.push(
    { ...actor, id: "inside", control: "npc", x: 5.2 },
    { ...actor, id: "outside", control: "npc", x: 5.6 },
    { ...actor, id: "carried", control: "npc", carriedBy: "valkyr" },
    { ...actor, id: "unavailable", control: "npc", available: false },
  );
  const b = structuredClone(a);
  b.world.actors.reverse();
  advanceAttempt(a, 6, still);
  advanceAttempt(b, 6, still);
  expect(a.world.pools[0].radius).toBeCloseTo(6.05, 8);
  expect(a.world.pools[0].growths).toBe(2);
  expect(
    a.world.events.filter((event) => event.kind === "damage"),
  ).toMatchObject([{ actorIds: ["inside", "you"], amount: 2 }]);
  expect(b.world.pools).toEqual(a.world.pools);
  expect(b.world.events).toEqual(a.world.events);
});

it("does not grow or emit damage for an empty hit set", () => {
  const attempt = isolated();
  advanceAttempt(attempt, 5, still);
  advanceAttempt(attempt, 1, { x: 1, y: 0 });
  expect(attempt.world.pools[0]).toMatchObject({
    radius: 5,
    growths: 0,
    nextTick: 7,
  });
  expect(
    attempt.world.events.filter((event) => event.kind === "damage"),
  ).toHaveLength(0);
});

it("selects a currently eligible neighbor at reveal and falls back to the nearest eligible NPC", () => {
  const attempt = running("before-standard-neighbor");
  advanceAttempt(attempt, 8, still);
  for (const actor of attempt.world.actors) {
    actor.x = 30;
    actor.y = 0;
  }
  const you = attempt.world.actors.find((actor) => actor.id === "you")!;
  you.x = 0;
  const carried = attempt.world.actors.find((actor) => actor.id === "raid-06")!;
  carried.x = 0;
  carried.carriedBy = "valkyr";
  const unavailable = attempt.world.actors.find(
    (actor) => actor.id === "raid-07",
  )!;
  unavailable.x = 1;
  unavailable.available = false;
  const closest = attempt.world.actors.find((actor) => actor.id === "raid-08")!;
  closest.x = 9;
  for (const actor of attempt.world.actors.filter(
    (actor) =>
      actor.role === "tank" ||
      actor.role === "soaker" ||
      actor.role === "healer",
  ))
    actor.x = 0;
  advanceAttempt(attempt, 0.1, still);
  expect(attempt.world.casts[0].targetId).toBe("raid-08");
});

it("keeps pools from independent casts alive and expires only the older pool", () => {
  const attempt = isolated();
  attempt.run.scenario.events = [
    {
      id: "first",
      at: 0,
      checkpointId: "start",
      kind: "defile",
      target: "you",
    },
    {
      id: "second",
      at: 2,
      checkpointId: "start",
      kind: "defile",
      target: "you",
    },
  ];
  advanceAttempt(attempt, 4, still);
  // Keep this independent-lifetime check below the platform assessment seam.
  attempt.world.elapsed = 32;
  stepDefile(attempt);
  expect(attempt.world.pools).toMatchObject([
    { id: "second:pool", bornAt: 4, expiresAt: 34, growths: 28 },
  ]);
  const damage = attempt.world.events.filter(
    (event) => event.kind === "damage" && event.at === 32,
  );
  expect(damage).toMatchObject([
    { sourceId: "second:pool", actorIds: ["you"] },
  ]);
});
