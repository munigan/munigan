import type {
  EncounterDefinition,
  Point,
  Session,
  Snapshot,
  Timer,
} from "./model";
import { resolveMechanic, tickMechanics } from "./mechanics";
import { moveActor, moveRaid } from "./movement";

export function createSession(
  encounter: EncounterDefinition,
  seed = 1,
): Session {
  return {
    encounter,
    seed,
    elapsed: 0,
    step: 0,
    remainder: 0,
    status: "ready",
    actors: structuredClone(encounter.actors),
    casts: [],
    pools: [],
    stats: { casts: 0, personalHits: 0, raidHits: 0, growths: 0 },
    events: [],
    trail: [],
  };
}

export function advanceSession(
  session: Session,
  seconds: number,
  input: Point = { x: 0, y: 0 },
): void {
  if (session.status !== "running" || !Number.isFinite(seconds) || seconds <= 0)
    return;
  session.remainder += seconds;
  const dt = 1 / 60;
  while (session.remainder + 1e-9 >= dt && session.status === "running") {
    session.remainder = Math.max(0, session.remainder - dt);
    session.step++;
    session.elapsed = session.step / 60;
    moveActor(
      session,
      session.actors.find((a) => a.role === "player")!,
      input,
      125 * dt,
    );
    for (const event of session.encounter.timeline) {
      if (
        session.elapsed < event.at ||
        session.casts.some((cast) => cast.id === event.id)
      )
        continue;
      const ability = session.encounter.abilities[event.abilityId];
      const candidates = session.actors.filter((a) => a.role === event.target);
      const target =
        candidates[(session.seed + session.casts.length) % candidates.length] ??
        session.actors[0];
      session.casts.push({
        id: event.id,
        abilityId: ability.id,
        targetId: target.id,
        startedAt: event.at,
        resolvesAt: event.at + ability.castSeconds,
        regroupAt: event.at + ability.regroupAfterSeconds,
        resolved: false,
      });
      session.events.push({
        at: session.elapsed,
        kind: "cast",
        text: `${ability.name} targets ${target.name}.`,
      });
    }
    moveRaid(session, dt);
    for (const cast of session.casts) {
      if (!cast.resolved && session.elapsed >= cast.resolvesAt) {
        resolveMechanic(
          session,
          cast,
          session.encounter.abilities[cast.abilityId],
        );
        cast.resolved = true;
        session.stats.casts++;
      }
      if (session.step === Math.ceil(cast.regroupAt * 60))
        session.events.push({
          at: session.elapsed,
          kind: "regroup",
          text: "Raid regroups. Keep the return path clear.",
        });
    }
    tickMechanics(session);
    if (session.step % 6 === 0) {
      const player = session.actors.find((a) => a.role === "player")!;
      session.trail.push({ x: player.x, y: player.y });
    }
    if (
      session.stats.personalHits >= 6 ||
      session.pools.some(
        (pool) => pool.radius >= session.encounter.arena.radius * 0.72,
      )
    )
      session.status = "failed";
    else if (session.elapsed >= session.encounter.duration)
      session.status = "complete";
  }
}

export function getTimers(session: Session): Timer[] {
  const active: Timer[] = session.casts
    .filter((cast) => !cast.resolved)
    .map((cast) => {
      const ability = session.encounter.abilities[cast.abilityId];
      return {
        id: cast.id,
        name: ability.name,
        icon: ability.icon,
        remaining: Math.max(0, cast.resolvesAt - session.elapsed),
        duration: ability.castSeconds,
        color: "#e8b477",
        kind: "cast",
      };
    });
  const upcoming: Timer[] = [];
  // Show the next occurrence of each ability, including when its current cast is active.
  for (const ability of Object.values(session.encounter.abilities)) {
    const event = session.encounter.timeline.find(
      (event) => event.abilityId === ability.id && event.at > session.elapsed,
    );
    if (event) {
      const previous = session.encounter.timeline
        .filter((e) => e.abilityId === ability.id && e.at < event.at)
        .at(-1);
      upcoming.push({
        id: event.id,
        name: ability.name,
        icon: ability.icon,
        remaining: event.at - session.elapsed,
        duration: event.at - (previous?.at ?? 0),
        color: ability.color,
        kind: "upcoming",
      });
    }
  }
  const regroup = session.casts.find(
    (cast) => cast.resolved && cast.regroupAt > session.elapsed,
  );
  if (regroup)
    upcoming.push({
      id: `${regroup.id}-regroup`,
      name: "Raid regroups",
      remaining: regroup.regroupAt - session.elapsed,
      duration: regroup.regroupAt - regroup.resolvesAt,
      color: "#81c6d1",
      kind: "regroup",
    });
  return [...active, ...upcoming.sort((a, b) => a.remaining - b.remaining)];
}

export function snapshot(session: Session): Snapshot {
  const { elapsed, status, actors, casts, pools, stats, events, trail } =
    session;
  return structuredClone({
    elapsed,
    status,
    actors,
    casts,
    pools,
    stats,
    events,
    trail,
  });
}
