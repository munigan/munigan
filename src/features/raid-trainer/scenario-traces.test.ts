import { expect, it } from "vitest";
import {
  running,
  playTrace,
  successTraces,
  failureTraces,
} from "../../../tests/support/raid-scenario";
import { summarizeAttempt } from "./scenario-assessment";
it.each(Object.entries(successTraces))(
  "%s completes cleanly, repeats exactly and supports another NPC variation",
  (id, trace) => {
    const first = running(id, 7);
    playTrace(first, trace);
    const repeat = running(id, 7);
    playTrace(repeat, trace);
    expect(repeat).toEqual(first);
    const variation = running(id, 18);
    playTrace(variation, trace);
    for (const attempt of [first, variation]) {
      expect(attempt.world.endReason, `${id} seed ${attempt.seed}`).toBe(
        "completed",
      );
      expect(
        summarizeAttempt(attempt).outcome,
        `${id} seed ${attempt.seed}: ${JSON.stringify(attempt.findings.filter((f) => f.severity === "miss"))}`,
      ).toBe("clean");
      expect(attempt.world.elapsed).toBe(attempt.run.scenario.duration);
      expect(attempt.findings.filter((f) => f.severity === "miss")).toEqual([]);
      if (id.startsWith("spirits") || id.startsWith("frostmourne")) {
        const bursts = attempt.world.events.filter(
          (event) => event.kind === "explosion",
        );
        expect(bursts).toHaveLength(10);
        for (const burst of bursts) {
          expect(burst.actorIds).toEqual(["soaker"]);
          expect(burst.protectedActorIds).toEqual(["soaker"]);
        }
      }
    }
  },
  20000,
);

it.each([
  ["stackCamping", "defile", "exposure", "you"],
  ["followingTarget", "defile", "exposure", "you"],
  ["routeOverlap", "defile", "route-overlap", "you"],
  ["spiritExposure", "vile-spirits", "exposure", "you"],
] as const)(
  "%s retains its distinct real-world failure",
  (name, mechanic, code, actorId) => {
    const fixture = failureTraces[name];
    const attempt = running(fixture.variantId, fixture.seed);
    playTrace(attempt, fixture.trace);
    expect(summarizeAttempt(attempt).outcome).not.toBe("clean");
    expect(attempt.findings).toContainEqual(
      expect.objectContaining({ mechanic, code, actorId, severity: "miss" }),
    );
  },
);
