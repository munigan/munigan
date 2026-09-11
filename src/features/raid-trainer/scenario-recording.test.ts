import { expect, it } from "vitest";
import { running } from "../../../tests/support/raid-scenario";
import { makeRun } from "./scenario-content";
import { emitEvent } from "./scenario-events";
import { nextRandom } from "./scenario-random";
import { advanceAttempt, createAttempt } from "./scenario-runtime";
import {
  createRecording,
  recordStep,
  restoreCheckpoint,
  frameView,
  frameIndexForEvent,
  resumePractice,
  nextRun,
} from "./scenario-recording";

it("resumes the exact scenario from a saved decision checkpoint", () => {
  const a = running("spirits-moving-neighbor", 19);
  const recording = createRecording();
  recordStep(recording, a);
  const id = a.run.scenario.checkpoints[0].id;
  const b = restoreCheckpoint(a.run, recording.checkpoints[id]);
  expect(b.world.status).toBe("countdown");
  expect(b.remainder).toBe(0);
  b.world.status = "running";
  advanceAttempt(a, 12, { x: 1, y: 0 });
  advanceAttempt(b, 12, { x: 1, y: 0 });
  expect(b.world).toEqual(a.world);
  expect(b.rngState).toBe(a.rngState);
});

it("restores nonzero pool, carrier, pending decisions and assessment history without aliases", () => {
  const a = running("after-tight-you", 19);
  a.run.scenario.checkpoints.push({ id: "mid-carry", at: 11 });
  const recording = createRecording();
  recordStep(recording, a);
  nextRandom(a);
  advanceAttempt(a, 11.01, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  const saved = recording.checkpoints["mid-carry"];
  expect(saved.world.pools.length).toBeGreaterThan(0);
  expect(saved.world.pools[0].formationRecovery).toBeDefined();
  expect(saved.world.actors.some((actor) => actor.carriedBy !== null)).toBe(
    true,
  );
  expect(saved.world.actors.some((actor) => actor.mind?.pending?.length)).toBe(
    true,
  );
  expect(saved.findings.length).toBeGreaterThan(0);
  expect(a.remainder).toBeGreaterThan(0);
  const b = restoreCheckpoint(a.run, JSON.parse(JSON.stringify(saved)));
  expect(b.remainder).toBe(0);
  expect(b.world.step).toBe(660);
  expect(b.cursor).toBe(a.cursor);
  b.world.status = "running";
  a.remainder = 0;
  advanceAttempt(a, 6, { x: 1, y: 0 });
  advanceAttempt(b, 6, { x: 1, y: 0 });
  expect(b.world).toEqual(a.world);
  expect(b.findings).toEqual(a.findings);
  expect(nextRandom(b)).toBe(nextRandom(a));
  expect(saved.world.elapsed).toBe(11);
  expect(saved.world.actors.some((actor) => actor.carriedBy !== null)).toBe(
    true,
  );
});

it.each(["scenario", "scenarioRevision", "profileRevision"])(
  "rejects incompatible %s",
  (mismatch) => {
    const a = running("before-standard-you");
    const recording = createRecording();
    recordStep(recording, a);
    const incompatible = structuredClone(a.run);
    if (mismatch === "scenario") incompatible.scenario.id = "another-scenario";
    if (mismatch === "scenarioRevision") incompatible.scenario.revision += 1;
    if (mismatch === "profileRevision") incompatible.profile.revision += 1;
    expect(() =>
      restoreCheckpoint(incompatible, recording.checkpoints.start),
    ).toThrow(/incompatible/i);
  },
);

it("restores the checkpoint seed even when the selected run has a newer seed", () => {
  const a = running("before-standard-you", 19);
  const recording = createRecording();
  recordStep(recording, a);
  const b = restoreCheckpoint(
    { ...a.run, seed: 99 },
    recording.checkpoints.start,
  );
  expect(b.seed).toBe(19);
  expect(b.run.seed).toBe(19);
});

it("captures cadence, checkpoints, event steps and terminal states once per step", () => {
  const a = running("before-standard-you");
  a.run.scenario.events = [];
  a.run.scenario.duration = 13 / 60;
  a.run.scenario.checkpoints.push({ id: "decision", at: 8 / 60 });
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 7 / 60, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  emitEvent(a, {
    kind: "target",
    sourceId: "same",
    mechanic: "defile",
    checkpointId: "start",
  });
  emitEvent(a, {
    kind: "target",
    sourceId: "same",
    mechanic: "defile",
    checkpointId: "start",
  });
  recordStep(recording, a);
  recordStep(recording, a);
  advanceAttempt(a, 6 / 60, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  expect(recording.frames.map((frame) => frame.world.step)).toEqual([
    0, 6, 7, 8, 12, 13,
  ]);
  expect(recording.frames.every((frame) => !("events" in frame.world))).toBe(
    true,
  );
  expect(recording.events.map((event) => event.id)).toEqual([
    "event-1",
    "event-2",
    "event-3",
  ]);
  expect(frameView(recording, 0).events).toEqual([]);
  expect(frameView(recording, 5).status).toBe("complete");
  expect(frameView(recording, 5).events.at(-1)?.kind).toBe("end");
  const cloned = structuredClone(recording);
  expect(frameIndexForEvent(cloned, "event-1")).toBe(2);
  expect(frameIndexForEvent(cloned, "event-2")).toBe(2);
  expect(frameIndexForEvent(cloned, "event-3")).toBe(5);
  expect(() => frameIndexForEvent(cloned, "missing")).toThrow(/unavailable/i);
  const view = frameView(recording, 2);
  view.events[0].actorIds.push("mutated");
  view.actors[0].x = 123;
  expect(recording.events[0].actorIds).toEqual([]);
  expect(recording.frames[2].world.actors[0].x).not.toBe(123);
});

it.each([-1, 1, 0.5, NaN])("rejects unavailable frame index %s", (index) => {
  const recording = createRecording();
  recordStep(recording, running("before-standard-you"));
  expect(() => frameView(recording, index)).toThrow(/unavailable/i);
});

it("branches practice with no future events, findings or checkpoints", () => {
  const a = running("after-tight-you");
  a.run.scenario.checkpoints.push(
    { id: "middle", at: 11 },
    { id: "future", at: 13 },
  );
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 14, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  const original = structuredClone(recording);
  const branch = resumePractice(a.run, recording, "middle");
  expect(branch.attempt.world.status).toBe("countdown");
  expect(branch.recording.events).toEqual(
    recording.checkpoints.middle.world.events,
  );
  expect(branch.recording.findings).toEqual(
    recording.checkpoints.middle.findings,
  );
  expect(branch.recording.events.length).toBeLessThan(recording.events.length);
  expect(branch.recording.frames.at(-1)?.world.step).toBe(660);
  expect(Object.keys(branch.recording.checkpoints)).toEqual([
    "start",
    "middle",
  ]);
  branch.attempt.world.status = "running";
  advanceAttempt(branch.attempt, 1, { x: -1, y: 0 }, (attempt) =>
    recordStep(branch.recording, attempt),
  );
  expect(new Set(branch.recording.events.map((event) => event.id)).size).toBe(
    branch.recording.events.length,
  );
  expect(recording).toEqual(original);
  expect(() => resumePractice(a.run, recording, "missing")).toThrow(
    /unavailable/i,
  );
});

it("stores findings once and owns nested event obligations", () => {
  const a = running("after-tight-you");
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 12, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  expect(recording.findings.length).toBeGreaterThan(0);
  expect(recording.findings).toEqual(a.findings);
  expect(recording.frames.at(-1)?.findingCount).toBe(a.findings.length);
  const owned = structuredClone(recording);
  a.findings[0].detail = "changed";
  const obligationEvent = a.world.events.find(
    (event) => event.obligations.length,
  );
  expect(obligationEvent).toBeDefined();
  obligationEvent!.obligations[0].position.x = 999;
  expect(recording).toEqual(owned);
});

it("interrupts a running excerpt at 60 seconds and retains the terminal frame", () => {
  const a = running("before-standard-you");
  a.run.scenario.events = [];
  a.run.scenario.duration = 70;
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 65, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  expect(a.world.elapsed).toBe(60);
  expect(a.world.status).toBe("failed");
  expect(a.world.endReason).toBe("recording-limit");
  expect(recording.frames).toHaveLength(601);
  expect(recording.events).toHaveLength(1);
  expect(recording.events.at(-1)?.kind).toBe("end");
  expect(frameView(recording, 600).endReason).toBe("recording-limit");
});

it("bounds event overflow explicitly and never adds duplicate terminal captures", () => {
  const a = running("before-standard-you");
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 1 / 60, { x: 0, y: 0 });
  for (let i = 0; i < 2001; i++)
    emitEvent(a, {
      kind: "target",
      sourceId: String(i),
      mechanic: "defile",
      checkpointId: "start",
    });
  recordStep(recording, a);
  expect(a.world.status).toBe("failed");
  expect(a.world.endReason).toBe("recording-limit");
  expect(recording.events.length).toBeLessThanOrEqual(2000);
  expect(recording.events.at(-1)?.kind).toBe("end");
  expect(recording.events.at(-1)?.id).toBe(a.world.events.at(-1)?.id);
  const completed = structuredClone(recording);
  recordStep(recording, a);
  advanceAttempt(a, 10, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  expect(recording).toEqual(completed);
  expect(frameView(recording, recording.frames.length - 1).endReason).toBe(
    "recording-limit",
  );
});

it("visits all four families before repetition and cycles each family's cases", () => {
  const current = makeRun("before-standard-you", 19, "vile-spirits", "guided");
  const runs = Array.from({ length: 16 }, (_, index) =>
    nextRun(current, "mixed", index),
  );
  expect(runs.slice(0, 5).map((run) => run.scenario.family)).toEqual([
    "before-valkyrs",
    "after-valkyrs",
    "vile-spirits",
    "frostmourne-return",
    "before-valkyrs",
  ]);
  expect([0, 4, 8, 12].map((index) => runs[index].scenario.variantId)).toEqual([
    "before-standard-you",
    "before-standard-neighbor",
    "before-tight-you",
    "before-tight-neighbor",
  ]);
  expect(
    runs.every((run) => run.focus === "vile-spirits" && run.mode === "guided"),
  ).toBe(true);
});

it("cycles a selected family through supported variants and both target cases", () => {
  const current = makeRun("before-standard-you", 19);
  expect(
    Array.from(
      { length: 5 },
      (_, index) => nextRun(current, "vile-spirits", index).scenario.variantId,
    ),
  ).toEqual([
    "spirits-moving-you",
    "spirits-moving-neighbor",
    "spirits-settled-you",
    "spirits-settled-neighbor",
    "spirits-moving-you",
  ]);
  expect(nextRun(current, "frostmourne-return", 1).scenario.variantId).toBe(
    "frostmourne-return-neighbor",
  );
});

it("makes new seeds repeatable while retries retain the exact starting situation", () => {
  const current = makeRun("before-standard-you", 19);
  const original = structuredClone(current);
  const next = nextRun(current, "before-valkyrs", 1);
  expect(next).toEqual(nextRun(current, "before-valkyrs", 1));
  expect(next.seed).not.toBe(19);
  expect(next.seed).not.toBe(nextRun(current, "before-valkyrs", 2).seed);
  expect(next.seed).not.toBe(
    nextRun({ ...current, seed: 20 }, "before-valkyrs", 1).seed,
  );
  const first = createAttempt(current);
  const startingSituation = structuredClone(first);
  first.world.status = "running";
  advanceAttempt(first, 12, { x: 1, y: 0 });
  expect(createAttempt(current)).toEqual(startingSituation);
  next.profile.defile.radius = 123;
  expect(current).toEqual(original);
});

it.each([-1, 0.5, NaN, Infinity])(
  "rejects an invalid variation index %s",
  (index) => {
    expect(() =>
      nextRun(makeRun("before-standard-you", 19), "mixed", index),
    ).toThrow(/variation/i);
  },
);

it("seeks immutable event IDs across frames even when timestamps and kinds match", () => {
  const a = running("before-standard-you");
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 1 / 60, { x: 0, y: 0 });
  const first = emitEvent(a, {
    at: 0,
    kind: "target",
    sourceId: "same",
    mechanic: "defile",
    checkpointId: "start",
  });
  recordStep(recording, a);
  advanceAttempt(a, 1 / 60, { x: 0, y: 0 });
  const second = emitEvent(a, {
    at: 0,
    kind: "target",
    sourceId: "same",
    mechanic: "defile",
    checkpointId: "start",
  });
  recordStep(recording, a);
  expect(
    frameView(recording, frameIndexForEvent(recording, first.id)).step,
  ).toBe(1);
  expect(
    frameView(recording, frameIndexForEvent(recording, second.id)).step,
  ).toBe(2);
});

it("allows a completed 60-second excerpt without declaring overflow", () => {
  const a = running("before-standard-you");
  a.run.scenario.events = [];
  a.run.scenario.duration = 60;
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 60, { x: 0, y: 0 }, (attempt) =>
    recordStep(recording, attempt),
  );
  expect(frameView(recording, 600).endReason).toBe("completed");
});

