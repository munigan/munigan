import type {
  Attempt,
  CueView,
  Finding,
  PublicWorld,
  RunSpec,
  ScriptEvent,
  TimerView,
  View,
  World,
  WorldEvent,
} from "./scenario-model";

const DEFILE_ICON = "/raid-trainer/art/defile.jpg";
const REGROUP_ICON = "/raid-trainer/art/regroup.jpg";
const RECENT_WARNING_SECONDS = 2.5;
const ADVANCE_WARNING_SECONDS = 5;

type Mechanic = WorldEvent["mechanic"];

const timerPresentation: Record<Mechanic, { label: string; icon: string }> = {
  defile: { label: "Defile", icon: DEFILE_ICON },
  valkyrs: { label: "Val'kyr", icon: "/raid-trainer/art/valkyr.svg" },
  "vile-spirits": {
    label: "Vile Spirits",
    icon: "/raid-trainer/art/vile-spirit.svg",
  },
  strategy: { label: "Raid movement", icon: REGROUP_ICON },
};

function eventMechanic(event: ScriptEvent): Mechanic | null {
  if (event.kind === "defile") return "defile";
  if (event.kind === "pickup") return "valkyrs";
  if (event.kind === "spirit-wave") return "vile-spirits";
  if (
    event.kind === "relocate" ||
    event.kind === "return" ||
    event.kind === "check-formation"
  )
    return "strategy";
  return null;
}

function publicWorld(world: World): PublicWorld {
  const cloned = structuredClone(world);
  for (const actor of cloned.actors) Reflect.deleteProperty(actor, "mind");
  for (const cast of cloned.casts) Reflect.deleteProperty(cast, "targetCase");
  return {
    ...cloned,
    actors: cloned.actors,
    casts: cloned.casts,
    spirits: cloned.spirits.filter((spirit) => spirit.bornAt <= cloned.elapsed),
  };
}

function timerDuration(run: RunSpec, event: ScriptEvent): number {
  const mechanic = eventMechanic(event);
  const previous = run.scenario.events
    .filter(
      (candidate) =>
        eventMechanic(candidate) === mechanic && candidate.at < event.at,
    )
    .at(-1);
  return Math.max(0, event.at - (previous?.at ?? 0));
}

function timers(run: RunSpec, world: World): TimerView[] {
  const activeCasts: TimerView[] = world.casts
    .filter((cast) => !cast.resolved)
    .map((cast) => ({
      id: `${cast.id}:cast`,
      label: "Defile",
      icon: DEFILE_ICON,
      remaining: Math.max(0, cast.resolvesAt - world.elapsed),
      duration: cast.resolvesAt - cast.startedAt,
      kind: "cast",
      mechanic: "defile",
    }));

  const nextByMechanic = new Map<Mechanic, TimerView>();
  for (const event of run.scenario.events) {
    const mechanic = eventMechanic(event);
    if (!mechanic || event.at < world.elapsed) continue;
    const hasStarted = world.events.some(
      (observed) => observed.sourceId === event.id,
    );
    if (hasStarted || nextByMechanic.has(mechanic)) continue;
    const presentation = timerPresentation[mechanic];
    nextByMechanic.set(mechanic, {
      id: event.id,
      label: presentation.label,
      icon: presentation.icon,
      remaining: Math.max(0, event.at - world.elapsed),
      duration: timerDuration(run, event),
      kind: "upcoming",
      mechanic,
    });
  }

  const nextSpirit = world.spirits
    .filter((spirit) => spirit.activeAt > world.elapsed)
    .sort((a, b) => a.activeAt - b.activeAt || a.id.localeCompare(b.id))[0];
  if (nextSpirit && !nextByMechanic.has("vile-spirits"))
    nextByMechanic.set("vile-spirits", {
      id: `${nextSpirit.id}:active`,
      label: timerPresentation["vile-spirits"].label,
      icon: timerPresentation["vile-spirits"].icon,
      remaining: nextSpirit.activeAt - world.elapsed,
      duration: nextSpirit.activeAt - nextSpirit.bornAt,
      kind: "upcoming",
      mechanic: "vile-spirits",
    });

  return [
    ...activeCasts,
    ...[...nextByMechanic.values()].sort(
      (a, b) => a.remaining - b.remaining || a.id.localeCompare(b.id),
    ),
  ];
}

