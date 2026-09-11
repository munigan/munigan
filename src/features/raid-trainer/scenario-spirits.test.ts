import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import type { Attempt, Spirit } from "./scenario-model";
import { stepSpirits } from "./scenario-spirits";
import { advanceAttempt } from "./scenario-runtime";

const still = { x: 0, y: 0 };
function isolated() {
  const a = running("frostmourne-return-you");
  a.run.scenario.events = [];
  for (const actor of a.world.actors) {
    actor.available = false;
    actor.mind = null;
  }
  return a;
}
function actor(a: Attempt, id: string, x: number, y: number) {
  const value = a.world.actors.find((candidate) => candidate.id === id)!;
  Object.assign(value, { x, y, available: true });
  return value;
}
function spirit(a: Attempt, fields: Partial<Spirit> = {}) {
  const value: Spirit = {
    id: "test:spirit-1",
    x: 0,
    y: 0,
    bornAt: -30,
    activeAt: 0,
    expiresAt: 30,
    targetId: null,
    explodedAt: null,
    ...fields,
  };
  a.world.spirits.push(value);
  return value;
}

it("preserves pre-existing spirit ages in a shortened excerpt", () => {
  const a = running("spirits-moving-you");
  expect(a.world.spirits[0]?.bornAt).toBe(-24);
  advanceAttempt(a, 5.9, still);
  expect(a.world.spirits[0].targetId).toBeNull();
  advanceAttempt(a, 0.2, still);
  expect(a.world.spirits[0].targetId).not.toBeNull();
});

it("bursts at first contact once, retaining protected and accidental victims separately", () => {
  const a = isolated();
  actor(a, "soaker", 2, 0);
  actor(a, "you", 5, 0);
  actor(a, "raid-01", 6.1, 0); // Outside 5 + 0.35 from contact at x=0.65.
  actor(a, "tank", 1, 0).carriedBy = "carrier";
  const s = spirit(a, { targetId: "you" });
  advanceAttempt(a, 0.2, still);
  const bursts = a.world.events.filter((event) => event.kind === "explosion");
  expect(bursts).toHaveLength(1);
  expect(bursts[0].position?.x).toBeCloseTo(0.65, 8);
  expect(bursts[0].actorIds).toEqual(["soaker", "you"]);
  expect(bursts[0].protectedActorIds).toEqual(["soaker"]);
  expect(bursts[0].amount).toBe(1);
  expect(s.explodedAt).not.toBeNull();
  advanceAttempt(a, 0.4, still);
  expect(a.world.spirits).toContain(s);
  advanceAttempt(a, 0.2, still);
  expect(a.world.spirits).not.toContain(s);
  expect(
    a.world.events.filter((event) => event.kind === "explosion"),
  ).toHaveLength(1);
});

it("sweeps the spirit segment so it cannot tunnel through an intervening soaker", () => {
  const a = isolated();
  a.run.profile.spirits.speed = 1200;
  actor(a, "soaker", 5, 0);
  actor(a, "you", 25, 0);
  spirit(a, { targetId: "you" });
  advanceAttempt(a, 1 / 60, still);
  const burst = a.world.events.find((event) => event.kind === "explosion");
  expect(burst?.position?.x).toBeCloseTo(3.65, 8);
  expect(burst?.actorIds).toEqual(["soaker"]);
  expect(burst?.amount).toBe(0);
});

it("selects only free ordinary raiders with saved RNG and stable actor order", () => {
  const a = isolated();
  actor(a, "soaker", 2, 20);
  actor(a, "tank", 3, 20);
  actor(a, "raid-01", 4, 20).carriedBy = "carrier";
  actor(a, "raid-06", 5, 20);
  actor(a, "you", 6, 20);
  spirit(a);
  const b = structuredClone(a);
  b.world.actors.reverse();
  advanceAttempt(a, 1 / 60, still);
  advanceAttempt(b, 1 / 60, still);
  expect(["raid-06", "you"]).toContain(a.world.spirits[0].targetId);
  expect(b.world.spirits).toEqual(a.world.spirits);
  expect(b.world.events).toEqual(a.world.events);
  expect(a.rngState).not.toBe(7);
  expect(b.rngState).toBe(a.rngState);
  const state = a.rngState;
  advanceAttempt(a, 0.5, still);
  expect(a.rngState).toBe(state);
});

