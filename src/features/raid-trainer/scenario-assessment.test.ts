import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { advanceAttempt } from "./scenario-runtime";
import { assessStep, summarizeAttempt } from "./scenario-assessment";
import { emitEvent } from "./scenario-events";
import type { Attempt, Pool } from "./scenario-model";

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

// Removing damage assessment, milestone snapshots, or clear-space checks must fail these cases.

function isolated(): Attempt {
  const attempt = running("before-standard-you");
  attempt.run.scenario.events = attempt.run.scenario.events.filter(
    (event) => event.kind === "check-formation" || event.kind === "finish",
  );
  attempt.run.scenario.events[0].at = 1;
  attempt.run.scenario.events[1].at = 2;
  attempt.run.scenario.duration = 2;
  attempt.world.actors = attempt.world.actors.filter(
    (actor) => actor.id === "you",
  );
  Object.assign(attempt.world.actors[0], { x: 0, y: 8 });
  return attempt;
}

function pool(attempt: Attempt, values: Partial<Pool> = {}): Pool {
  const value: Pool = {
    id: "defile:pool",
    targetId: "you",
    x: 0,
    y: 8,
    radius: 5,
    bornAt: 0,
    expiresAt: 30,
    nextTick: 100,
    growths: 0,
    ...values,
  };
  attempt.world.pools.push(value);
  return value;
}

it("partitions actual exposure by focus, retains NPC attribution, and deduplicates assessment", () => {
  const a = isolated();
  const events = [
    emitEvent(a, {
      kind: "damage",
      sourceId: "pool",
      mechanic: "defile",
      checkpointId: "",
      actorIds: ["npc-1"],
    }),
    emitEvent(a, {
      kind: "explosion",
      sourceId: "spirit",
      mechanic: "vile-spirits",
      checkpointId: "",
      actorIds: ["you"],
    }),
  ];
  assessStep(a, events);
  assessStep(a, events);
  expect(a.findings).toHaveLength(2);
  expect(summarizeAttempt(a)).toMatchObject({
    outcome: "imperfect",
    primary: [{ actorId: "npc-1", code: "exposure" }],
    supporting: [{ actorId: "you", code: "exposure" }],
  });
  a.run.focus = "vile-spirits";
  expect(summarizeAttempt(a)).toMatchObject({
    primary: [{ actorId: "you" }],
    supporting: [{ actorId: "npc-1" }],
  });
});

it("records intentional protected soaking without an accidental miss", () => {
  const attempt = isolated();
  const event = emitEvent(attempt, {
    kind: "explosion",
    sourceId: "spirit",
    mechanic: "vile-spirits",
    checkpointId: "",
    actorIds: ["soaker"],
    protectedActorIds: ["soaker"],
  });
  assessStep(attempt, [event]);
  expect(attempt.findings).toMatchObject([
    { actorId: "soaker", severity: "info" },
  ]);
  expect(summarizeAttempt(attempt).outcome).toBe("clean");
  const splash = emitEvent(attempt, {
    kind: "explosion",
    sourceId: "second-spirit",
    mechanic: "vile-spirits",
    checkpointId: "",
    actorIds: ["soaker", "you"],
    protectedActorIds: ["soaker"],
  });
  assessStep(attempt, [splash]);
  expect(
    attempt.findings.filter((finding) => finding.severity === "miss"),
  ).toMatchObject([{ actorId: "you" }]);
});

it("fails the idle edge camper's final objective without blaming late NPC returns", () => {
  const attempt = isolated();
  attempt.world.actors[0].x = 40;
  advanceAttempt(attempt, 2, { x: 0, y: 0 });
  expect(attempt.findings).toMatchObject([
    { actorId: "you", code: "outside-formation", severity: "miss" },
  ]);
  expect(summarizeAttempt(attempt)).toMatchObject({
    outcome: "imperfect",
    endReason: "completed",
  });
  expect(attempt.world.stage).toBe("settled");
});

it("checks final formation using its own pre-movement position", () => {
  const attempt = isolated();
  attempt.world.step = 59;
  attempt.world.elapsed = 59 / 60;
  attempt.world.actors[0].x = 2.05;
  advanceAttempt(attempt, 1 / 60, { x: -1, y: 0 });
  expect(attempt.world.actors[0].x).toBeLessThan(2);
  expect(attempt.findings).toMatchObject([{ code: "outside-formation" }]);
  expect(attempt.world.events[0].obligations[0].position.x).toBe(2.05);
});

it("captures pickup danger exemption before movement clears the pool", () => {
  const attempt = running("before-tight-you");
  attempt.world.step = 629;
  attempt.world.elapsed = 629 / 60;
  attempt.run.scenario.events = attempt.run.scenario.events.filter(
    (event) => event.kind === "pickup",
  );
  const you = attempt.world.actors.find((actor) => actor.id === "you")!;
  Object.assign(you, { x: 5.3, y: 8 });
  pool(attempt);
  advanceAttempt(attempt, 1 / 60, { x: 1, y: 0 });
  expect(you.x).toBeGreaterThan(5.35);
  expect(attempt.findings).toMatchObject([
    { code: "formation-exempt", detail: expect.stringMatching(/Defile/) },
  ]);
});

