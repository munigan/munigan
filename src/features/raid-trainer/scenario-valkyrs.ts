import { snapshotFormation } from "./scenario-assessment";
import { emitEvent } from "./scenario-events";
import { radialPlatformEdge } from "./scenario-geometry";
import type { Actor, Attempt, ScriptEvent, Valkyr } from "./scenario-model";

const EPSILON = 1e-8;

function valkyrId(event: Extract<ScriptEvent, { kind: "pickup" }>): string {
  return `${event.id}:valkyr`;
}

function passengerFor(attempt: Attempt, valkyr: Valkyr): Actor | undefined {
  return attempt.world.actors.find((actor) => actor.id === valkyr.passengerId);
}

function pickupEventFor(
  attempt: Attempt,
  valkyr: Valkyr,
): Extract<ScriptEvent, { kind: "pickup" }> | undefined {
  return attempt.run.scenario.events.find(
    (event): event is Extract<ScriptEvent, { kind: "pickup" }> =>
      event.kind === "pickup" && valkyrId(event) === valkyr.id,
  );
}

function createDescendingValkyr(
  attempt: Attempt,
  event: Extract<ScriptEvent, { kind: "pickup" }>,
): Valkyr | undefined {
  const existing = attempt.world.valkyrs.find(
    (candidate) => candidate.id === valkyrId(event),
  );
  if (existing) return existing;
  const passenger = attempt.world.actors.find(
    (actor) => actor.id === event.actorId,
  );
  if (!passenger) return;
  const valkyr: Valkyr = {
    id: valkyrId(event),
    passengerId: event.actorId,
    pickupAt: event.at,
    releaseAt: event.at + attempt.run.profile.valkyrs.rescue,
    destination: { x: passenger.x, y: passenger.y },
    state: "descending",
    x: passenger.x,
    y: passenger.y,
  };
  attempt.world.valkyrs.push(valkyr);
  return valkyr;
}

/** Pre-movement phase: make authored descents visible at their exact lead time. */
export function startValkyrDescents(attempt: Attempt): void {
  for (const event of attempt.run.scenario.events) {
    if (
      event.kind === "pickup" &&
      attempt.world.elapsed + EPSILON >=
        event.at - attempt.run.profile.valkyrs.descent
    )
      createDescendingValkyr(attempt, event);
  }
}

export function applyPickup(
  attempt: Attempt,
  event: Extract<ScriptEvent, { kind: "pickup" }>,
): void {
  const passenger = attempt.world.actors.find(
    (actor) => actor.id === event.actorId,
  );
  if (
    !passenger ||
    passenger.control !== "npc" ||
    !passenger.available ||
    passenger.carriedBy
  )
    return;
  const valkyr = createDescendingValkyr(attempt, event);
  if (!valkyr || valkyr.state !== "descending") return;

  valkyr.x = passenger.x;
  valkyr.y = passenger.y;
  valkyr.destination = radialPlatformEdge(
    passenger,
    attempt.run.profile.arenaRadius,
  );
  valkyr.state = "carrying";
  passenger.carriedBy = valkyr.id;
  if (passenger.mind) {
    passenger.mind.goal = { x: passenger.x, y: passenger.y };
    passenger.mind.pending ??= [];
  }
  emitEvent(attempt, {
    kind: "pickup",
    at: event.at,
    sourceId: event.id,
    mechanic: "valkyrs",
    actorIds: [passenger.id],
    position: { x: passenger.x, y: passenger.y },
    checkpointId: event.checkpointId,
  });

  const controlled = attempt.world.actors.find(
    (actor) => actor.control === "player",
  );
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
            attempt.world.anchor,
            "hold-formation",
          ),
        ]
      : [],
  });
}

/** Pre-movement phase: rescue wins when its boundary equals an edge arrival. */
export function releaseValkyrPassengers(attempt: Attempt): void {
  for (const valkyr of attempt.world.valkyrs) {
    if (
      valkyr.state !== "carrying" ||
      attempt.world.elapsed + EPSILON < valkyr.releaseAt
    )
      continue;
    const passenger = passengerFor(attempt, valkyr);
    valkyr.state = "released";
    if (!passenger) continue;
    passenger.carriedBy = null;
    if (passenger.mind) {
      passenger.mind.goal = { x: passenger.x, y: passenger.y };
      passenger.mind.observeAt = attempt.world.elapsed;
      passenger.mind.decideAt = attempt.world.elapsed + passenger.mind.reaction;
      passenger.mind.holdUntil = passenger.mind.decideAt;
      passenger.mind.pending ??= [];
    }
    const event = pickupEventFor(attempt, valkyr);
    emitEvent(attempt, {
      kind: "release",
      at: valkyr.releaseAt,
      sourceId: valkyr.id,
      mechanic: "valkyrs",
      actorIds: [passenger.id],
      position: { x: passenger.x, y: passenger.y },
      checkpointId: event?.checkpointId ?? "",
    });
  }
}

function losePassenger(
  attempt: Attempt,
  valkyr: Valkyr,
  passenger: Actor,
): void {
  const event = pickupEventFor(attempt, valkyr);
  valkyr.state = "lost";
  passenger.carriedBy = null;
  passenger.available = false;
  emitEvent(attempt, {
    kind: "loss",
    sourceId: valkyr.id,
    mechanic: "valkyrs",
    actorIds: [passenger.id],
    position: { x: passenger.x, y: passenger.y },
    checkpointId: event?.checkpointId ?? "",
  });
  attempt.world.status = "failed";
  attempt.world.endReason = "actor-lost";
  emitEvent(attempt, {
    kind: "end",
    sourceId: valkyr.id,
    mechanic: "valkyrs",
    actorIds: [passenger.id],
    position: { x: passenger.x, y: passenger.y },
    checkpointId: event?.checkpointId ?? "",
  });
}

/** Post-voluntary phase: integrate only authored forced carry movement. */
export function stepValkyrs(attempt: Attempt, dt: number): void {
  for (const valkyr of attempt.world.valkyrs) {
    if (valkyr.state !== "carrying") continue;
    const passenger = passengerFor(attempt, valkyr);
    if (!passenger) continue;
    if (
      attempt.world.elapsed >
      valkyr.pickupAt + attempt.run.profile.valkyrs.stun + EPSILON
    ) {
      const dx = valkyr.destination.x - valkyr.x;
      const dy = valkyr.destination.y - valkyr.y;
      const distance = Math.hypot(dx, dy);
      const travel = Math.min(distance, attempt.run.profile.valkyrs.speed * dt);
      if (distance > EPSILON) {
        valkyr.x += (dx / distance) * travel;
        valkyr.y += (dy / distance) * travel;
      }
    }
    passenger.x = valkyr.x;
    passenger.y = valkyr.y;
    if (
      Math.hypot(valkyr.x, valkyr.y) + EPSILON >=
      attempt.run.profile.arenaRadius
    ) {
      losePassenger(attempt, valkyr, passenger);
      return;
    }
  }
}
