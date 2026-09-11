import type { EncounterDefinition, Snapshot, TrainingMode } from "./model";
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
export type AudioFrame = Pick<
  Snapshot,
  "elapsed" | "status" | "casts" | "stats"
>;
export function audioFrame(state: Snapshot): AudioFrame {
  return {
    elapsed: state.elapsed,
    status: state.status,
    casts: state.casts.map((c) => ({ ...c })),
    stats: { ...state.stats },
  };
}
export function audioCues(
  before: AudioFrame,
  after: AudioFrame,
  encounter: EncounterDefinition,
  mode: TrainingMode,
): AudioCue[] {
  if (after.status === "complete" && before.status !== "complete")
    return ["complete"];
  if (after.status === "failed" && before.status !== "failed")
    return ["failed"];
  if (after.status !== "running") return [];
  const newCast = after.casts.find(
    (c) => !before.casts.some((old) => old.id === c.id),
  );
  if (newCast)
    return [
      encounter.actors.find((a) => a.id === newCast.targetId)?.role === "player"
        ? "target"
        : "other",
    ];
  if (after.stats.personalHits > before.stats.personalHits) return ["damage"];
  if (after.stats.casts > before.stats.casts) return ["pool"];
  const crosses = (at: number) => before.elapsed < at && after.elapsed >= at;
  for (const event of encounter.timeline) {
    const ability = encounter.abilities[event.abilityId];
    if (mode === "guided" && crosses(event.at - ability.warningSeconds))
      return ["spread"];
    for (const number of [3, 2, 1] as const)
      if (crosses(event.at - number)) return [`count-${number}`];
    if (mode === "guided" && crosses(event.at + ability.regroupAfterSeconds))
      return ["regroup"];
  }
  return [];
}
