import type { Recording, WorldEvent } from "./scenario-model";
import { frameIndexForEvent } from "./scenario-recording";
export function advanceReplay(
  frames: readonly { elapsed: number }[],
  elapsed: number,
  delta: number,
) {
  const duration = frames.at(-1)?.elapsed ?? 0;
  const next = Math.max(0, Math.min(duration, elapsed + delta));
  let index = 0;
  for (let i = 1; i < frames.length && frames[i].elapsed <= next; i++)
    index = i;
  return { elapsed: next, index, ended: next >= duration };
}
export function eventReplayTime(recording: Recording, event: WorldEvent) {
  return recording.frames[frameIndexForEvent(recording, event.id)].world
    .elapsed;
}

/** Resolve the cast owner from saved identity, including damage events whose
 * actorIds identify victims. No simulation or live actor positions enter replay. */
export function recordedEventPath(
  recording: Recording,
  selected: WorldEvent | undefined,
  elapsed: number,
) {
  const final = recording.frames.at(-1)?.world;
  const castId =
    selected?.mechanic === "defile"
      ? selected.sourceId.replace(/:pool$/, "")
      : undefined;
  const cast = final?.casts.find((cast) => cast.id === castId);
  const pool = recording.events.find(
    (event) => event.kind === "pool" && event.sourceId === `${castId}:pool`,
  );
  const target = recording.events.find(
    (event) => event.kind === "target" && event.sourceId === castId,
  );
  const actorId = castId
    ? (cast?.targetId ?? pool?.actorIds[0] ?? target?.actorIds[0])
    : (selected?.actorIds[0] ?? "you");
  const actor = final?.actors.find((actor) => actor.id === actorId);
  const start = cast?.startedAt ?? target?.at ?? 0;
  const end = Math.min(pool?.at ?? elapsed, elapsed);
  return {
    label:
      actorId === "you"
        ? "Your path"
        : actor
          ? `${actor.name}’s path`
          : "Target path unavailable",
    description: castId
      ? "From the cast to the drop"
      : "Recorded movement to this moment",
    points: recording.frames
      .filter(
        (frame) => frame.world.elapsed >= start && frame.world.elapsed <= end,
      )
      .flatMap((frame) => {
        const actor = frame.world.actors.find((actor) => actor.id === actorId);
        return actor ? [{ x: actor.x, y: actor.y }] : [];
      }),
  };
}
