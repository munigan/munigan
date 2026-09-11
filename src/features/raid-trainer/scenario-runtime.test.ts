import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { makeRun } from "./scenario-content";
import { advanceAttempt, createAttempt } from "./scenario-runtime";

const still = { x: 0, y: 0 };

it("integrates the full second with identical worlds across uneven frames", () => {
  const a = running("before-standard-you");
  const b = running("before-standard-you");
  const initial = { ...a.world.actors.find((actor) => actor.id === "you")! };
  advanceAttempt(a, 1, { x: 1, y: 1 });
  for (let i = 0; i < 144; i++) advanceAttempt(b, 1 / 144, { x: 1, y: 1 });
  expect(b.world).toEqual(a.world);
  expect(a.world.elapsed).toBe(1);
  expect(a.world.step).toBe(60);
  const you = a.world.actors.find((actor) => actor.id === "you")!;
  expect(Math.hypot(you.x - initial.x, you.y - initial.y)).toBeCloseTo(7, 8);
});

it("rejects an invalid run before creating a world", () => {
  const run = makeRun("before-standard-you", 7);
  run.profile.defile.tick = 0;
  expect(() => createAttempt(run)).toThrow(
    "Invalid profile value: defile.tick",
  );
});

it.each(["ready", "countdown", "paused", "complete", "failed"] as const)(
  "does not consume time or input while %s",
  (status) => {
    const attempt = running("before-standard-you");
    advanceAttempt(attempt, 1 / 120, still);
    attempt.world.status = status;
    const before = structuredClone(attempt);
    advanceAttempt(attempt, 1, { x: 1, y: 0 });
    expect(attempt).toEqual(before);
  },
);

it.each([0, -1, NaN, Infinity, -Infinity])(
  "ignores invalid delta %s",
  (seconds) => {
    const attempt = running("before-standard-you");
    const before = structuredClone(attempt);
    advanceAttempt(attempt, seconds, { x: 1, y: 0 });
    expect(attempt).toEqual(before);
  },
);

it("retains partial steps when paused and resumed", () => {
  const attempt = running("before-standard-you");
  advanceAttempt(attempt, 1 / 120, still);
  expect(attempt.world.elapsed).toBe(0);
  attempt.world.status = "paused";
  advanceAttempt(attempt, 3, still);
  attempt.world.status = "running";
  advanceAttempt(attempt, 1 / 120, still);
  expect(attempt.world.step).toBe(1);
});

it("processes authored events once in time and authored-index order without mutating the run", () => {
  const run = makeRun("before-standard-you", 7);
  run.scenario.events = [
    {
      id: "later",
      at: 2,
      checkpointId: "start",
      kind: "defile",
      target: "you",
    },
    {
      id: "z-first",
      at: 1,
      checkpointId: "start",
      kind: "defile",
      target: "you",
    },
    {
      id: "a-second",
      at: 1,
      checkpointId: "start",
      kind: "defile",
      target: "you",
    },
  ];
  const before = structuredClone(run);
  const attempt = createAttempt(run);
  attempt.world.status = "running";
  advanceAttempt(attempt, 2.5, still);
  expect(
    attempt.world.events
      .filter((event) => event.kind === "cast")
      .map((event) => event.sourceId),
  ).toEqual(["z-first", "a-second", "later"]);
  expect(attempt.cursor).toBe(3);
  expect(run).toEqual(before);
  const ids = attempt.world.events.map((event) =>
    Number(event.id.split("-").at(-1)),
  );
  expect(ids).toEqual(ids.map((_, index) => index + 1));
});

it("ends at the authored endpoint without advancing the remaining frame", () => {
  const attempt = running("before-standard-you");
  advanceAttempt(attempt, 40, still);
  expect(attempt.world.elapsed).toBe(27);
  expect(attempt.world.status).toBe("complete");
  expect(attempt.world.endReason).toBe("completed");
  expect(
    attempt.world.events.filter((event) => event.kind === "end"),
  ).toHaveLength(1);
});

it("keeps physical worlds identical across drill focus", () => {
  const a = running("before-standard-neighbor", 42, "defile");
  const b = running("before-standard-neighbor", 42, "vile-spirits");
  advanceAttempt(a, 12, still);
  advanceAttempt(b, 12, still);
  expect(a.world).toEqual(b.world);
});

it("reports each completed simulation step, including the endpoint, for recording", () => {
  const attempt = running("before-standard-you");
  const elapsed: number[] = [];
  advanceAttempt(attempt, 1 / 120, still, (current) =>
    elapsed.push(current.world.elapsed),
  );
  expect(elapsed).toEqual([]);
  advanceAttempt(attempt, 1 / 120, still, (current) =>
    elapsed.push(current.world.elapsed),
  );
  expect(elapsed).toEqual([1 / 60]);
  advanceAttempt(attempt, 30, still, (current) =>
    elapsed.push(current.world.elapsed),
  );
  expect(elapsed).toHaveLength(1620);
  expect(elapsed.at(-1)).toBe(27);
  expect(attempt.world.status).toBe("complete");
});