it.each(["target", "passenger", "pool", "spirit"])(
  "records the reason for a %s formation exemption",
  (reason) => {
    const attempt = isolated();
    const you = attempt.world.actors[0];
    you.x = 10;
    if (reason === "target")
      attempt.world.casts.push({
        id: "pending",
        targetCase: "you",
        startedAt: 0,
        revealAt: 0,
        resolvesAt: 5,
        targetId: "you",
        resolved: false,
      });
    if (reason === "passenger") you.carriedBy = "valkyr";
    if (reason === "pool") pool(attempt, { x: 10 });
    if (reason === "spirit")
      attempt.world.spirits.push({
        id: "incoming",
        x: 3,
        y: 8,
        bornAt: -30,
        activeAt: 0,
        expiresAt: 50,
        targetId: "you",
        explodedAt: null,
      });
    advanceAttempt(attempt, 1, { x: 0, y: 0 });
    expect(
      attempt.findings.filter(
        (finding) =>
          finding.code.startsWith("formation") ||
          finding.code === "outside-formation",
      ),
    ).toMatchObject([
      {
        code: "formation-exempt",
        severity: "info",
        detail: expect.any(String),
      },
    ]);
  },
);

it("expires the target exemption as soon as its distant pool is cleared", () => {
  const attempt = isolated();
  attempt.world.actors[0].x = 20;
  pool(attempt, { x: 10, bornAt: 0.99 });
  advanceAttempt(attempt, 1, { x: 0, y: 0 });
  expect(attempt.findings).toMatchObject([{ code: "outside-formation" }]);
});

it("does not excuse a camper just because a detour is needed", () => {
  const attempt = isolated();
  attempt.world.actors[0].x = 30;
  pool(attempt, { x: 15, targetId: "npc" });
  advanceAttempt(attempt, 1, { x: 0, y: 0 });
  expect(attempt.findings).toMatchObject([{ code: "outside-formation" }]);
});

it("measures route overlap including corridor width without declaring it blocked", () => {
  const attempt = running("spirits-moving-you");
  const p = pool(attempt, { x: 7, y: 0 });
  const event = emitEvent(attempt, {
    kind: "pool",
    sourceId: p.id,
    mechanic: "defile",
    checkpointId: "",
    actorIds: ["you"],
    position: { x: 7, y: 0 },
  });
  assessStep(attempt, [event]);
  expect(attempt.findings).toMatchObject([
    { code: "route-overlap", detail: "pool overlapped the planned route" },
  ]);
  const clear = pool(attempt, { id: "clear", x: 8, y: 0 });
  assessStep(attempt, [
    emitEvent(attempt, {
      kind: "pool",
      sourceId: clear.id,
      mechanic: "defile",
      checkpointId: "",
      actorIds: ["you"],
      position: { x: 8, y: 0 },
    }),
  ]);
  expect(attempt.findings).toHaveLength(1);
});

it("counts raid-only Defile damage as imperfect and never as player damage", () => {
  const attempt = running("before-standard-neighbor");
  const you = attempt.world.actors.find((actor) => actor.id === "you")!;
  Object.assign(you, { x: 35, y: 0 });
  attempt.world.actors.forEach((actor) => {
    actor.mind = null;
  });
  advanceAttempt(attempt, 11, { x: 0, y: 0 });
  const damage = attempt.findings.filter(
    (finding) => finding.code === "exposure",
  );
  expect(damage.length).toBeGreaterThan(0);
  expect(damage.every((finding) => finding.actorId !== "you")).toBe(true);
  expect(summarizeAttempt(attempt).outcome).toBe("imperfect");
});

it("allows recovery after six damage ticks instead of inventing a death", () => {
  const attempt = running("before-standard-you");
  attempt.world.actors = attempt.world.actors.filter(
    (actor) => actor.id === "you",
  );
  advanceAttempt(attempt, 16, { x: 0, y: 0 });
  expect(
    attempt.findings.filter((finding) => finding.code === "exposure"),
  ).toHaveLength(6);
  expect(attempt.world.status).toBe("running");
  expect(attempt.world.actors[0].available).toBe(true);
  advanceAttempt(attempt, 2, { x: 1, y: 0 });
  const hits = attempt.findings.filter(
    (finding) => finding.code === "exposure",
  ).length;
  advanceAttempt(attempt, 2, { x: 0, y: 0 });
  expect(
    attempt.findings.filter((finding) => finding.code === "exposure"),
  ).toHaveLength(hits);
});

it("terminates an entirely unusable platform even at the authored endpoint", () => {
  const attempt = isolated();
  attempt.run.scenario.duration = 1 / 60;
  pool(attempt, { x: 0, y: 0, radius: 100 });
  advanceAttempt(attempt, 1 / 60, { x: 0, y: 0 });
  expect(summarizeAttempt(attempt)).toMatchObject({
    outcome: "failed",
    endReason: "platform-unusable",
  });
  expect(
    attempt.world.events.filter((event) => event.kind === "end"),
  ).toHaveLength(1);
});

