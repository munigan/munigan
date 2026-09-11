import { emitEvent } from "./scenario-events";
import { radialPlatformEdge } from "./scenario-geometry";
import type {
  Actor,
  Attempt,
  Finding,
  FormationObligation,
  Point,
  World,
  WorldEvent,
} from "./scenario-model";

export function summarizeAttempt(attempt: Attempt): {
  outcome: "clean" | "imperfect" | "failed";
  primary: Finding[];
  supporting: Finding[];
  endReason: World["endReason"];
} {
  const misses = attempt.findings.filter(
    (finding) => finding.severity === "miss",
  );
  return {
    outcome:
      attempt.world.status === "failed"
        ? "failed"
        : misses.length
          ? "imperfect"
          : "clean",
    primary: attempt.findings.filter(
      (finding) => finding.mechanic === attempt.run.focus,
    ),
    supporting: attempt.findings.filter(
      (finding) => finding.mechanic !== attempt.run.focus,
    ),
    endReason: attempt.world.endReason,
  };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Own both position and exemption evidence at the milestone, before any movement. */
export function snapshotFormation(
  attempt: Attempt,
  actor: Actor,
  anchor: Point,
  responsibility: FormationObligation["responsibility"],
): FormationObligation {
  const obligation: FormationObligation = {
    actorId: actor.id,
    position: { x: actor.x, y: actor.y },
    anchor: { ...anchor },
    radius: attempt.run.scenario.strategy.formationRadius,
    responsibility,
  };
  const exempt = (reason: string, sourceIds: string[]) => {
    obligation.exemption = { reason, sourceIds };
    return obligation;
  };
  if (actor.carriedBy) return exempt("carried by a Val’kyr", [actor.carriedBy]);
  // Automated actors retain their delayed observation; the player sees current public hazards.
  const observation =
    actor.control === "npc" ? actor.mind?.observed : undefined;
  const targets =
    observation?.targetIds ??
    attempt.world.casts
      .filter((cast) => !cast.resolved && cast.targetId !== null)
      .map((cast) => cast.targetId!);
  if (targets.includes(actor.id))
    return exempt("placing the revealed Defile", [actor.id]);
  const hazards = observation?.hazards ?? [
    ...attempt.world.pools
      .filter((pool) => pool.expiresAt > attempt.world.elapsed)
      .map((pool) => ({ ...pool, kind: "pool" as const })),
    ...attempt.world.spirits
      .filter(
        (spirit) =>
          spirit.activeAt <= attempt.world.elapsed &&
          spirit.explodedAt === null,
      )
      .map((spirit) => ({
        ...spirit,
        radius: attempt.run.profile.spirits.burstRadius,
        kind: "spirit" as const,
      })),
  ];
  const ownPool = hazards.find(
    (hazard) =>
      "targetId" in hazard &&
      hazard.targetId === actor.id &&
      hazard.kind === "pool" &&
      distance(actor, hazard) < hazard.radius + actor.radius,
  );
  if (ownPool) return exempt("exiting own Defile", [ownPool.id]);
  const recovering = attempt.world.pools.find(
    (pool) =>
      pool.targetId === actor.id &&
      pool.formationRecovery &&
      !pool.formationRecovery.completed &&
      attempt.world.elapsed < pool.formationRecovery.until,
  );
  if (recovering)
    return exempt("rejoining after Defile (authored recovery allowance)", [
      recovering.id,
    ]);
  const danger = hazards.find(
    (hazard) =>
      !(actor.role === "soaker" && hazard.kind === "spirit") &&
      (distance(actor, hazard) < hazard.radius + actor.radius ||
        distance(anchor, hazard) <
          hazard.radius + obligation.radius + actor.radius),
  );
  if (danger)
    return exempt("immediate observed hazard makes formation unsafe", [
      danger.id,
    ]);
  return obligation;
}

function addFinding(
  attempt: Attempt,
  event: WorldEvent,
  actorId: string,
  code: Finding["code"],
  severity: Finding["severity"],
  detail: string,
): void {
  const id = `${event.id}:${actorId}:${code}`;
  if (attempt.findings.some((finding) => finding.id === id)) return;
  attempt.findings.push({
    id,
    eventId: event.id,
    at: event.at,
    actorId,
    mechanic: event.mechanic,
    code,
    severity,
    detail,
  });
}

function segmentDistance(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const squared = dx * dx + dy * dy;
  const fraction = squared
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - from.x) * dx + (point.y - from.y) * dy) / squared,
        ),
      )
    : 0;
  return distance(point, {
    x: from.x + fraction * dx,
    y: from.y + fraction * dy,
  });
}

