import type { Recording, RunSpec, View, WorldEvent } from "./scenario-model";
import { createAttempt } from "./scenario-runtime";
import {
  createRecording,
  recordStep,
  resumePractice,
} from "./scenario-recording";

export function clockTime(seconds: number, precise = false) {
  const whole = Math.max(0, seconds);
  const base = `${Math.floor(whole / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(whole % 60)
    .toString()
    .padStart(2, "0")}`;
  return precise ? `${base}.${Math.floor((whole % 1) * 10)}` : base;
}

export function firstMistake(view: View) {
  const finding = view.findings.find((finding) => finding.severity === "miss");
  return view.world.events.find((event) => event.id === finding?.eventId);
}
export function exposureCounts(view: View, mechanic: WorldEvent["mechanic"]) {
  const hits = view.findings.filter(
    (finding) =>
      finding.mechanic === mechanic &&
      finding.code === "exposure" &&
      finding.severity === "miss",
  );
  return {
    personal: hits.filter((hit) => hit.actorId === "you").length,
    raid: hits.filter((hit) => hit.actorId !== "you").length,
  };
}
export function castReview(run: RunSpec, view: View) {
  return run.scenario.events
    .filter((event) => event.kind === "defile")
    .map((scheduled, index) => {
      const cast = view.world.casts.find((cast) => cast.id === scheduled.id);
      const pool = view.world.events.find(
        (event) =>
          event.kind === "pool" && event.sourceId === `${scheduled.id}:pool`,
      );
      const hits = view.world.events.filter(
        (event) =>
          event.kind === "damage" && event.sourceId === `${scheduled.id}:pool`,
      );
      const eventIds = new Set(
        view.world.events
          .filter(
            (event) =>
              event.sourceId === scheduled.id ||
              event.sourceId === `${scheduled.id}:pool`,
          )
          .map((event) => event.id),
      );
      const misses = view.findings.filter(
        (finding) =>
          finding.mechanic === "defile" &&
          finding.severity === "miss" &&
          eventIds.has(finding.eventId),
      );
      const positioningMiss = misses.find(
        (finding) => finding.code !== "exposure",
      );
      return {
        id: scheduled.id,
        imperfect: hits.length > 0 || misses.length > 0,
        positioningMiss,
        reviewEvent:
          view.world.events.find(
            (event) => event.id === positioningMiss?.eventId,
          ) ??
          hits[0] ??
          pool,
        index,
        at: scheduled.at,
        name: "Defile",
        cast,
        target:
          view.world.actors.find((actor) => actor.id === cast?.targetId)
            ?.name ?? "Unrevealed",
        personal: hits.filter((event) => event.actorIds.includes("you")).length,
        raid: hits.reduce(
          (sum, event) =>
            sum + event.actorIds.filter((id) => id !== "you").length,
          0,
        ),
        reached: !!cast,
        firstHit: hits[0],
        event:
          pool ??
          view.world.events.find((event) => event.sourceId === scheduled.id),
      };
    });
}
export function outcome(view: View) {
  if (view.world.status === "failed") return "failed";
  return view.findings.some((finding) => finding.severity === "miss")
    ? "imperfect"
    : "clean";
}
export function restorePractice(
  run: RunSpec,
  recording: Recording,
  checkpointId: string,
) {
  try {
    return { ...resumePractice(run, recording, checkpointId), fallback: false };
  } catch {
    const attempt = createAttempt(run),
      nextRecording = createRecording();
    attempt.world.status = "countdown";
    recordStep(nextRecording, attempt);
    return { attempt, recording: nextRecording, fallback: true };
  }
}
export function eventTitle(event: WorldEvent) {
  const titles: Record<WorldEvent["kind"], string> = {
    cast: "Defile cast begins",
    target: "Defile target revealed",
    pool: "Pool placed",
    damage: event.actorIds.includes("you")
      ? "Defile hit you"
      : "Defile hit a teammate",
    pickup: "Val’kyr pickup",
    release: "Val’kyr passenger rescued",
    loss: "Raider lost from platform",
    relocate: "Raid relocates",
    return: "Frostmourne return",
    "spirit-spawn": "Vile Spirit spawns",
    "spirit-active": "Vile Spirit activates",
    explosion: "Vile Spirit explosion",
    formation: "Formation check",
    end: "Exercise ends",
  };
  return titles[event.kind];
}
export function endReasonText(view: View) {
  const reason = view.world.endReason;
  if (reason === "platform-unusable")
    return "Defile left no safe route through the platform.";
  if (reason === "actor-lost")
    return "A Val’kyr carried a raider from the platform.";
  if (reason === "spirit-unresolved")
    return "A Vile Spirit remained unresolved beyond the practice limit.";
  if (reason === "recording-limit")
    return "Recording interrupted at its safety limit. Retry the same situation.";
  return "The authored positioning excerpt is complete.";
}
