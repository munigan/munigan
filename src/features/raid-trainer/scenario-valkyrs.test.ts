import { describe, expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { makeRun, validateRun } from "./scenario-content";
import type { Attempt, ScriptEvent } from "./scenario-model";
import { advanceAttempt, createAttempt } from "./scenario-runtime";
import { applyPickup } from "./scenario-valkyrs";

const still = { x: 0, y: 0 };

function withEvents(
  events: ScriptEvent[],
  configure?: (attempt: Attempt) => void,
): Attempt {
  const run = makeRun("after-standard-you", 7);
  run.scenario.events = events;
  const attempt = createAttempt(run);
  configure?.(attempt);
  attempt.world.status = "running";
  return attempt;
}

describe("Val'kyr passenger lifecycle", () => {
  it("carries and releases an NPC without a second voluntary move", () => {
    const attempt = running("after-standard-you");
    advanceAttempt(attempt, 10, still);
    const valkyr = attempt.world.valkyrs.find(
      (candidate) => candidate.state === "carrying",
    )!;
    const actor = attempt.world.actors.find(
      (candidate) => candidate.id === valkyr.passengerId,
    )!;

    expect(actor.carriedBy).toBe(valkyr.id);
    expect({ x: actor.x, y: actor.y }).toEqual({
      x: valkyr.x,
      y: valkyr.y,
    });
    expect(
      Math.hypot(actor.x, actor.y) -
        Math.hypot(
          attempt.run.scenario.strategy.start.x,
          attempt.run.scenario.strategy.start.y,
        ),
    ).toBeLessThan(2.1);

    advanceAttempt(attempt, 5, still);
    expect(
      attempt.world.events.some(
        (event) =>
          event.kind === "release" && event.actorIds.includes(actor.id),
      ),
    ).toBe(true);
  });

  it("appears at the authored descent time and remains still through the stun", () => {
    const attempt = running("after-standard-you");
    advanceAttempt(attempt, 4 - 1 / 60, still);
    expect(attempt.world.valkyrs).toEqual([]);
    advanceAttempt(attempt, 1 / 60, still);
    expect(attempt.world.valkyrs).toMatchObject([
      { id: "pickup-1:valkyr", pickupAt: 6, state: "descending" },
    ]);

    advanceAttempt(attempt, 2, still);
    const valkyr = attempt.world.valkyrs[0];
    const pickup = { x: valkyr.x, y: valkyr.y };
    expect(valkyr.state).toBe("carrying");
    advanceAttempt(attempt, 3, still);
    expect({ x: valkyr.x, y: valkyr.y }).toEqual(pickup);
    advanceAttempt(attempt, 1, still);
    expect(Math.hypot(valkyr.x - pickup.x, valkyr.y - pickup.y)).toBeCloseTo(
      2,
      8,
    );
  });

  it("uses the authored southward route when picked up at arena centre", () => {
    const attempt = running("after-standard-you");
    const event = attempt.run.scenario.events.find(
      (candidate) => candidate.kind === "pickup",
    );
    if (!event || event.kind !== "pickup")
      throw new Error("fixture lacks pickup");
    const actor = attempt.world.actors.find(
      (candidate) => candidate.id === event.actorId,
    )!;
    actor.x = 0;
    actor.y = 0;

    applyPickup(attempt, event);

    expect(attempt.world.valkyrs[0].destination).toEqual({ x: 0, y: -45 });
  });

  it("releases at eight seconds in place and resumes NPC decisions after one reaction", () => {
    const pickup: ScriptEvent = {
      id: "pickup",
      at: 1,
      checkpointId: "start",
      kind: "pickup",
      actorId: "raid-06",
    };
    const attempt = withEvents([pickup]);
    const actor = attempt.world.actors.find(
      (candidate) => candidate.id === "raid-06",
    )!;
    const home = { x: actor.x, y: actor.y };
    advanceAttempt(attempt, 9, still);
    const releasedAt = { x: actor.x, y: actor.y };

    expect(actor.carriedBy).toBeNull();
    expect(actor.available).toBe(true);
    expect(releasedAt).not.toEqual(home);
    expect(attempt.world.events).toContainEqual(
      expect.objectContaining({
        kind: "release",
        at: 9,
        actorIds: ["raid-06"],
        position: releasedAt,
      }),
    );
    expect(actor.mind!.pending).toContainEqual(
      expect.objectContaining({ at: 9 }),
    );
    expect(actor.mind!.decideAt).toBeCloseTo(9 + actor.mind!.reaction, 8);

    const distanceAtRelease = Math.hypot(
      actor.x - attempt.world.anchor.x,
      actor.y - attempt.world.anchor.y,
    );
    advanceAttempt(attempt, actor.mind!.reaction + 1, still);
    expect(
      Math.hypot(
        actor.x - attempt.world.anchor.x,
        actor.y - attempt.world.anchor.y,
      ),
    ).toBeLessThan(distanceAtRelease);
  });

  it("loses a passenger at the edge and does not let endpoint completion overwrite failure", () => {
    const run = makeRun("after-standard-you", 7);
    run.profile.valkyrs.descent = 0.5;
    run.profile.valkyrs.stun = 0.1;
    run.scenario.duration = 1.15;
    run.scenario.events = [
      {
        id: "pickup",
        at: 1,
        checkpointId: "start",
        kind: "pickup",
        actorId: "raid-06",
      },
      {
        id: "finish",
        at: 1.15,
        checkpointId: "start",
        kind: "finish",
      },
    ];
    const attempt = createAttempt(run);
    const actor = attempt.world.actors.find(
      (candidate) => candidate.id === "raid-06",
    )!;
    attempt.world.status = "running";
    advanceAttempt(attempt, 1 - 1 / 60, still);
    actor.x = 44.9;
    actor.y = 0;
    actor.mind!.goal = { x: actor.x, y: actor.y };

    advanceAttempt(attempt, 1, still);

    expect(attempt.world.status).toBe("failed");
    expect(attempt.world.endReason).toBe("actor-lost");
    expect(actor.available).toBe(false);
    expect(Math.hypot(actor.x, actor.y)).toBeCloseTo(45, 8);
    expect(
      attempt.world.events.filter((event) => event.kind === "loss"),
    ).toMatchObject([{ actorIds: ["raid-06"], at: 1.15 }]);
    expect(
      attempt.world.events.filter((event) => event.kind === "end"),
    ).toHaveLength(1);
  });
});

describe("Val'kyr ordering and authored constraints", () => {
  it.each([
    ["before-standard-you", ["cast", "pickup", "pickup", "pickup"]],
    ["before-tight-you", ["cast", "pickup", "pickup", "pickup"]],
    ["after-standard-you", ["pickup", "pickup", "pickup", "cast"]],
    ["after-tight-you", ["pickup", "pickup", "pickup", "cast"]],
  ] as const)(
    "keeps the approved mechanic order in %s",
    (variant, expected) => {
      const attempt = running(variant);
      advanceAttempt(attempt, 16.1, still);
      expect(
        attempt.world.events
          .filter((event) => event.kind === "cast" || event.kind === "pickup")
          .map((event) => event.kind),
      ).toEqual(expected);
    },
  );

  it("applies an equal-time pickup before revealing a neighbor target", () => {
    const run = makeRun("after-standard-neighbor", 7);
    run.profile.defile.revealDelay = 0;
    run.scenario.events = [
      {
        id: "defile",
        at: 1,
        checkpointId: "start",
        kind: "defile",
        target: "neighbor",
      },
      {
        id: "pickup",
        at: 1,
        checkpointId: "start",
        kind: "pickup",
        actorId: "raid-06",
      },
    ];
    const attempt = createAttempt(run);
    for (const actor of attempt.world.actors) {
      actor.x = 30;
      actor.y = 0;
    }
    const you = attempt.world.actors.find((actor) => actor.id === "you")!;
    you.x = 0;
    const passenger = attempt.world.actors.find(
      (actor) => actor.id === "raid-06",
    )!;
    passenger.x = 0;
    const fallback = attempt.world.actors.find(
      (actor) => actor.id === "raid-07",
    )!;
    fallback.x = 9;
    attempt.world.status = "running";

    advanceAttempt(attempt, 1, still);

    expect(attempt.world.casts[0].targetId).toBe("raid-07");
    const order = attempt.world.events.map((event) => event.kind);
    expect(order.indexOf("pickup")).toBeLessThan(order.indexOf("target"));
  });

  it.each(["before-standard-neighbor", "before-tight-neighbor"])(
    "never reveals an authored passenger as the neighbor in %s",
    (variant) => {
      const attempt = running(variant);
      advanceAttempt(attempt, 8.1, still);
      const passengerIds = attempt.run.scenario.events
        .filter(
          (event): event is Extract<ScriptEvent, { kind: "pickup" }> =>
            event.kind === "pickup",
        )
        .map((event) => event.actorId);

      expect(passengerIds).not.toContain(attempt.world.casts[0].targetId);
    },
  );

  it("keeps the tight-before NPC stack through the pickup sequence", () => {
    const attempt = running("before-tight-neighbor");
    advanceAttempt(attempt, 11.5, still);
    const targetId = attempt.world.casts[0].targetId;
    const responsible = attempt.world.actors.filter(
      (actor) =>
        actor.mind &&
        actor.available &&
        !actor.carriedBy &&
        actor.id !== targetId &&
        actor.role !== "tank",
    );
    expect(
      responsible.every((actor) => Math.hypot(actor.x, actor.y - 8) <= 2),
    ).toBe(true);
  });

  it("snapshots the controlled actor's formation obligation before movement", () => {
    const pickup: ScriptEvent = {
      id: "pickup",
      at: 1,
      checkpointId: "start",
      kind: "pickup",
      actorId: "raid-06",
    };
    const attempt = withEvents([pickup]);
    const you = attempt.world.actors.find((actor) => actor.id === "you")!;
    you.x = 0;
    you.y = 0;
    advanceAttempt(attempt, 1 - 1 / 60, still);
    advanceAttempt(attempt, 1 / 60, { x: 1, y: 0 });
    const formation = attempt.world.events.find(
      (event) => event.kind === "formation",
    )!;

    expect(formation.obligations).toEqual([
      {
        actorId: "you",
        position: { x: 0, y: 0 },
        anchor: { x: 0, y: 8 },
        radius: 2,
        responsibility: "hold-formation",
      },
    ]);
    expect(you.x).toBeCloseTo(7 / 60, 8);
  });

  it("rejects player passengers and overlapping carries for one NPC", () => {
    const player = makeRun("after-standard-you", 7);
    const first = player.scenario.events.find(
      (event) => event.kind === "pickup",
    );
    if (!first || first.kind !== "pickup")
      throw new Error("fixture lacks pickup");
    first.actorId = "you";
    expect(validateRun(player)).toContain("Player-controlled passenger: you");

    const overlap = makeRun("after-standard-you", 7);
    const pickups = overlap.scenario.events.filter(
      (event): event is Extract<ScriptEvent, { kind: "pickup" }> =>
        event.kind === "pickup",
    );
    pickups[1].actorId = pickups[0].actorId;
    expect(validateRun(overlap)).toContain(
      "Overlapping Val'kyr carries: raid-01",
    );
  });

  it("reports a missing Val'kyr profile without throwing during overlap validation", () => {
    const run = makeRun("after-standard-you", 7);
    const pickups = run.scenario.events.filter(
      (event): event is Extract<ScriptEvent, { kind: "pickup" }> =>
        event.kind === "pickup",
    );
    pickups[1].actorId = pickups[0].actorId;
    delete (run.profile as Partial<typeof run.profile>).valkyrs;

    expect(validateRun(run)).toContain("Missing profile group: valkyrs");
  });
});