function terminalCue(world: World): CueView | null {
  if (world.status === "complete")
    return {
      id: "complete",
      label: "Exercise complete",
      title: "Positioning complete",
      detail: "Review the attempt and practice any missed checkpoint.",
      tone: "success",
    };
  if (world.status !== "failed") return null;
  if (world.endReason === "recording-limit")
    return {
      id: "recording-interrupted",
      label: "Recording interrupted",
      title: "Recording interrupted at its safety limit",
      detail:
        "The attempt stopped because its recording reached the practice limit.",
      tone: "neutral",
    };
  const failure =
    world.endReason === "actor-lost"
      ? "A Val'kyr carried a raider from the platform."
      : world.endReason === "spirit-unresolved"
        ? "A Vile Spirit remained unresolved beyond the practice limit."
        : "Defile left no safe route through the platform.";
  return {
    id: "failed",
    label: "Exercise ended",
    title: "The positioning check ended",
    detail: failure,
    tone: "danger",
  };
}

function recentEvent(world: World, kinds: WorldEvent["kind"][]) {
  return world.events
    .filter(
      (event) =>
        kinds.includes(event.kind) &&
        world.elapsed - event.at >= 0 &&
        world.elapsed - event.at < RECENT_WARNING_SECONDS,
    )
    .at(-1);
}

