import { nextRandom } from "./scenario-random";
import { emitEvent } from "./scenario-events";
import type { Actor, Attempt, Cast, ScriptEvent } from "./scenario-model";

export function startDefile(
  attempt: Attempt,
  event: Extract<ScriptEvent, { kind: "defile" }>,
): void {
  const { defile } = attempt.run.profile;
  attempt.world.casts.push({
    id: event.id,
    startedAt: event.at,
    revealAt: event.at + defile.revealDelay,
    resolvesAt: event.at + defile.cast,
    targetCase: event.target,
    targetId: null,
    resolved: false,
  });
  emitEvent(attempt, {
    kind: "cast",
    at: event.at,
    sourceId: event.id,
    mechanic: "defile",
    checkpointId: event.checkpointId,
  });
}

function selectTarget(attempt: Attempt, cast: Cast): Actor | undefined {
  const you = attempt.world.actors.find((actor) => actor.id === "you");
  if (cast.targetCase === "you") return you;
  if (!you) return;
  const passengerIds = new Set(
    attempt.run.scenario.events
      .filter(
        (event): event is Extract<ScriptEvent, { kind: "pickup" }> =>
          event.kind === "pickup",
      )
      .map((event) => event.actorId),
  );
  const distance = (actor: Actor) =>
    Math.hypot(actor.x - you.x, actor.y - you.y);
  const eligible = attempt.world.actors
    .filter(
      (actor) =>
        actor.control === "npc" &&
        actor.available &&
        !actor.carriedBy &&
        !passengerIds.has(actor.id) &&
        (actor.role === "melee" || actor.role === "ranged"),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const nearby = eligible.filter((actor) => distance(actor) <= 8);
  if (nearby.length === 0)
    return eligible.sort(
      (a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id),
    )[0];
  // Consume randomness only when the target becomes observable, never at cast start.
  return nearby[Math.floor(nextRandom(attempt) * nearby.length)];
}

function checkpointFor(attempt: Attempt, castId: string): string {
  const event = attempt.run.scenario.events.find(
    (event) => event.id === castId,
  );
  if (!event) throw new Error(`Missing authored Defile event: ${castId}`);
  return event.checkpointId;
}

/** Pre-movement phase: controllers may now observe this step's revealed target. */
export function revealDefileTargets(attempt: Attempt): void {
  for (const cast of attempt.world.casts) {
    if (
      cast.resolved ||
      cast.targetId !== null ||
      attempt.world.elapsed < cast.revealAt
    )
      continue;
    const target = selectTarget(attempt, cast);
    if (!target) continue;
    cast.targetId = target.id;
    emitEvent(attempt, {
      kind: "target",
      at: cast.revealAt,
      sourceId: cast.id,
      mechanic: "defile",
      actorIds: [target.id],
      position: { x: target.x, y: target.y },
      checkpointId: checkpointFor(attempt, cast.id),
    });
  }
}

/** Post-movement phase: finish casts at current positions, then resolve pool ticks. */
export function stepDefile(attempt: Attempt): void {
  const { world } = attempt;
  const { defile } = attempt.run.profile;
  for (const cast of world.casts) {
    if (cast.resolved || world.elapsed < cast.resolvesAt) continue;
    cast.resolved = true;
    const target = world.actors.find((actor) => actor.id === cast.targetId);
    if (!target) continue;
    const pool = {
      id: `${cast.id}:pool`,
      targetId: target.id,
      x: target.x,
      y: target.y,
      radius: defile.radius,
      bornAt: cast.resolvesAt,
      expiresAt: cast.resolvesAt + defile.life,
      nextTick: cast.resolvesAt + defile.firstTick,
      growths: 0,
      // Authored recovery allowance: drop-to-formation travel plus outward escape and return.
      // This is a bounded strategy accommodation, not a proof of an exact safe route.
      formationRecovery: {
        anchor: { ...world.anchor },
        radius: attempt.run.scenario.strategy.formationRadius,
        until:
          cast.resolvesAt +
          (Math.hypot(target.x - world.anchor.x, target.y - world.anchor.y) +
            2 * (defile.radius + target.radius)) /
            attempt.run.profile.runSpeed,
        completed: false,
      },
    };
    world.pools.push(pool);
    emitEvent(attempt, {
      kind: "pool",
      at: pool.bornAt,
      sourceId: pool.id,
      mechanic: "defile",
      actorIds: [target.id],
      position: { x: pool.x, y: pool.y },
      checkpointId: checkpointFor(attempt, cast.id),
    });
  }
  world.pools = world.pools.filter((pool) => world.elapsed < pool.expiresAt);
  for (const pool of world.pools) {
    const recovery = pool.formationRecovery;
    const target = world.actors.find((actor) => actor.id === pool.targetId);
    if (
      recovery &&
      !recovery.completed &&
      target &&
      (world.elapsed >= recovery.until ||
        Math.hypot(
          target.x - recovery.anchor.x,
          target.y - recovery.anchor.y,
        ) <= recovery.radius)
    )
      recovery.completed = true;
    while (world.elapsed >= pool.nextTick) {
      const hit = world.actors.filter(
        (actor) =>
          actor.available &&
          !actor.carriedBy &&
          Math.hypot(actor.x - pool.x, actor.y - pool.y) <
            pool.radius + actor.radius,
      );
      pool.radius *= Math.pow(defile.growthFactor, hit.length);
      pool.growths += hit.length;
      if (hit.length > 0) {
        emitEvent(attempt, {
          kind: "damage",
          at: pool.nextTick,
          sourceId: pool.id,
          mechanic: "defile",
          actorIds: hit.map((actor) => actor.id).sort(),
          position: { x: pool.x, y: pool.y },
          amount: hit.length,
          checkpointId: checkpointFor(
            attempt,
            pool.id.slice(0, -":pool".length),
          ),
        });
      }
      pool.nextTick += defile.tick;
    }
  }
}
