import type { Snapshot, TrainerEvent } from "./model";
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

/** Select a recorded frame that actually contains the event, even with jittery RAF sampling. */
export function eventReplayTime(
  frames: readonly Snapshot[],
  event: TrainerEvent,
) {
  return (
    frames.find((frame) =>
      frame.events.some(
        (item) =>
          item.at === event.at &&
          item.kind === event.kind &&
          item.castId === event.castId,
      ),
    )?.elapsed ??
    frames.at(-1)?.elapsed ??
    0
  );
}