function contextualCue(
  run: RunSpec,
  world: World,
  viewTimers: TimerView[],
): CueView | null {
  if (world.status === "countdown")
    return {
      id: "countdown",
      label: "Get ready",
      title: "Find your character",
      detail: "Timers and movement begin at GO.",
      tone: "neutral",
    };
  if (world.status !== "running" && world.status !== "paused") return null;

  const you = world.actors.find((actor) => actor.id === "you");
  const exposure = world.events
    .filter(
      (event) =>
        (event.kind === "damage" || event.kind === "explosion") &&
        event.actorIds.some(
          (actorId) => !event.protectedActorIds.includes(actorId),
        ) &&
        world.elapsed - event.at >= 0 &&
        world.elapsed - event.at < RECENT_WARNING_SECONDS,
    )
    .at(-1);
  const inHazard =
    !!you &&
    (world.pools.some(
      (pool) =>
        Math.hypot(you.x - pool.x, you.y - pool.y) < pool.radius + you.radius,
    ) ||
      world.spirits.some(
        (spirit) =>
          spirit.activeAt <= world.elapsed &&
          spirit.explodedAt === null &&
          Math.hypot(you.x - spirit.x, you.y - spirit.y) <
            run.profile.spirits.burstRadius + you.radius,
      ));
  const recovered =
    exposure?.actorIds.includes("you") &&
    !exposure.protectedActorIds.includes("you") &&
    !inHazard &&
    world.elapsed - exposure.at > 0.35;
  if (exposure && !recovered) {
    const hitYou =
      exposure.actorIds.includes("you") &&
      !exposure.protectedActorIds.includes("you");
    return {
      id: exposure.kind === "explosion" ? "danger-explosion" : "danger-damage",
      label:
        exposure.kind === "explosion"
          ? hitYou
            ? "Spirit burst hit you"
            : "Spirit burst nearby"
          : hitYou
            ? "Defile hit you"
            : "A teammate took a tick",
      title: hitYou ? "Move into clear ground" : "Keep clear of the hazard",
      detail: hitYou
        ? "Leave the active hazard and keep the raid path clear."
        : "Give exposed teammates room and keep the return path clear.",
      tone: "danger",
    };
  }
  if (
    you &&
    world.pools.some(
      (pool) =>
        Math.hypot(you.x - pool.x, you.y - pool.y) < pool.radius + you.radius,
    )
  )
    return {
      id: "danger-pool",
      label: "Pool under you",
      title: "Get out of the pool",
      detail: "Step into clear ground now. Every tick makes it grow.",
      tone: "danger",
    };

  const cast = world.casts.find(
    (candidate) => !candidate.resolved && candidate.targetId !== null,
  );
  const target = world.actors.find((actor) => actor.id === cast?.targetId);
  if (cast && target?.id === "you")
    return {
      id: "target-you",
      label: "Defile on YOU",
      title: "Move away from the raid",
      detail: "Drop it in open space. Keep moving.",
      tone: "warning",
    };
  if (
    cast &&
    target &&
    you &&
    Math.hypot(target.x - you.x, target.y - you.y) <= 8
  )
    return {
      id: `target-${target.id}`,
      label: `Defile on ${target.name}`,
      title: `Give ${target.name} room`,
      detail: "Keep their route clear. You are not the target.",
      tone: "warning",
    };

  if (cast && target)
    return {
      id: `target-distant-${target.id}`,
      label: `Defile on ${target.name}`,
      title: `${target.name} has the target`,
      detail:
        "The revealed target is clear of your position. Hold a safe route.",
      tone: "neutral",
    };

  if (
    world.casts.some(
      (candidate) => !candidate.resolved && candidate.targetId === null,
    )
  )
    return {
      id: "cast-defile",
      label: "Defile casting",
      title: "Watch for the target",
      detail: "The target has not been revealed yet.",
      tone: "warning",
    };

  if (recovered)
    return {
      id: "recovered",
      label: "You’re clear",
      title: "Keep the raid’s path clear",
      detail: "You left the hazard. Keep the next positioning moment clean.",
      tone: "success",
    };

  if (run.mode === "timers") return null;

  const releaseAt = run.scenario.strategy.releaseStackAt;
  const releasePickup =
    releaseAt === null
      ? undefined
      : run.scenario.events.find(
          (event) => event.kind === "pickup" && event.at === releaseAt,
        );
  const observedRelease = releasePickup
    ? world.events.find(
        (event) =>
          event.kind === "pickup" && event.sourceId === releasePickup.id,
      )
    : undefined;
  const advance = viewTimers.find(
    (timer) =>
      timer.kind === "upcoming" &&
      timer.mechanic !== "strategy" &&
      timer.remaining <= ADVANCE_WARNING_SECONDS,
  );
  if (advance?.mechanic === "valkyrs")
    return {
      id: "anticipate-valkyrs-stack",
      label: "Val'kyr soon",
      title: "Hold the stack",
      detail: "Stay stacked through the final pickup.",
      tone: "warning",
    };
  if (advance)
    return {
      id: `anticipate-${advance.mechanic}`,
      label: `${advance.label} soon`,
      title: "Find your escape route",
      detail: "Make room before the mechanic begins.",
      tone: "warning",
    };

  if (
    observedRelease &&
    world.elapsed - observedRelease.at >= 0 &&
    world.elapsed - observedRelease.at < RECENT_WARNING_SECONDS
  )
    return {
      id: "valkyrs-released",
      label: "Final Val'kyr pickup",
      title: "Spread after the pickups",
      detail:
        "The required stack is released. Make room for the next mechanic.",
      tone: "neutral",
    };

  const formation = recentEvent(world, ["formation"]);
  if (formation) {
    const returning = formation.obligations.some(
      (obligation) => obligation.responsibility === "return-to-formation",
    );
    return {
      id: returning ? "regroup" : `formation-${formation.sourceId}`,
      label: returning ? "Raid regroups" : "Hold formation",
      title: returning ? "Return to formation" : "Keep the stack together",
      detail: returning
        ? "Move back to the assigned raid position."
        : "Hold your assigned position while support resolves the pickup.",
      tone: "neutral",
    };
  }
  return {
    id: `formation-${world.stage}`,
    label: "Raid awareness",
    title: world.stage === "relocate" ? "Move with the raid" : "Hold formation",
    detail: "Keep a clear route to the current raid anchor.",
    tone: "neutral",
  };
}

export function readAttempt(attempt: Attempt): View {
  return readWorldView(attempt.run, attempt.world, attempt.findings);
}

export function readWorldView(
  run: RunSpec,
  world: World,
  findings: Finding[],
): View {
  const viewTimers = timers(run, world);
  return {
    world: publicWorld(world),
    findings: structuredClone(findings),
    timers: viewTimers,
    cue: terminalCue(world) ?? contextualCue(run, world, viewTimers),
  };
}