it("preserves escape from an occupied pool when a clear platform cell exists", () => {
  const attempt = isolated();
  pool(attempt, { x: 0, y: 0, radius: 40 });
  advanceAttempt(attempt, 1 / 60, { x: 0, y: 0 });
  expect(attempt.world.status).toBe("running");
});

it("allows the tight-before target to escape and rejoin across all three pickups", () => {
  const attempt = running("before-tight-you");
  const you = attempt.world.actors.find((actor) => actor.id === "you")!;
  Object.assign(you, { x: 0, y: 8 });
  advanceAttempt(attempt, 8.1, { x: 0, y: 0 });
  advanceAttempt(attempt, 3.4, { x: 1, y: 0 });
  const obligations = attempt.findings.filter(
    (finding) => finding.mechanic === "strategy",
  );
  expect(obligations).toHaveLength(3);
  expect(
    obligations.every((finding) => finding.code === "formation-exempt"),
  ).toBe(true);
  expect(obligations.at(-1)?.detail).toMatch(/rejoining after Defile/);
  advanceAttempt(attempt, 8.5, { x: 0, y: 0 });
  expect(
    attempt.findings.filter((finding) => finding.mechanic === "strategy").at(-1)
      ?.code,
  ).toBe("outside-formation");
});

it("ends the recovery allowance permanently on an early rejoin", () => {
  const attempt = running("before-tight-you");
  Object.assign(
    attempt.world.actors.find((actor) => actor.id === "you")!,
    { x: 0, y: 8 },
  );
  attempt.run.scenario.events = attempt.run.scenario.events.filter(
    (event) => event.kind !== "pickup",
  );
  attempt.run.scenario.events.find(
    (event) => event.kind === "check-formation",
  )!.at = 12.5;
  attempt.run.scenario.events.sort((a, b) => a.at - b.at);
  advanceAttempt(attempt, 8.1, { x: 0, y: 0 });
  advanceAttempt(attempt, 1.9, { x: 1, y: 0 });
  advanceAttempt(attempt, 1.9, { x: -1, y: 0 });
  advanceAttempt(attempt, 0.6, { x: 1, y: 0 });
  expect(
    attempt.findings.filter((finding) => finding.mechanic === "strategy"),
  ).toMatchObject([{ code: "outside-formation" }]);
});

it("reports a route overlap first introduced by pool growth", () => {
  const attempt = running("spirits-moving-you");
  attempt.world.spirits = [];
  attempt.world.actors = attempt.world.actors.filter(
    (actor) => actor.id === "you",
  );
  Object.assign(attempt.world.actors[0], { x: 7.8, y: 0 });
  advanceAttempt(attempt, 10, { x: 0, y: 0 });
  expect(
    attempt.findings.filter((finding) => finding.code === "route-overlap"),
  ).toHaveLength(0);
  advanceAttempt(attempt, 1, { x: 0, y: 0 });
  expect(
    attempt.findings.filter((finding) => finding.code === "route-overlap"),
  ).toMatchObject([{ actorId: "you", at: 11 }]);
});

it("detects an unusable platform covered by the union of smaller pools", () => {
  const attempt = isolated();
  pool(attempt, { id: "west", x: -30, y: 0, radius: 54 });
  pool(attempt, { id: "east", x: 30, y: 0, radius: 54 });
  advanceAttempt(attempt, 1 / 60, { x: 0, y: 0 });
  expect(attempt.world.endReason).toBe("platform-unusable");
});

it.each([
  { anchor: { x: 0, y: 8 }, position: { x: 0, y: 20 }, overlap: true },
  { anchor: { x: 0, y: 8 }, position: { x: 0, y: -5 }, overlap: false },
  { anchor: { x: 0, y: -8 }, position: { x: 0, y: -20 }, overlap: true },
  { anchor: { x: 0, y: -8 }, position: { x: 0, y: 5 }, overlap: false },
  { anchor: { x: 0, y: 0 }, position: { x: 0, y: -20 }, overlap: true },
  { anchor: { x: 0, y: 0 }, position: { x: 0, y: 20 }, overlap: false },
  { anchor: { x: 6, y: 8 }, position: { x: 12, y: 16 }, overlap: true },
  { anchor: { x: 6, y: 8 }, position: { x: 0, y: 20 }, overlap: false },
])(
  "assesses the radial pickup corridor from $anchor at $position: overlap=$overlap",
  ({ anchor, position, overlap }) => {
    const attempt = running("before-standard-you");
    attempt.run.scenario.strategy.start = anchor;
    const placed = pool(attempt, position);
    assessStep(attempt, [
      emitEvent(attempt, {
        kind: "pool",
        sourceId: placed.id,
        mechanic: "defile",
        checkpointId: "",
        actorIds: ["you"],
        position,
      }),
    ]);
    expect(
      attempt.findings.filter((finding) => finding.code === "route-overlap"),
    ).toHaveLength(overlap ? 1 : 0);
  },
);