it("keeps frame captures bounded when every simulation step has an event", () => {
  const a = running("before-standard-you");
  a.run.scenario.events = [];
  const recording = createRecording();
  recordStep(recording, a);
  advanceAttempt(a, 1, { x: 0, y: 0 }, (attempt) => {
    emitEvent(attempt, {
      kind: "target",
      sourceId: "extra",
      mechanic: "defile",
      checkpointId: "start",
    });
    recordStep(recording, attempt);
    recordStep(recording, attempt);
  });
  expect(recording.frames).toHaveLength(61);
  expect(recording.events).toHaveLength(60);
});

it("rejects revision-one support checkpoints and exactly restores between consecutive soaks", () => {
  const a = running("spirits-settled-neighbor", 18);
  a.run.scenario.checkpoints.push({ id: "intercept", at: 15.5 });
  const recording = createRecording();
  recordStep(recording, a);
  const oldProfile = structuredClone(recording.checkpoints.start);
  oldProfile.profileRevision = 1;
  expect(() => restoreCheckpoint(a.run, oldProfile)).toThrow(/incompatible/i);
  const oldScenario = structuredClone(recording.checkpoints.start);
  oldScenario.scenarioRevision = 1;
  expect(() => restoreCheckpoint(a.run, oldScenario)).toThrow(/incompatible/i);
  advanceAttempt(a, 15.5, { x: 0, y: 0 }, (step) =>
    recordStep(recording, step),
  );
  const b = restoreCheckpoint(
    a.run,
    JSON.parse(JSON.stringify(recording.checkpoints.intercept)),
  );
  b.world.status = "running";
  advanceAttempt(a, 19.5, { x: 0, y: 0 });
  advanceAttempt(b, 19.5, { x: 0, y: 0 });
  expect(b.world).toEqual(a.world);
  expect(b.findings).toEqual(a.findings);
  expect(a.findings.filter((f) => f.severity === "miss")).toEqual([]);
  expect(a.world.events.filter((e) => e.kind === "explosion")).toHaveLength(10);
});
