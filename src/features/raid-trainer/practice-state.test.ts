import { expect, it } from "vitest";
import { makeRun } from "./scenario-content";
import { createAttempt } from "./scenario-runtime";
import { createRecording, recordStep } from "./scenario-recording";
import { readAttempt } from "./scenario-view";
import {
  firstMistake,
  outcome,
  restorePractice,
  exposureCounts,
} from "./practice-state";

it("separates clean personal Defile from supporting spirit exposure", () => {
  const attempt = createAttempt(makeRun("spirits-moving-you", 41));
  attempt.world.status = "complete";
  attempt.findings.push({
    id: "burst:you",
    eventId: "burst",
    at: 12,
    actorId: "you",
    mechanic: "vile-spirits",
    code: "exposure",
    severity: "miss",
    detail: "you took spirit burst damage",
  });
  const view = readAttempt(attempt);
  expect(exposureCounts(view, "defile").personal).toBe(0);
  expect(exposureCounts(view, "vile-spirits").personal).toBe(1);
  expect(outcome(view)).toBe("imperfect");
});
it("finds a formation mistake without personal Defile damage", () => {
  const attempt = createAttempt(makeRun("before-standard-you", 41));
  attempt.world.events.push({
    id: "formation-1",
    at: 15,
    kind: "formation",
    sourceId: "pickup",
    mechanic: "strategy",
    actorIds: ["you"],
    position: null,
    checkpointId: "start",
    amount: 0,
    protectedActorIds: [],
    obligations: [],
  });
  attempt.findings.push({
    id: "finding",
    eventId: "formation-1",
    at: 15,
    actorId: "you",
    mechanic: "strategy",
    code: "outside-formation",
    severity: "miss",
    detail: "outside the assigned stack",
  });
  expect(firstMistake(readAttempt(attempt))?.id).toBe("formation-1");
});
it("falls back to same-scenario retry for a corrupted checkpoint", () => {
  const run = makeRun("before-standard-you", 41);
  const attempt = createAttempt(run),
    recording = createRecording();
  recordStep(recording, attempt);
  recording.checkpoints.start.profileRevision = -1;
  const restored = restorePractice(run, recording, "start");
  expect(restored.fallback).toBe(true);
  expect(restored.attempt.run).toEqual(run);
  expect(restored.attempt.world.status).toBe("countdown");
  expect(restored.recording.frames).toHaveLength(1);
});