/** Conservatively permits escape from an occupied pool to the nearest clear 1-yard cell. */
function reachableClearCells(attempt: Attempt, actor: Actor): number {
  const boundary = attempt.run.profile.arenaRadius - actor.radius;
  const limit = Math.floor(boundary);
  const width = limit * 2 + 1;
  const clear = new Uint8Array(width * width);
  let seed = -1,
    nearest = Infinity;
  for (let y = -limit; y <= limit; y++) {
    for (let x = -limit; x <= limit; x++) {
      const point = { x, y };
      if (
        Math.hypot(x, y) > boundary ||
        attempt.world.pools.some(
          (pool) =>
            pool.expiresAt > attempt.world.elapsed &&
            distance(point, pool) < pool.radius + actor.radius,
        )
      )
        continue;
      const index = (y + limit) * width + x + limit;
      clear[index] = 1;
      const away = distance(point, actor);
      if (away < nearest) {
        nearest = away;
        seed = index;
      }
    }
  }
  if (seed < 0) return 0;
  const queue = [seed];
  clear[seed] = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const column = index % width;
    const neighbors = [index - width, index + width];
    if (column > 0) neighbors.push(index - 1);
    if (column + 1 < width) neighbors.push(index + 1);
    for (const next of neighbors) {
      if (next < 0 || next >= clear.length || !clear[next]) continue;
      clear[next] = 0;
      queue.push(next);
    }
  }
  return queue.length;
}

export function assessStep(
  attempt: Attempt,
  newEvents: readonly WorldEvent[],
): void {
  for (const event of newEvents) {
    if (event.kind === "damage" || event.kind === "explosion") {
      for (const actorId of event.actorIds) {
        const protectedSoak =
          event.mechanic === "vile-spirits" &&
          event.protectedActorIds.includes(actorId);
        addFinding(
          attempt,
          event,
          actorId,
          "exposure",
          protectedSoak ? "info" : "miss",
          protectedSoak
            ? "intentional spirit soak protected by automated support"
            : `${actorId === "you" ? "you" : actorId} took ${event.mechanic === "defile" ? "Defile" : "spirit burst"} damage`,
        );
      }
    }
    if (event.kind === "formation") {
      for (const obligation of event.obligations) {
        if (obligation.exemption)
          addFinding(
            attempt,
            event,
            obligation.actorId,
            "formation-exempt",
            "info",
            obligation.exemption.reason,
          );
        else if (
          distance(obligation.position, obligation.anchor) > obligation.radius
        )
          addFinding(
            attempt,
            event,
            obligation.actorId,
            "outside-formation",
            "miss",
            obligation.responsibility === "hold-formation"
              ? "outside the assigned stack at pickup"
              : "outside the assigned formation at the return check",
          );
      }
    }
    if (
      event.kind === "pool" ||
      (event.kind === "damage" && event.mechanic === "defile")
    ) {
      const pool = attempt.world.pools.find(
        (pool) => pool.id === event.sourceId,
      );
      const strategy = attempt.run.scenario.strategy;
      const phaseTwo =
        attempt.run.scenario.family === "before-valkyrs" ||
        attempt.run.scenario.family === "after-valkyrs";
      const finish = phaseTwo
        ? radialPlatformEdge(strategy.start, attempt.run.profile.arenaRadius)
        : strategy.finish;
      if (
        pool &&
        segmentDistance(pool, strategy.start, finish) <
          pool.radius + strategy.routeHalfWidth
      )
        for (const actorId of event.actorIds)
          addFinding(
            attempt,
            event,
            actorId,
            "route-overlap",
            "miss",
            "pool overlapped the planned route",
          );
    }
  }
  const actor = attempt.world.actors.find(
    (actor) => actor.control === "player",
  );
  if (
    attempt.world.status === "running" &&
    actor &&
    attempt.world.pools.length &&
    reachableClearCells(attempt, actor) === 0
  ) {
    attempt.world.status = "failed";
    attempt.world.endReason = "platform-unusable";
    emitEvent(attempt, {
      kind: "end",
      sourceId: attempt.run.scenario.id,
      mechanic: "defile",
      checkpointId: newEvents.at(-1)?.checkpointId ?? "",
    });
  }
}