it("retargets when its target becomes unavailable without choosing the soaker", () => {
  const a = isolated();
  actor(a, "you", 20, 0);
  const replacement = actor(a, "raid-06", 0, 20);
  actor(a, "soaker", 0, 15);
  const s = spirit(a, { targetId: "you" });
  advanceAttempt(a, 0.1, still);
  a.world.actors.find((value) => value.id === "you")!.available = false;
  advanceAttempt(a, 0.1, still);
  expect(s.targetId).toBe(replacement.id);
  expect(s.y).toBeGreaterThan(0);
  expect(
    a.world.events.find((event) => event.kind === "spirit-active")?.actorIds,
  ).toEqual([replacement.id]);
});

it("fails an unresolved spirit at its maximum age even on the scenario endpoint", () => {
  const a = isolated();
  a.run.scenario.duration = 1;
  spirit(a, { bornAt: -59, activeAt: -29, expiresAt: 1 });
  advanceAttempt(a, 1, still);
  expect(a.world.status).toBe("failed");
  expect(a.world.endReason).toBe("spirit-unresolved");
  expect(a.world.events.filter((event) => event.kind === "end")).toHaveLength(
    1,
  );
});

it("records platform return at zero without a second countdown and births a normally aged wave", () => {
  const a = running("frostmourne-return-you");
  advanceAttempt(a, 1 / 60, { x: 1, y: 0 });
  expect(a.world.events.find((event) => event.kind === "return")).toMatchObject(
    { at: 0, position: { x: 0, y: 0 } },
  );
  expect(a.world.status).toBe("running");
  advanceAttempt(a, 3.1, still);
  expect(a.world.casts[0].targetId).toBe("you");
  // Place and exit Defile so platform failure does not interrupt the wave-aging fixture.
  advanceAttempt(a, 6.9, { x: 1, y: 0 });
  expect(a.world.spirits).toHaveLength(1);
  expect(a.world.spirits[0]).toMatchObject({
    bornAt: 10,
    activeAt: 40,
    targetId: null,
  });
  advanceAttempt(a, 29.8, still);
  expect(a.world.spirits).toHaveLength(10);
  expect(a.world.spirits.every((value) => value.targetId === null)).toBe(true);
  advanceAttempt(a, 0.2, still);
  expect(a.world.spirits[0].targetId).not.toBeNull();
  expect(a.world.spirits[1].targetId).toBeNull();
  expect(
    a.world.events
      .filter((event) => event.kind === "spirit-spawn")
      .map((event) => event.at),
  ).toEqual([10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5]);
});

it("changes the shared relocation anchor without teleporting actors while Defile is active", () => {
  const a = running("frostmourne-return-you");
  advanceAttempt(a, 11.99, still);
  const npc = a.world.actors.find((value) => value.id === "raid-06")!;
  const before = { x: npc.x, y: npc.y };
  advanceAttempt(a, 1 / 60, still);
  expect(a.world.stage).toBe("relocate");
  expect(a.world.anchor).toEqual({ x: 0, y: 22 });
  expect(Math.hypot(npc.x - before.x, npc.y - before.y)).toBeLessThanOrEqual(
    7 / 60 + 1e-8,
  );
  expect(a.world.pools).toHaveLength(1);
  expect(a.world.events.find((event) => event.kind === "relocate")?.at).toBe(
    12,
  );
});

