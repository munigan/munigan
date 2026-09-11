import type {
  Actor,
  Attempt,
  Circle,
  Mind,
  Observation,
  Point,
} from "./scenario-model";

const LOOKAHEAD = 0.5;
const EPSILON = 1e-8;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function clearance(from: Point, to: Point, circle: Circle): number {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((circle.x - from.x) * dx + (circle.y - from.y) * dy) /
              lengthSquared,
          ),
        );
  return (
    distance({ x: from.x + dx * t, y: from.y + dy * t }, circle) - circle.radius
  );
}

function isPhaseThree(attempt: Attempt): boolean {
  return (
    attempt.run.scenario.family === "vile-spirits" ||
    attempt.run.scenario.family === "frostmourne-return"
  );
}

function dangerFor(actor: Actor, observed: Observation) {
  // The assigned spirit soak is protected by authored automated support. Pools are never protected.
  return observed.hazards.filter(
    (hazard) => !(actor.role === "soaker" && hazard.kind === "spirit"),
  );
}

/** Capture at decision cadence, deliver only after reaction time; every position is owned. */
function observeRaid(attempt: Attempt): void {
  const { world } = attempt;
  const interval = attempt.run.profile.npc.decisionInterval;
  for (const actor of world.actors) {
    const mind = actor.mind;
    if (!mind) continue;
    mind.pending ??= [];
    if (world.elapsed + EPSILON >= mind.observeAt) {
      const targetIds = world.casts
        .filter((cast) => !cast.resolved && cast.targetId !== null)
        .map((cast) => cast.targetId!);
      mind.pending.push({
        at: world.elapsed,
        eventIds: world.events.map((event) => event.id),
        targetIds,
        targets: world.actors
          .filter((candidate) => targetIds.includes(candidate.id))
          .map(({ id, x, y }) => ({ id, x, y })),
        anchor: { ...world.anchor },
        stage: world.stage,
        hazards: [
          ...world.pools.map(({ id, x, y, radius, targetId }) => ({
            id,
            x,
            y,
            radius,
            targetId,
            kind: "pool" as const,
          })),
          ...world.spirits
            .filter(
              (spirit) =>
                spirit.activeAt <= world.elapsed && spirit.explodedAt === null,
            )
            .map(({ id, x, y }) => ({
              id,
              x,
              y,
              radius: attempt.run.profile.spirits.burstRadius,
              kind: "spirit" as const,
            })),
        ].sort((a, b) => a.id.localeCompare(b.id)),
      });
      mind.observeAt = world.elapsed + interval;
    }
    while (
      mind.pending.length &&
      mind.pending[0].at + mind.reaction <= world.elapsed + EPSILON
    ) {
      const next = mind.pending.shift()!;
      const changedDanger = dangerFor(actor, next).some((hazard) => {
        const previous = mind.observed.hazards.find(
          (old) => old.id === hazard.id,
        );
        const changed =
          !previous ||
          previous.x !== hazard.x ||
          previous.y !== hazard.y ||
          previous.radius !== hazard.radius;
        return changed && clearance(actor, mind.goal, hazard) < actor.radius;
      });
      const newlyTargeted =
        next.targetIds.includes(actor.id) &&
        !mind.observed.targetIds.includes(actor.id);
      // A delivered target warning invalidates a now-unsafe committed route.
      // It has already paid the authored observation and reaction delays.
      const changedIntercept =
        actor.role === "soaker" &&
        next.hazards.some((hazard) => {
          if (hazard.kind !== "spirit") return false;
          const previous = mind.observed.hazards.find(
            (old) => old.id === hazard.id,
          );
          return (
            !previous || previous.x !== hazard.x || previous.y !== hazard.y
          );
        });
      mind.observed = next;
      if (changedDanger || newlyTargeted || changedIntercept) {
        mind.holdUntil = world.elapsed;
        mind.decideAt = world.elapsed;
      }
    }
  }
}

