import {
  makeRun,
  scenarioFamilies,
  scenarioVariantIds,
} from "./scenario-content";
import { emitEvent } from "./scenario-events";
import type {
  Attempt,
  Checkpoint,
  Family,
  Recording,
  RunSpec,
  World,
} from "./scenario-model";
import { createAttempt } from "./scenario-runtime";

const MAX_SECONDS = 60;
const MAX_EVENTS = 2000;

export function createRecording(): Recording {
  return { frames: [], events: [], findings: [], checkpoints: {} };
}

/** Call at initialization and from advanceAttempt's resolved-step callback. */
export function recordStep(recording: Recording, attempt: Attempt): void {
  const { world, run, seed, rngState, cursor, findings } = attempt;
  const previous = recording.frames.at(-1);
  if (previous?.world.endReason === "recording-limit") return;

  const interrupted =
    world.events.length > MAX_EVENTS ||
    (world.status === "running" &&
      (world.elapsed >= MAX_SECONDS || world.events.length === MAX_EVENTS));
  if (interrupted) {
    world.status = "failed";
    world.endReason = "recording-limit";
    attempt.remainder = 0;
    const retainedEvents = world.events.slice(0, MAX_EVENTS - 1);
    const end = emitEvent(attempt, {
      kind: "end",
      sourceId: "recording-limit",
      mechanic: "strategy",
      checkpointId: run.scenario.checkpoints[0]?.id ?? "",
    });
    // Reserve a slot for the explicit interruption; never relabel event IDs.
    recording.events = structuredClone([...retainedEvents, end]);
  } else {
    recording.events.push(
      ...structuredClone(world.events.slice(recording.events.length)),
    );
  }
  recording.findings.push(
    ...structuredClone(findings.slice(recording.findings.length)),
  );

  let capturedCheckpoint = false;
  for (const checkpoint of run.scenario.checkpoints) {
    if (
      Math.ceil(checkpoint.at * 60) !== world.step ||
      Object.hasOwn(recording.checkpoints, checkpoint.id) ||
      interrupted
    )
      continue;
    Object.defineProperty(recording.checkpoints, checkpoint.id, {
      value: structuredClone({
        runId: run.scenario.id,
        scenarioRevision: run.scenario.revision,
        profileRevision: run.profile.revision,
        seed,
        world,
        rngState,
        cursor,
        findings,
      }),
      enumerable: true,
      configurable: true,
      writable: true,
    });
    capturedCheckpoint = true;
  }
  if (
    previous &&
    world.step % 6 !== 0 &&
    previous.eventCount === recording.events.length &&
    !capturedCheckpoint &&
    world.status !== "complete" &&
    world.status !== "failed"
  )
    return;

  const { events, ...snapshot } = world;
  const frame = structuredClone({
    world: snapshot,
    eventCount: interrupted ? recording.events.length : events.length,
    findingCount: recording.findings.length,
  });
  // Event/checkpoint/terminal captures on the cadence share the same frame.
  if (previous?.world.step === world.step)
    recording.frames[recording.frames.length - 1] = frame;
  else recording.frames.push(frame);
}

export function restoreCheckpoint(
  run: RunSpec,
  checkpoint: Checkpoint,
): Attempt {
  if (
    checkpoint.runId !== run.scenario.id ||
    checkpoint.scenarioRevision !== run.scenario.revision ||
    checkpoint.profileRevision !== run.profile.revision
  )
    throw new Error(
      "Practice checkpoint is incompatible with this scenario/profile revision",
    );
  const attempt = createAttempt({ ...run, seed: checkpoint.seed });
  Object.assign(
    attempt,
    structuredClone({
      seed: checkpoint.seed,
      world: checkpoint.world,
      rngState: checkpoint.rngState,
      cursor: checkpoint.cursor,
      findings: checkpoint.findings,
    }),
  );
  attempt.world.status = "countdown";
  attempt.remainder = 0;
  return attempt;
}

export function resumePractice(
  run: RunSpec,
  recording: Recording,
  checkpointId: string,
): { attempt: Attempt; recording: Recording } {
  const checkpoint = Object.hasOwn(recording.checkpoints, checkpointId)
    ? recording.checkpoints[checkpointId]
    : undefined;
  if (!checkpoint) throw new Error("Practice checkpoint is unavailable");
  const attempt = restoreCheckpoint(run, checkpoint);
  return {
    attempt,
    recording: structuredClone({
      frames: recording.frames.filter(
        (frame) => frame.world.step <= checkpoint.world.step,
      ),
      events: checkpoint.world.events,
      findings: checkpoint.findings,
      checkpoints: Object.fromEntries(
        Object.entries(recording.checkpoints).filter(
          ([, value]) => value.world.step <= checkpoint.world.step,
        ),
      ),
    }),
  };
}

export function frameView(recording: Recording, index: number): World {
  const frame = recording.frames[index];
  if (!frame) throw new Error("Replay frame is unavailable");
  return structuredClone({
    ...frame.world,
    events: recording.events.slice(0, frame.eventCount),
  });
}

export function frameIndexForEvent(
  recording: Recording,
  eventId: string,
): number {
  const eventIndex = recording.events.findIndex(
    (event) => event.id === eventId,
  );
  const frameIndex =
    eventIndex < 0
      ? -1
      : recording.frames.findIndex((frame) => frame.eventCount > eventIndex);
  if (frameIndex < 0) throw new Error("Replay event is unavailable");
  return frameIndex;
}

export function nextRun(
  current: RunSpec,
  family: Family | "mixed",
  variationIndex: number,
): RunSpec {
  if (!Number.isSafeInteger(variationIndex) || variationIndex < 0)
    throw new Error("Variation index must be a nonnegative integer");
  const selected =
    family === "mixed" ? scenarioFamilies[variationIndex % 4] : family;
  const variants = scenarioVariantIds(selected);
  const familyIndex =
    family === "mixed" ? Math.floor(variationIndex / 4) : variationIndex;
  // An odd offset gives each variation a fresh deterministic uint32 seed.
  const offset = (Math.imul(variationIndex, 0x9e3779b8) + 0x9e3779b9) >>> 0;
  const seed = ((current.seed >>> 0) + offset) >>> 0;
  const run = makeRun(
    variants[familyIndex % variants.length],
    seed,
    current.focus,
    current.mode,
  );
  run.profile = structuredClone(current.profile);
  run.scenario.profileId = run.profile.id;
  return run;
}
