import type { View } from "./scenario-model";
export type AudioCue =
  | "count-1"
  | "count-2"
  | "count-3"
  | "count-4"
  | "count-5"
  | "spread"
  | "target"
  | "other"
  | "damage"
  | "regroup"
  | "pool"
  | "complete"
  | "failed";
export function scenarioAudioCues(before: View, after: View): AudioCue[] {
  if (after.world.status === "complete" && before.world.status !== "complete")
    return ["complete"];
  if (after.world.status === "failed" && before.world.status !== "failed")
    return ["failed"];
  if (after.world.status !== "running") return [];

  const fresh = after.world.events.filter(
    (event) => !before.world.events.some((old) => old.id === event.id),
  );
  const cues: AudioCue[] = [];
  const add = (cue: AudioCue) => {
    if (!cues.includes(cue)) cues.push(cue);
  };

  const elapsed = after.world.elapsed - before.world.elapsed;
  for (const number of [3, 2, 1] as const) {
    const crossed = before.timers.some((timer) => {
      if (timer.kind !== "upcoming" || timer.mechanic === "strategy")
        return false;
      const projected =
        after.timers.find((candidate) => candidate.id === timer.id)
          ?.remaining ?? timer.remaining - elapsed;
      return timer.remaining > number && projected <= number;
    });
    if (crossed) add(`count-${number}`);
  }

  const coachingVisible = [before.cue?.id, after.cue?.id].some(
    (id) =>
      id === "regroup" ||
      id?.startsWith("formation-") ||
      id?.startsWith("anticipate-"),
  );
  const imminentDefile = after.timers.some(
    (timer) =>
      timer.kind === "upcoming" &&
      timer.mechanic === "defile" &&
      timer.remaining <= 5,
  );
  const freshPickup = fresh.some((event) => event.kind === "pickup");
  const hasUpcomingValkyr = after.timers.some(
    (timer) => timer.kind === "upcoming" && timer.mechanic === "valkyrs",
  );
  const leftValkyrStack =
    before.cue?.id === "anticipate-valkyrs-stack" &&
    after.cue?.id !== "anticipate-valkyrs-stack" &&
    freshPickup &&
    !hasUpcomingValkyr &&
    (after.cue?.id === "valkyrs-released" || imminentDefile);
  if (leftValkyrStack) {
    if (imminentDefile) add("spread");
  } else if (after.cue?.id === "anticipate-valkyrs-stack") {
    if (before.cue?.id !== after.cue.id) add("regroup");
  } else if (
    coachingVisible &&
    (after.cue?.id === "regroup" ||
      fresh.some((event) => event.kind === "formation")) &&
    before.cue?.id !== "regroup"
  )
    add("regroup");
  else if (
    after.cue?.id === "anticipate-defile" &&
    before.cue?.id !== after.cue.id
  )
    add("spread");

  if (
    fresh.some(
      (event) => event.kind === "target" && event.actorIds.includes("you"),
    )
  )
    add("target");
  else if (fresh.some((event) => event.kind === "target")) add("other");
  if (fresh.some((event) => event.kind === "pool")) add("pool");
  if (
    fresh.some(
      (event) =>
        (event.kind === "damage" || event.kind === "explosion") &&
        event.actorIds.includes("you") &&
        !event.protectedActorIds.includes("you"),
    )
  )
    add("damage");
  return cues;
}