function formationAnchor(attempt: Attempt, mind: Mind): Point {
  const strategy = attempt.run.scenario.strategy;
  return strategy.relocateAt !== null && mind.observed.at >= strategy.relocateAt
    ? strategy.finish
    : (mind.observed.anchor ?? strategy.start);
}

function formationGoal(attempt: Attempt, actor: Actor, mind: Mind): Point {
  const strategy = attempt.run.scenario.strategy;
  const at = mind.observed.at;
  const relocating = strategy.relocateAt !== null && at >= strategy.relocateAt;
  const anchor = formationAnchor(attempt, mind);
  if (isPhaseThree(attempt) && actor.role === "soaker") {
    mind.reason = "protected spirit intercept";
    const incoming = mind.observed.hazards
      .filter(
        (hazard) =>
          hazard.kind === "spirit" &&
          distance(hazard, strategy.soak) <=
            hazard.radius + strategy.soakInterceptRadius,
      )
      .sort(
        (a, b) =>
          // Intercept the leading threat before a closer trailing spirit.
          distance(a, anchor) - distance(b, anchor) || a.id.localeCompare(b.id),
      )[0];
    if (incoming) {
      // Predict the observed approach over its age, using the authored pursuit
      // speed and raid anchor rather than hidden current targets or positions.
      const towardRaid = distance(incoming, anchor) || 1;
      const lead =
        attempt.run.profile.spirits.speed *
        Math.max(0, attempt.world.elapsed - mind.observed.at);
      const predicted = {
        x: incoming.x + ((anchor.x - incoming.x) / towardRaid) * lead,
        y: incoming.y + ((anchor.y - incoming.y) / towardRaid) * lead,
      };
      const length = distance(predicted, strategy.soak);
      const correction = Math.min(length, strategy.soakInterceptRadius);
      const intercept = {
        x:
          strategy.soak.x +
          (length > EPSILON
            ? ((predicted.x - strategy.soak.x) / length) * correction
            : 0),
        y:
          strategy.soak.y +
          (length > EPSILON
            ? ((predicted.y - strategy.soak.y) / length) * correction
            : 0),
      };
      const raidClearance =
        attempt.run.profile.spirits.burstRadius +
        Math.max(strategy.formationRadius, 4) +
        actor.radius +
        attempt.run.profile.spirits.triggerRadius +
        actor.radius;
      if (distance(intercept, anchor) <= raidClearance) {
        // Stop at the last safe point instead of abandoning an almost-reached
        // interception when prediction crosses the protected raid/tank margin.
        let low = 0,
          high = 1;
        for (let i = 0; i < 20; i++) {
          const fraction = (low + high) / 2;
          const point = {
            x: strategy.soak.x + (intercept.x - strategy.soak.x) * fraction,
            y: strategy.soak.y + (intercept.y - strategy.soak.y) * fraction,
          };
          if (distance(point, anchor) > raidClearance) low = fraction;
          else high = fraction;
        }
        return {
          x: strategy.soak.x + (intercept.x - strategy.soak.x) * low,
          y: strategy.soak.y + (intercept.y - strategy.soak.y) * low,
        };
      }
      return intercept;
    }
    return strategy.soak;
  }
  if (actor.role === "tank") {
    mind.reason = "boss position";
    const incoming = isPhaseThree(attempt)
      ? strategy.spiritOrigin
      : { x: anchor.x, y: anchor.y - 1 };
    const length = distance(anchor, incoming) || 1;
    return {
      x: anchor.x + ((incoming.x - anchor.x) / length) * 4,
      y: anchor.y + ((incoming.y - anchor.y) / length) * 4,
    };
  }
  const released =
    strategy.releaseStackAt !== null && at >= strategy.releaseStackAt;
  // Start rejoining with enough time for travel, a reaction and one committed route.
  const rejoinAt =
    strategy.finishCheckAt -
    6 / attempt.run.profile.runSpeed -
    attempt.run.profile.npc.reactionMax -
    attempt.run.profile.npc.commitment;
  const spread = released && at < rejoinAt;
  const index = Number(actor.id.replace(/\D/g, "")) || 0;
  const angle = index * 2.399963229728653 + ((attempt.seed % 16) * Math.PI) / 8;
  const radius = spread ? 4 + (index % 3) : strategy.formationRadius * 0.5;
  mind.reason = spread
    ? "loosen after pickups"
    : relocating
      ? "relocate with raid"
      : "hold formation";
  return {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  };
}

