import { describe, expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { scenarioAudioCues } from "./audio-cues";
import { emitEvent } from "./scenario-events";
import { advanceAttempt } from "./scenario-runtime";
import { readAttempt } from "./scenario-view";

describe("scenario audio", () => {
  it("announces a target only when its reveal event becomes observable", () => {
    const a = running("before-tight-you");
    advanceAttempt(a, 8.05, { x: 0, y: 0 });
    const before = readAttempt(a);
    expect(scenarioAudioCues(before, before)).toEqual([]);
    advanceAttempt(a, 0.1, { x: 0, y: 0 });
    expect(scenarioAudioCues(before, readAttempt(a))).toEqual(["target"]);
  });

  it("uses retained event identity for the same cues in live and replay views", () => {
    const a = running("before-tight-neighbor");
    advanceAttempt(a, 6.9, { x: 0, y: 0 });
    const before = readAttempt(a);
    advanceAttempt(a, 3.2, { x: 0, y: 0 });
    const after = readAttempt(a);
    const live = scenarioAudioCues(before, after);
    const replay = scenarioAudioCues(
      structuredClone(before),
      structuredClone(after),
    );
    expect(live).toEqual(["count-3", "count-2", "count-1", "other", "pool"]);
    expect(replay).toEqual(live);
  });

  it("returns all crossed event cues while coalescing damage and leaving danger last", () => {
    const a = running("before-tight-you");
    advanceAttempt(a, 8.05, { x: 0, y: 0 });
    const before = readAttempt(a);
    advanceAttempt(a, 3, { x: 0, y: 0 });
    emitEvent(a, {
      kind: "damage",
      sourceId: "extra-tick",
      mechanic: "defile",
      actorIds: ["you"],
      checkpointId: "start",
    });
    const cues = scenarioAudioCues(before, readAttempt(a));
    expect(cues.filter((cue) => cue === "damage")).toHaveLength(1);
    expect(cues).toContain("target");
    expect(cues).toContain("pool");
    expect(cues.at(-1)).toBe("damage");
  });

  it("stays silent while paused and emits each terminal transition once", () => {
    const a = running("before-standard-you");
    const before = readAttempt(a);
    a.world.status = "paused";
    expect(scenarioAudioCues(before, readAttempt(a))).toEqual([]);
    a.world.status = "complete";
    a.world.endReason = "completed";
    const complete = readAttempt(a);
    expect(scenarioAudioCues(before, complete)).toEqual(["complete"]);
    expect(scenarioAudioCues(complete, complete)).toEqual([]);
    a.world.status = "failed";
    a.world.endReason = "actor-lost";
    expect(scenarioAudioCues(complete, readAttempt(a))).toEqual(["failed"]);
  });

  it("puts guided regroup before an exposure so danger remains the audible voice", () => {
    const a = running("before-standard-neighbor");
    a.run.mode = "guided";
    const before = readAttempt(a);
    emitEvent(a, {
      kind: "formation",
      sourceId: "regroup-now",
      mechanic: "strategy",
      actorIds: ["you"],
      checkpointId: "start",
    });
    emitEvent(a, {
      kind: "damage",
      sourceId: "danger-now",
      mechanic: "defile",
      actorIds: ["you"],
      checkpointId: "start",
    });
    const after = readAttempt(a);
    expect(after.cue?.id).toBe("danger-damage");
    expect(scenarioAudioCues(before, after)).toEqual(["regroup", "damage"]);
  });

  it("voices Val'kyr stack first and imminent Defile spread only after the final pickup", () => {
    const a = running("after-tight-neighbor");
    a.run.mode = "guided";
    advanceAttempt(a, 1.9, { x: 0, y: 0 });
    const beforeStack = readAttempt(a);
    advanceAttempt(a, 0.2, { x: 0, y: 0 });
    const stack = readAttempt(a);
    expect(stack.cue?.id).toBe("anticipate-valkyrs-stack");
    expect(scenarioAudioCues(beforeStack, stack)).toEqual(["regroup"]);

    advanceAttempt(a, 5.8, { x: 0, y: 0 });
    const beforeFinalPickup = readAttempt(a);
    expect(beforeFinalPickup.cue?.id).toBe("anticipate-valkyrs-stack");
    advanceAttempt(a, 0.2, { x: 0, y: 0 });
    const released = readAttempt(a);
    expect(released.cue?.id).toBe("anticipate-defile");
    expect(scenarioAudioCues(beforeFinalPickup, released)).toEqual(["spread"]);

    const standard = running("after-standard-neighbor");
    standard.run.mode = "guided";
    advanceAttempt(standard, 6.9, { x: 0, y: 0 });
    const beforeStandardPickup = readAttempt(standard);
    advanceAttempt(standard, 0.2, { x: 0, y: 0 });
    const standardRelease = readAttempt(standard);
    expect(standardRelease.cue?.id).toBe("valkyrs-released");
    expect(scenarioAudioCues(beforeStandardPickup, standardRelease)).toEqual(
      [],
    );
  });

  it("does not mistake danger at an earlier pickup for the stack release", () => {
    const a = running("after-tight-neighbor");
    a.run.mode = "guided";
    advanceAttempt(a, 6.9, { x: 0, y: 0 });
    const before = readAttempt(a);
    advanceAttempt(a, 0.2, { x: 0, y: 0 });
    emitEvent(a, {
      kind: "damage",
      sourceId: "danger-at-first-pickup",
      mechanic: "defile",
      actorIds: ["you"],
      checkpointId: "start",
    });
    const cues = scenarioAudioCues(before, readAttempt(a));
    expect(cues).not.toContain("spread");
    expect(cues.at(-1)).toBe("damage");
  });
});