it("makes a bounded observed interception correction while remaining clear of the raid", async () => {
  const { stepRaidMovement } = await import("./raid-strategy");
  const a = running("spirits-settled-you");
  a.world.spirits = [];
  const soaker = a.world.actors.find((value) => value.role === "soaker")!;
  const mind = soaker.mind!;
  mind.observeAt = 100;
  mind.decideAt = 0;
  mind.observed = {
    at: 1,
    eventIds: [],
    targetIds: [],
    anchor: { x: 0, y: 22 },
    stage: "settled",
    hazards: [{ id: "incoming", x: 2, y: 7, radius: 5, kind: "spirit" }],
  };
  for (let i = 1; i <= 60; i++) {
    a.world.elapsed = i / 60;
    stepRaidMovement(a, still, 1 / 60);
  }
  expect(soaker.x).toBeGreaterThan(0.5);
  expect(Math.hypot(soaker.x, soaker.y - 9)).toBeLessThanOrEqual(
    a.run.scenario.strategy.soakInterceptRadius,
  );
  expect(Math.hypot(soaker.x, soaker.y - 22)).toBeGreaterThan(10.7);
});

it("preserves spirit births, pursuit, RNG, and pending NPC observations across saved continuation", () => {
  const a = running("frostmourne-return-neighbor", 42);
  advanceAttempt(a, 12.3, { x: 1, y: 0 });
  const b = structuredClone(a);
  b.run.focus = "vile-spirits";
  advanceAttempt(a, 30, still);
  for (let i = 0; i < 300; i++) advanceAttempt(b, 0.1, still);
  expect(b.world).toEqual(a.world);
  expect(b.rngState).toBe(a.rngState);
});

it("retires only the soaker's own contact from current and queued perceptions", () => {
  const a = running("spirits-settled-neighbor", 18);
  a.run.scenario.events = [];
  a.world.spirits = [];
  const soaker = a.world.actors.find((actor) => actor.id === "soaker")!;
  const remote = a.world.actors.find((actor) => actor.id === "raid-06")!;
  const local = spirit(a, { x: soaker.x, y: soaker.y, targetId: "you" });
  const hazard = {
    id: local.id,
    x: local.x,
    y: local.y,
    radius: 5,
    kind: "spirit" as const,
  };
  soaker.mind!.observed.hazards = [hazard];
  soaker.mind!.pending = [
    { ...structuredClone(soaker.mind!.observed), at: 0.25 },
  ];
  remote.mind!.observed.hazards = [structuredClone(hazard)];
  remote.mind!.pending = [
    { ...structuredClone(remote.mind!.observed), at: 0.25 },
  ];
  stepSpirits(a, 1 / 60);
  expect(local.explodedAt).toBe(0);
  expect(soaker.mind!.observed.hazards).toEqual([]);
  expect(
    soaker.mind!.pending.every(
      (observation) => observation.hazards.length === 0,
    ),
  ).toBe(true);
  expect(remote.mind!.observed.hazards).toHaveLength(1);
  expect(remote.mind!.pending[0].hazards).toHaveLength(1);
  advanceAttempt(a, 1, still);
  expect(soaker.mind!.observed.hazards.some((h) => h.id === local.id)).toBe(
    false,
  );
});

it("does not give the soaker instant knowledge of a nearby remotely triggered burst", () => {
  const a = running("spirits-settled-neighbor", 18);
  a.world.spirits = [];
  const soaker = a.world.actors.find((actor) => actor.id === "soaker")!;
  const you = a.world.actors.find((actor) => actor.id === "you")!;
  you.x = soaker.x + 3;
  you.y = soaker.y;
  const remote = spirit(a, { x: you.x, y: you.y, targetId: you.id });
  soaker.mind!.observed.hazards = [
    { id: remote.id, x: remote.x, y: remote.y, radius: 5, kind: "spirit" },
  ];
  stepSpirits(a, 1 / 60);
  expect(remote.explodedAt).toBe(0);
  expect(a.world.events.at(-1)?.protectedActorIds).toContain("soaker");
  expect(soaker.mind!.observed.hazards).toHaveLength(1);
});