function chooseGoal(attempt: Attempt, actor: Actor, mind: Mind): Point {
  const formation = formationGoal(attempt, actor, mind);
  const anchor = formationAnchor(attempt, mind);
  const ownPool = mind.observed.hazards.find(
    (hazard) =>
      hazard.targetId === actor.id &&
      distance(actor, hazard) < hazard.radius + actor.radius + 0.4,
  );
  if (mind.observed.targetIds.includes(actor.id) || ownPool) {
    mind.reason = ownPool ? "exit own Defile" : "lateral Defile drop";
    // A distant goal keeps the target running through resolution and its delayed pool perception.
    return {
      x: mind.direction * (attempt.run.profile.arenaRadius - actor.radius - 1),
      y: !ownPool && mind.observed.stage === "relocate" ? actor.y : anchor.y,
    };
  }
  const nearbyTarget = mind.observed.targets?.find(
    (target) =>
      target.id !== actor.id &&
      distance(target, formation) < attempt.run.profile.defile.radius,
  );
  const tightNeighborDrop =
    attempt.run.scenario.variantId.startsWith("before-tight") &&
    nearbyTarget?.id !== "you";
  if (nearbyTarget && !tightNeighborDrop) {
    mind.reason = "separate from observed Defile target";
    // The whole group shares the side opposite the observed target, with no friendly repulsion.
    const side = nearbyTarget.x >= anchor.x ? -1 : 1;
    return {
      x:
        formation.x +
        side *
          (attempt.run.profile.defile.radius +
            attempt.run.scenario.strategy.formationRadius),
      y: formation.y,
    };
  }
  return formation;
}

