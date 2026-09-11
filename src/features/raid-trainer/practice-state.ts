import type {
  EncounterDefinition,
  Snapshot,
  Session,
  TrainerEvent,
  TrainingMode,
} from "./model";
import { createSession } from "./simulation";

export function clockTime(seconds: number, precise = false) {
  const whole = Math.max(0, seconds);
  const base = `${Math.floor(whole / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(whole % 60)
    .toString()
    .padStart(2, "0")}`;
  return precise ? `${base}.${Math.floor((whole % 1) * 10)}` : base;
}
export function firstMistake(state: Snapshot) {
  return state.events.find((event) => event.kind === "damage");
}
export function castReview(encounter: EncounterDefinition, state: Snapshot) {
  return encounter.timeline.map((scheduled, index) => {
    const cast = state.casts.find((entry) => entry.id === scheduled.id);
    const hits = state.events.filter(
      (event) => event.kind === "damage" && event.castId === scheduled.id,
    );
    const personal = hits.reduce(
      (sum, event) => sum + (event.personalHits ?? 0),
      0,
    );
    const raid = hits.reduce((sum, event) => sum + (event.raidHits ?? 0), 0);
    return {
      id: scheduled.id,
      index,
      at: scheduled.at,
      name: encounter.abilities[scheduled.abilityId].name,
      cast,
      target: cast
        ? (state.actors.find((actor) => actor.id === cast.targetId)?.name ??
          "Raid")
        : scheduled.target === "player"
          ? "you"
          : "teammate",
      personal,
      raid,
      reached: !!cast,
      firstHit: hits[0],
    };
  });
}
export function outcome(state: Snapshot) {
  if (state.status === "failed")
    return state.stats.personalHits >= 6 ? "exposure" : "overrun";
  return state.stats.personalHits + state.stats.raidHits === 0
    ? "clean"
    : "imperfect";
}
export function restorePractice(
  encounter: EncounterDefinition,
  frames: Snapshot[],
  castId: string,
  seed: number,
) {
  const event = encounter.timeline.find((cast) => cast.id === castId);
  if (!event) return null;
  const at = Math.max(0, event.at - 2);
  const frame = frames.filter((frame) => frame.elapsed <= at + 1e-8).at(-1);
  if (!frame) return null;
  const session: Session = {
    ...createSession(encounter, seed),
    ...structuredClone(frame),
    status: "countdown" as const,
    step: Math.round(frame.elapsed * 60),
    remainder: 0,
  };
  return {
    session,
    history: structuredClone(
      frames.filter((item) => item.elapsed <= frame.elapsed),
    ),
  };
}
export type PracticeCue = {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: "neutral" | "warning" | "danger" | "success";
  coaching?: boolean;
};
export function practiceCue(
  state: Snapshot,
  encounter: EncounterDefinition,
  mode: TrainingMode,
): PracticeCue | null {
  if (state.status === "countdown")
    return {
      id: "countdown",
      label: "Get ready",
      title: "Find your character",
      detail: "Timers and movement begin at GO.",
      tone: "neutral",
    };
  const player = state.actors.find((actor) => actor.role === "player")!;
  const inPool = state.pools.some(
    (pool) =>
      Math.hypot(player.x - pool.x, player.y - pool.y) <
      pool.radius + player.radius,
  );
  const damage = state.events.filter((event) => event.kind === "damage").at(-1);
  const recent = damage && state.elapsed - damage.at < 2.5;
  if (inPool)
    return {
      id: "danger",
      label:
        recent && damage.personalHits
          ? "+1 exposure · pool grew"
          : "Pool under you",
      title: "Get out of the pool",
      detail: "Step into clear ground now. Every tick makes it grow.",
      tone: "danger",
    };
  const cast = state.casts.find((entry) => !entry.resolved);
  if (cast) {
    const target = state.actors.find((actor) => actor.id === cast.targetId)!;
    const name = encounter.abilities[cast.abilityId].name;
    return {
      id: "target",
      label: `${name} on ${target.role === "player" ? "YOU" : target.name}`,
      title:
        target.role === "player"
          ? "Move away from the raid"
          : `Give ${target.name} room`,
      detail:
        target.role === "player"
          ? "Drop it in open space. Keep moving."
          : "Keep their route clear. You are not the target.",
      tone: "warning",
    };
  }
  if (recent)
    return damage.personalHits
      ? {
          id: "recovered",
          label: "You’re clear",
          title: "Keep the raid’s path clear",
          detail: "Stay out of the pool while the raid returns.",
          tone: "success",
        }
      : {
          id: "raid-hit",
          label: "You stayed clear",
          title: "A teammate took a tick",
          detail:
            "The pool grows when any teammate takes damage. Keep the return path clear.",
          tone: "danger",
        };
  if (mode === "timers") return null;
  const next = encounter.timeline.find((entry) => entry.at > state.elapsed);
  if (
    next &&
    next.at - state.elapsed <=
      encounter.abilities[next.abilityId].warningSeconds
  )
    return {
      id: "anticipate",
      label: `${encounter.abilities[next.abilityId].name} soon`,
      title: "Find your escape route",
      detail: "Spread out. The next target could be you.",
      tone: "warning",
      coaching: true,
    };
  if (state.pools.length)
    return {
      id: "clear",
      label: "Keep moving",
      title: "Keep the raid’s path clear",
      detail: "Leave space for your teammates to return.",
      tone: "neutral",
      coaching: true,
    };
  return {
    id: "watch",
    label: "Raid awareness",
    title: "Watch the timer. Make your move.",
    detail: "Keep an escape route clear. The next target could be you.",
    tone: "neutral",
    coaching: true,
  };
}
export function eventTitle(event: TrainerEvent) {
  if (event.kind === "cast") return "Target announced";
  if (event.kind === "pool") return "Pool placed";
  if (event.kind === "damage")
    return event.personalHits
      ? "Still in the pool."
      : "A teammate took a tick.";
  return "The raid returns";
}
