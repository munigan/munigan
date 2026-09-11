import { assessStep, snapshotFormation } from "./scenario-assessment";
import { stepRaidMovement } from "./raid-strategy";
import { createRoster, validateRun } from "./scenario-content";
import {
  revealDefileTargets,
  startDefile,
  stepDefile,
} from "./scenario-defile";
import { emitEvent } from "./scenario-events";
import type { Attempt, Point, RunSpec, ScriptEvent } from "./scenario-model";
import {
  applyPickup,
  releaseValkyrPassengers,
  startValkyrDescents,
  stepValkyrs,
} from "./scenario-valkyrs";

import {
  activateSpirits,
  spawnSpiritWave,
  stepSpirits,
} from "./scenario-spirits";

const STEP = 1 / 60;
const ROUNDING_TOLERANCE = 1e-10;

export function createAttempt(run: RunSpec): Attempt {
  const errors = validateRun(run);
  if (errors.length > 0) throw new Error(errors.join("; "));
  const ownedRun = structuredClone(run);
  ownedRun.scenario.events = ownedRun.scenario.events
    .map((event, authoredIndex) => ({ event, authoredIndex }))
    .sort(
      (a, b) => a.event.at - b.event.at || a.authoredIndex - b.authoredIndex,
    )
    .map(({ event }) => event);
  const attempt: Attempt = {
    run: ownedRun,
    world: {
      elapsed: 0,
      step: 0,
      status: "ready",
      actors: createRoster(ownedRun),
      casts: [],
      pools: [],
      spirits: [],
      valkyrs: [],
      events: [],
      anchor: { ...ownedRun.scenario.strategy.start },
      stage: ownedRun.scenario.strategy.settledInitially ? "settled" : "stack",
      endReason: null,
    },
    seed: ownedRun.seed,
    rngState: ownedRun.seed >>> 0,
    cursor: 0,
    remainder: 0,
    findings: [],
  };
  const initial = ownedRun.scenario.initialSpirits;
  if (initial)
    spawnSpiritWave(attempt, "initial", initial.origin, initial.firstBirthAt);
  return attempt;
}

function startScheduledEvent(attempt: Attempt, event: ScriptEvent): void {
  switch (event.kind) {
    case "defile":
      startDefile(attempt, event);
      break;
    case "pickup":
      applyPickup(attempt, event);
      break;
    case "relocate":
      attempt.world.stage = "relocate";
      attempt.world.anchor = { ...attempt.run.scenario.strategy.finish };
      emitEvent(attempt, {
        kind: "relocate",
        at: event.at,
        sourceId: event.id,
        mechanic: "strategy",
        position: { ...attempt.world.anchor },
        checkpointId: event.checkpointId,
      });
      break;
    case "check-formation": {
      const anchor = attempt.run.scenario.strategy[event.anchor];
      const controlled = attempt.world.actors.find(
        (actor) => actor.control === "player",
      );
      attempt.world.anchor = { ...anchor };
      attempt.world.stage = "settled";
      emitEvent(attempt, {
        kind: "formation",
        at: event.at,
        sourceId: event.id,
        mechanic: "strategy",
        actorIds: controlled ? [controlled.id] : [],
        position: controlled ? { x: controlled.x, y: controlled.y } : null,
        checkpointId: event.checkpointId,
        obligations: controlled
          ? [
              snapshotFormation(
                attempt,
                controlled,
                anchor,
                "return-to-formation",
              ),
            ]
          : [],
      });
      break;
    }
    case "return":
      emitEvent(attempt, {
        kind: "return",
        at: event.at,
        sourceId: event.id,
        mechanic: "strategy",
        position: { ...attempt.world.anchor },
        checkpointId: event.checkpointId,
      });
      break;
    // The endpoint is applied after movement and contacts, below.
  }
}

function processScheduledEvents(attempt: Attempt): void {
  const events = attempt.run.scenario.events;
  while (
    attempt.cursor < events.length &&
    events[attempt.cursor].at <= attempt.world.elapsed
  ) {
    const event = events[attempt.cursor++];
    startScheduledEvent(attempt, event);
  }
}

function finishAtEndpoint(attempt: Attempt): void {
  if (attempt.world.status !== "running") return;
  if (attempt.world.elapsed < attempt.run.scenario.duration) return;
  attempt.world.status = "complete";
  attempt.world.endReason = "completed";
  const finish = attempt.run.scenario.events.find(
    (event) => event.kind === "finish",
  );
  emitEvent(attempt, {
    kind: "end",
    sourceId: finish?.id ?? attempt.run.scenario.id,
    mechanic: "strategy",
    checkpointId:
      finish?.checkpointId ?? attempt.run.scenario.checkpoints[0]?.id ?? "",
  });
}

export function advanceAttempt(
  attempt: Attempt,
  seconds: number,
  input: Point,
  afterStep?: (attempt: Attempt) => void,
): void {
  if (
    attempt.world.status !== "running" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  )
    return;
  attempt.remainder += seconds;
  while (
    attempt.remainder + ROUNDING_TOLERANCE >= STEP &&
    attempt.world.status === "running"
  ) {
    attempt.remainder = Math.max(0, attempt.remainder - STEP);
    attempt.world.step += 1;
    attempt.world.elapsed = attempt.world.step / 60;
    const eventCount = attempt.world.events.length;
    startValkyrDescents(attempt);
    releaseValkyrPassengers(attempt);
    processScheduledEvents(attempt);
    for (const event of attempt.run.scenario.events.slice(0, attempt.cursor)) {
      if (event.kind === "spirit-wave")
        spawnSpiritWave(attempt, event.id, event.origin, event.at);
    }
    revealDefileTargets(attempt);
    activateSpirits(attempt);
    // Observation updates precede voluntary movement; forced movement follows it.
    stepRaidMovement(attempt, input, STEP);
    stepValkyrs(attempt, STEP);
    stepDefile(attempt);
    stepSpirits(attempt, STEP);
    assessStep(attempt, attempt.world.events.slice(eventCount));
    finishAtEndpoint(attempt);
    afterStep?.(attempt);
  }
  if (attempt.world.status !== "running") attempt.remainder = 0;
}