function navigate(
  attempt: Attempt,
  actor: Actor,
  mind: Mind,
  destination: Point,
): void {
  const hazards = dangerFor(actor, mind.observed);
  for (const hazard of hazards) {
    const safeRadius = hazard.radius + actor.radius + 0.6;
    if (distance(destination, hazard) < safeRadius) {
      const dx = actor.x - hazard.x,
        dy = actor.y - hazard.y;
      const length = Math.hypot(dx, dy);
      destination = {
        x:
          hazard.x +
          (length > EPSILON ? dx / length : mind.direction) * safeRadius,
        y: hazard.y + (length > EPSILON ? dy / length : 0) * safeRadius,
      };
      mind.reason = "leave observed danger";
    }
  }
  let waypoint = destination;
  const obstacle = hazards.find(
    (hazard) => clearance(actor, destination, hazard) < actor.radius + 0.4,
  );
  if (obstacle && distance(actor, obstacle) >= obstacle.radius + actor.radius) {
    const dx = destination.x - obstacle.x,
      dy = destination.y - obstacle.y;
    const length = Math.hypot(dx, dy) || 1;
    const margin = obstacle.radius + actor.radius + 0.6;
    // Destination-side tangent can lead back to a close formation without stopping at a side waypoint.
    const toward = Math.min(margin, (margin * margin) / length);
    const lateral = Math.sqrt(Math.max(0, margin * margin - toward * toward));
    waypoint = {
      x:
        obstacle.x +
        (dx / length) * toward -
        (dy / length) * lateral * mind.direction,
      y:
        obstacle.y +
        (dy / length) * toward +
        (dx / length) * lateral * mind.direction,
    };
    mind.reason = "detour around observed danger";
  }
  const preferred = Math.atan2(waypoint.y - actor.y, waypoint.x - actor.x);
  const travel = Math.min(
    distance(actor, waypoint),
    attempt.run.profile.runSpeed * LOOKAHEAD,
  );
  let bestScore = Infinity;
  let best = { x: actor.x, y: actor.y };
  let heading = preferred;
  // Stable candidate order; the seeded side resolves otherwise equal left/right choices.
  for (let index = 0; index < 16; index++) {
    const turn =
      index === 0
        ? 0
        : Math.ceil(index / 2) * (index % 2 ? mind.direction : -mind.direction);
    const angle = preferred + (turn * Math.PI) / 8;
    const candidate = {
      x: actor.x + Math.cos(angle) * travel,
      y: actor.y + Math.sin(angle) * travel,
    };
    let score = distance(candidate, waypoint);
    if (mind.routeHeading !== undefined)
      score += (1 - Math.cos(angle - mind.routeHeading)) * 0.3;
    const boundary = attempt.run.profile.arenaRadius - actor.radius;
    if (Math.hypot(candidate.x, candidate.y) > boundary)
      score += 10000 + Math.hypot(candidate.x, candidate.y) - boundary;
    for (const hazard of hazards) {
      const startClearance =
        distance(actor, hazard) - hazard.radius - actor.radius;
      if (startClearance < 0) {
        // While already exposed, maximize escape rather than treating every heading as equally blocked.
        score +=
          1000 *
          Math.max(
            0,
            hazard.radius + actor.radius + 0.4 - distance(candidate, hazard),
          );
      } else if (clearance(actor, candidate, hazard) < actor.radius + 0.2)
        score += 10000;
    }
    if (score < bestScore - EPSILON) {
      bestScore = score;
      best = candidate;
      heading = angle;
    }
  }
  mind.goal = best;
  mind.routeHeading = heading;
}

/** The drill constrains voluntary movement to the playable platform; friendly actors may overlap. */
export function stepRaidMovement(
  attempt: Attempt,
  input: Point,
  dt: number,
): void {
  observeRaid(attempt);
  const { world } = attempt;
  for (const actor of world.actors) {
    if (!actor.available || actor.carriedBy) continue;
    let goal: Point;
    if (actor.control === "player") {
      const x = Number.isFinite(input.x) ? input.x : 0;
      const y = Number.isFinite(input.y) ? input.y : 0;
      const length = Math.hypot(x, y);
      goal =
        length > EPSILON
          ? {
              x: actor.x + (x / length) * attempt.run.profile.runSpeed * dt,
              y: actor.y + (y / length) * attempt.run.profile.runSpeed * dt,
            }
          : actor;
    } else {
      const mind = actor.mind;
      if (!mind) continue;
      if (world.elapsed + EPSILON >= mind.decideAt) {
        mind.decideAt =
          world.elapsed + attempt.run.profile.npc.decisionInterval;
        if (world.elapsed + EPSILON >= mind.holdUntil) {
          navigate(attempt, actor, mind, chooseGoal(attempt, actor, mind));
          mind.holdUntil = world.elapsed + attempt.run.profile.npc.commitment;
        }
      }
      goal = mind.goal;
    }
    const dx = goal.x - actor.x,
      dy = goal.y - actor.y;
    const length = Math.hypot(dx, dy);
    const travel = Math.min(length, attempt.run.profile.runSpeed * dt);
    if (length > EPSILON) {
      actor.x += (dx / length) * travel;
      actor.y += (dy / length) * travel;
    }
    const boundary = attempt.run.profile.arenaRadius - actor.radius;
    const radius = Math.hypot(actor.x, actor.y);
    if (radius > boundary) {
      actor.x *= boundary / radius;
      actor.y *= boundary / radius;
    }
  }
}
