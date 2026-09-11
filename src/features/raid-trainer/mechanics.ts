import type { AbilityDefinition, Cast, Session } from "./model";

/** Mechanic dispatch is the extension point for cones, soaks, projectiles, etc. */
export function resolveMechanic(
  session: Session,
  cast: Cast,
  ability: AbilityDefinition,
) {
  const target = session.actors.find((actor) => actor.id === cast.targetId)!;
  switch (ability.mechanic.kind) {
    case "growing-pool":
      session.pools.push({
        id: cast.id,
        abilityId: ability.id,
        x: target.x,
        y: target.y,
        radius: ability.mechanic.radius,
        bornAt: session.elapsed,
        expiresAt: session.elapsed + ability.mechanic.lifetimeSeconds,
        nextTick: session.elapsed + ability.mechanic.tickSeconds,
        growths: 0,
      });
      session.events.push({
        at: session.elapsed,
        kind: "pool",
        text: `${ability.name} placed by ${target.name}.`,
      });
  }
}

export function tickMechanics(session: Session) {
  session.pools = session.pools.filter(
    (pool) => session.elapsed < pool.expiresAt,
  );
  for (const pool of session.pools) {
    const ability = session.encounter.abilities[pool.abilityId];
    if (session.elapsed + 1e-9 < pool.nextTick) continue;
    pool.nextTick += ability.mechanic.tickSeconds;
    // Measure all hits before growing, so actor ordering cannot change the result.
    const hit = session.actors.filter(
      (actor) =>
        Math.hypot(actor.x - pool.x, actor.y - pool.y) <
        pool.radius + actor.radius,
    );
    if (!hit.length) continue;
    const personal = hit.filter((actor) => actor.role === "player").length;
    session.stats.personalHits += personal;
    session.stats.raidHits += hit.length - personal;
    session.stats.growths += hit.length;
    pool.growths += hit.length;
    pool.radius += ability.mechanic.growthPerHit * hit.length;
    session.events.push({
      at: session.elapsed,
      kind: "damage",
      text: `${ability.name} grew: ${hit.map((actor) => actor.name).join(", ")} took damage.`,
    });
  }
}
