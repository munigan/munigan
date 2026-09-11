import { emitEvent } from "./scenario-events";
import type { Actor, Attempt, Point, Spirit } from "./scenario-model";
import { nextRandom } from "./scenario-random";

const EPSILON = 1e-8;
const EXPLOSION_VISUAL_LIFE = 0.6;

function checkpointFor(attempt: Attempt, spiritId: string): string {
  return (
    attempt.run.scenario.events.find((event) =>
      spiritId.startsWith(`${event.id}:spirit-`),
    )?.checkpointId ??
    attempt.run.scenario.checkpoints[0]?.id ??
    ""
  );
}

/** Materialize only births reached so far; retained spawn events prevent respawning resolved spirits. */
export function spawnSpiritWave(
  attempt: Attempt,
  sourceId: string,
  origin: Point,
  firstBirthAt: number,
): void {
  const { world } = attempt;
  const profile = attempt.run.profile.spirits;
  for (let index = 0; index < profile.count; index++) {
    const bornAt = firstBirthAt + index * profile.spawnInterval;
    if (bornAt > world.elapsed + EPSILON) break;
    const id = `${sourceId}:spirit-${index + 1}`;
    if (
      world.events.some(
        (event) => event.kind === "spirit-spawn" && event.sourceId === id,
      )
    )
      continue;
    world.spirits.push({
      id,
      ...origin,
      bornAt,
      activeAt: bornAt + profile.activationAge,
      expiresAt: bornAt + profile.maxAge,
      targetId: null,
      explodedAt: null,
    });
    emitEvent(attempt, {
      kind: "spirit-spawn",
      at: bornAt,
      sourceId: id,
      mechanic: "vile-spirits",
      position: { ...origin },
      checkpointId: checkpointFor(attempt, id),
    });
  }
}

function available(actor: Actor): boolean {
  return actor.available && !actor.carriedBy;
}
function targetEligible(actor: Actor): boolean {
  return available(actor) && actor.role !== "tank" && actor.role !== "soaker";
}

/** Pre-movement phase: activation and replacement targets are visible to this step's observations. */
export function activateSpirits(attempt: Attempt): void {
  const { world } = attempt;
  for (const spirit of [...world.spirits].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (spirit.explodedAt !== null || world.elapsed + EPSILON < spirit.activeAt)
      continue;
    const current = world.actors.find((actor) => actor.id === spirit.targetId);
    if (current && targetEligible(current)) continue;
    const eligible = world.actors
      .filter(targetEligible)
      .sort((a, b) => a.id.localeCompare(b.id));
    const target = eligible.length
      ? eligible[Math.floor(nextRandom(attempt) * eligible.length)]
      : undefined;
    const targetId = target?.id ?? null;
    if (targetId === spirit.targetId) continue;
    spirit.targetId = targetId;
    emitEvent(attempt, {
      kind: "spirit-active",
      sourceId: spirit.id,
      mechanic: "vile-spirits",
      actorIds: target ? [target.id] : [],
      position: { x: spirit.x, y: spirit.y },
      checkpointId: checkpointFor(attempt, spirit.id),
    });
  }
}

/** Earliest segment/circle intersection, including an actor already touching the spirit. */
function contactFraction(
  from: Point,
  to: Point,
  actor: Actor,
  triggerRadius: number,
): number | null {
  const x = from.x - actor.x,
    y = from.y - actor.y;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const radius = triggerRadius + actor.radius;
  const c = x * x + y * y - radius * radius;
  if (c <= EPSILON) return 0;
  const a = dx * dx + dy * dy;
  if (a <= EPSILON) return null;
  const b = x * dx + y * dy;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

function explode(attempt: Attempt, spirit: Spirit, contact: Point): void {
  spirit.x = contact.x;
  spirit.y = contact.y;
  spirit.explodedAt = attempt.world.elapsed;
  const affected = attempt.world.actors
    .filter(
      (actor) =>
        available(actor) &&
        Math.hypot(actor.x - contact.x, actor.y - contact.y) <=
          attempt.run.profile.spirits.burstRadius + actor.radius,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const protectedIds = affected
    .filter((actor) => actor.role === "soaker")
    .map((actor) => actor.id);
  emitEvent(attempt, {
    kind: "explosion",
    sourceId: spirit.id,
    mechanic: "vile-spirits",
    position: { ...contact },
    actorIds: affected.map((actor) => actor.id),
    protectedActorIds: protectedIds,
    amount: affected.length - protectedIds.length,
    checkpointId: checkpointFor(attempt, spirit.id),
  });
}

/** Post-movement phase: pursue current targets and resolve first contact against every free actor. */
export function stepSpirits(attempt: Attempt, dt: number): void {
  const { world } = attempt;
  const profile = attempt.run.profile.spirits;
  world.spirits = world.spirits.filter(
    (spirit) =>
      spirit.explodedAt === null ||
      world.elapsed + EPSILON < spirit.explodedAt + EXPLOSION_VISUAL_LIFE,
  );
  for (const spirit of [...world.spirits].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (spirit.explodedAt !== null) continue;
    if (world.elapsed + EPSILON >= spirit.expiresAt) {
      if (world.status !== "running") return;
      world.status = "failed";
      world.endReason = "spirit-unresolved";
      emitEvent(attempt, {
        kind: "end",
        sourceId: spirit.id,
        mechanic: "vile-spirits",
        position: { x: spirit.x, y: spirit.y },
        checkpointId: checkpointFor(attempt, spirit.id),
      });
      return;
    }
    if (world.elapsed + EPSILON < spirit.activeAt) continue;
    const target = world.actors.find(
      (actor) => actor.id === spirit.targetId && targetEligible(actor),
    );
    const destination = { x: spirit.x, y: spirit.y };
    if (target) {
      const dx = target.x - spirit.x,
        dy = target.y - spirit.y;
      const length = Math.hypot(dx, dy);
      const travel = Math.min(length, profile.speed * dt);
      if (length > EPSILON) {
        destination.x += (dx / length) * travel;
        destination.y += (dy / length) * travel;
      }
    }
    let firstContact: number | null = null;
    let contactActors: Actor[] = [];
    for (const actor of world.actors.filter(available)) {
      const t = contactFraction(
        spirit,
        destination,
        actor,
        profile.triggerRadius,
      );
      if (t !== null && (firstContact === null || t < firstContact)) {
        firstContact = t;
        contactActors = [actor];
      } else if (
        t !== null &&
        firstContact !== null &&
        Math.abs(t - firstContact) <= EPSILON
      ) {
        contactActors.push(actor);
      }
    }
    if (firstContact !== null) {
      const contactActor = contactActors.find(
        (actor) => actor.role === "soaker",
      );
      if (contactActor?.mind) {
        // Local feedback from its own completed action is immediate. Other
        // actors and new threats retain delayed perception; queued snapshots
        // cannot resurrect a spirit this soaker has physically contacted.
        const mind = contactActor.mind;
        for (const observation of [mind.observed, ...(mind.pending ?? [])])
          observation.hazards = observation.hazards.filter(
            (hazard) => hazard.id !== spirit.id,
          );
        mind.holdUntil = world.elapsed;
        mind.decideAt = world.elapsed;
      }
      explode(attempt, spirit, {
        x: spirit.x + (destination.x - spirit.x) * firstContact,
        y: spirit.y + (destination.y - spirit.y) * firstContact,
      });
    } else {
      spirit.x = destination.x;
      spirit.y = destination.y;
    }
  }
}
