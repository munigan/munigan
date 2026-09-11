import type {
  Actor,
  Evidence,
  Family,
  Focus,
  Mode,
  Point,
  Profile,
  RunSpec,
  Scenario,
  ScriptEvent,
  Strategy,
} from "./scenario-model";

export const scenarioFamilies = [
  "before-valkyrs",
  "after-valkyrs",
  "vile-spirits",
  "frostmourne-return",
] as const satisfies readonly Family[];

const WARMANE_GUIDE = "https://forum.warmane.com/showthread.php?t=324235";
const DESIGN =
  "Teaching calibration chosen for this positioning drill; not timing-verified.";
const reference = (
  unit: string,
  source: string,
  status: Evidence["status"] = "teaching",
): Evidence => ({ status, unit, source });

export const lichKingPracticeProfile: Profile = {
  id: "lk-25h-positioning-v1",
  revision: 2,
  arenaRadius: 45,
  runSpeed: 7,
  actorRadius: 0.35,
  defile: {
    cast: 2,
    revealDelay: 0.1,
    radius: 5,
    firstTick: 1,
    tick: 1,
    life: 30,
    growthFactor: 1.1,
  },
  spirits: {
    count: 10,
    spawnInterval: 0.5,
    activationAge: 30,
    speed: 5,
    triggerRadius: 1,
    burstRadius: 5,
    maxAge: 60,
  },
  valkyrs: { count: 3, descent: 2, speed: 2, stun: 3, rescue: 8 },
  npc: {
    reactionMin: 0.2,
    reactionMax: 0.65,
    decisionInterval: 0.25,
    commitment: 0.45,
  },
  evidence: {
    arenaRadius: reference("yards", DESIGN),
    runSpeed: reference("yards/second", DESIGN),
    actorRadius: reference("yards", DESIGN),
    "defile.cast": reference("seconds", WARMANE_GUIDE, "documented"),
    "defile.revealDelay": reference("seconds from cast start", DESIGN),
    "defile.radius": reference("yards", DESIGN),
    "defile.firstTick": reference("seconds after pool birth", DESIGN),
    "defile.tick": reference("seconds", DESIGN),
    "defile.life": reference("seconds", DESIGN),
    "defile.growthFactor": reference("multiplier per hit per tick", DESIGN),
    "spirits.count": reference(
      "spirits",
      "Reference-informed practice value; not verified for Warmane.",
      "reference-informed",
    ),
    "spirits.spawnInterval": reference(
      "seconds",
      "Reference-informed practice value; not verified for Warmane.",
      "reference-informed",
    ),
    "spirits.activationAge": reference(
      "seconds from birth",
      "Reference-informed practice value; not verified for Warmane.",
      "reference-informed",
    ),
    "spirits.speed": reference("yards/second", DESIGN),
    "spirits.triggerRadius": reference(
      "yards",
      "Unverified teaching approximation; separate from burst radius.",
    ),
    "spirits.burstRadius": reference("yards", DESIGN),
    "spirits.maxAge": reference("seconds", "Practice safety limit."),
    "valkyrs.count": reference("passengers", WARMANE_GUIDE, "documented"),
    "valkyrs.descent": reference("seconds", "Automated support approximation."),
    "valkyrs.speed": reference(
      "yards/second",
      "Automated support approximation.",
    ),
    "valkyrs.stun": reference(
      "seconds after pickup",
      "Authored support script.",
    ),
    "valkyrs.rescue": reference(
      "seconds after pickup",
      "Authored support script.",
    ),
    "npc.reactionMin": reference(
      "seconds",
      "Human-behavior teaching parameter.",
    ),
    "npc.reactionMax": reference(
      "seconds",
      "Human-behavior teaching parameter.",
    ),
    "npc.decisionInterval": reference(
      "seconds",
      "Human-behavior teaching parameter.",
    ),
    "npc.commitment": reference(
      "seconds",
      "Human-behavior teaching parameter.",
    ),
    "strategy.formationRadius": reference(
      "yards",
      "Authored strategy parameter.",
    ),
    "strategy.startingOffsetRadius": reference(
      "yards",
      "Authored strategy parameter.",
    ),
    "strategy.soakInterceptRadius": reference(
      "yards",
      "Automated support: 4-yard local intercept bound; measured diverted spirit path needs more than the former 2.5-yard route half-width. Teaching calibration, not timing-verified.",
    ),
    "strategy.routeHalfWidth": reference(
      "yards",
      "Authored strategy parameter.",
    ),
    "recording.frequency": reference(
      "hertz plus event steps",
      "Engineering limit.",
    ),
    "recording.maxExcerpt": reference("seconds", "Engineering limit."),
    "recording.maxEvents": reference("events", "Engineering limit."),
  },
};

function sampleUnit(seed: number, actorIndex: number): number {
  let n = (seed ^ Math.imul(actorIndex + 1, 0x9e3779b9)) >>> 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  return (n >>> 0) / 4294967296;
}

const colors: Record<string, string> = {
  warrior: "#c79c6e",
  paladin: "#f58cba",
  priest: "#ffffff",
  shaman: "#0070de",
  druid: "#ff7d0a",
  deathknight: "#c41f3b",
  rogue: "#fff569",
  mage: "#69ccf0",
  warlock: "#9482c9",
  hunter: "#abd473",
};
const classes = {
  healer: ["priest", "paladin", "shaman", "druid", "priest"],
  melee: ["deathknight", "rogue", "warrior", "paladin"],
  ranged: ["mage", "warlock", "hunter", "druid", "shaman"],
} as const;

export function createRoster(run: RunSpec): Actor[] {
  const specs: { id: string; role: Actor["role"]; className: string }[] = [
    { id: "tank", role: "tank", className: "warrior" },
    { id: "soaker", role: "soaker", className: "paladin" },
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `raid-${String(i + 1).padStart(2, "0")}`,
      role: "healer" as const,
      className: classes.healer[i]!,
    })),
    { id: "you", role: "melee", className: "deathknight" },
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `raid-${String(i + 6).padStart(2, "0")}`,
      role: "melee" as const,
      className: classes.melee[(i + 1) % classes.melee.length]!,
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `raid-${String(i + 15).padStart(2, "0")}`,
      role: "ranged" as const,
      className: classes.ranged[i % classes.ranged.length]!,
    })),
  ];
  const anchor = run.scenario.strategy.start;
  return specs.map((spec, index) => {
    const distance = Math.sqrt(sampleUnit(run.seed, index * 2)) * 1.25;
    const angle = sampleUnit(run.seed, index * 2 + 1) * Math.PI * 2;
    const reaction =
      run.profile.npc.reactionMin +
      sampleUnit(run.seed, index + 100) *
        (run.profile.npc.reactionMax - run.profile.npc.reactionMin);
    const position =
      spec.id === "soaker" && run.scenario.strategy.settledInitially
        ? run.scenario.strategy.soak
        : {
            x: anchor.x + Math.cos(angle) * distance,
            y: anchor.y + Math.sin(angle) * distance,
          };
    return {
      id: spec.id,
      name: spec.id === "you" ? "YOU" : spec.id,
      control: spec.id === "you" ? "player" : "npc",
      role: spec.role,
      classIcon: `/raid-trainer/art/classes/${spec.className}.jpg`,
      color: colors[spec.className]!,
      radius: run.profile.actorRadius,
      x: position.x,
      y: position.y,
      available: true,
      carriedBy: null,
      mind:
        spec.id === "you"
          ? null
          : {
              reaction,
              observeAt: 0,
              decideAt: reaction,
              holdUntil: 0,
              direction: sampleUnit(run.seed, index + 200) < 0.5 ? -1 : 1,
              goal: { ...position },
              observed: { at: 0, eventIds: [], hazards: [], targetIds: [] },
              reason: "initial formation",
            },
    };
  });
}

type Variant = {
  family: Family;
  defileAt: number;
  pickups?: number[];
  duration: number;
  finishCheckAt: number;
  start: Point;
  finish: Point;
  spiritOrigin: Point;
  soak: Point;
  relocateAt: number | null;
  releaseStackAt: number | null;
  settledInitially?: boolean;
  initialSpirits?: { origin: Point; firstBirthAt: number } | null;
  returnAt?: number;
  waveAt?: number;
};
const variants: Record<string, Variant> = {
  "before-standard": {
    family: "before-valkyrs",
    defileAt: 8,
    pickups: [15, 15.5, 16],
    duration: 27,
    finishCheckAt: 24,
    start: { x: 0, y: 8 },
    finish: { x: 0, y: 8 },
    spiritOrigin: { x: 0, y: -28 },
    soak: { x: 0, y: 9 },
    relocateAt: null,
    releaseStackAt: null,
  },
  "before-tight": {
    family: "before-valkyrs",
    defileAt: 8,
    pickups: [10.5, 11, 11.5],
    duration: 23,
    finishCheckAt: 20,
    start: { x: 0, y: 8 },
    finish: { x: 0, y: 8 },
    spiritOrigin: { x: 0, y: -28 },
    soak: { x: 0, y: 9 },
    relocateAt: null,
    releaseStackAt: null,
  },
  "after-standard": {
    family: "after-valkyrs",
    defileAt: 13,
    pickups: [6, 6.5, 7],
    duration: 26,
    finishCheckAt: 23,
    start: { x: 0, y: 8 },
    finish: { x: 0, y: 8 },
    spiritOrigin: { x: 0, y: -28 },
    soak: { x: 0, y: 9 },
    relocateAt: null,
    releaseStackAt: 7,
  },
  "after-tight": {
    family: "after-valkyrs",
    defileAt: 8.25,
    pickups: [7, 7.5, 8],
    duration: 23,
    finishCheckAt: 20,
    start: { x: 0, y: 8 },
    finish: { x: 0, y: 8 },
    spiritOrigin: { x: 0, y: -28 },
    soak: { x: 0, y: 9 },
    relocateAt: null,
    releaseStackAt: 8,
  },
  "spirits-moving": {
    family: "vile-spirits",
    defileAt: 8,
    duration: 35,
    finishCheckAt: 20,
    start: { x: 0, y: -22 },
    finish: { x: 0, y: 22 },
    spiritOrigin: { x: 0, y: -28 },
    soak: { x: 0, y: 9 },
    relocateAt: 4,
    releaseStackAt: null,
    initialSpirits: { origin: { x: 0, y: -28 }, firstBirthAt: -24 },
  },
  "spirits-settled": {
    family: "vile-spirits",
    defileAt: 8,
    duration: 35,
    finishCheckAt: 20,
    start: { x: 0, y: 22 },
    finish: { x: 0, y: 22 },
    spiritOrigin: { x: 0, y: -28 },
    soak: { x: 0, y: 9 },
    relocateAt: null,
    releaseStackAt: null,
    settledInitially: true,
    initialSpirits: { origin: { x: 0, y: -28 }, firstBirthAt: -24 },
  },
  "frostmourne-return": {
    family: "frostmourne-return",
    defileAt: 3,
    duration: 58,
    finishCheckAt: 24,
    start: { x: 0, y: 0 },
    finish: { x: 0, y: 22 },
    spiritOrigin: { x: 0, y: -28 },
    soak: { x: 0, y: 9 },
    relocateAt: 12,
    releaseStackAt: null,
    returnAt: 0,
    waveAt: 10,
  },
};
export function scenarioVariantIds(family: Family): string[] {
  return Object.entries(variants)
    .filter(([, variant]) => variant.family === family)
    .flatMap(([id]) => [`${id}-you`, `${id}-neighbor`]);
}

const passengers = ["raid-01", "raid-06", "raid-15"];

export function makeRun(
  variantId: string,
  seed: number,
  focus: Focus = "defile",
  mode: Mode = "timers",
): RunSpec {
  const target = variantId.endsWith("-neighbor")
    ? "neighbor"
    : variantId.endsWith("-you")
      ? "you"
      : null;
  const baseId = target ? variantId.slice(0, -(target.length + 1)) : variantId;
  const variant = variants[baseId];
  if (!variant || !target)
    throw new Error("Unknown scenario variant: " + variantId);
  const strategy: Strategy = {
    start: { ...variant.start },
    finish: { ...variant.finish },
    spiritOrigin: { ...variant.spiritOrigin },
    soak: { ...variant.soak },
    formationRadius: 2,
    routeHalfWidth: 2.5,
    soakInterceptRadius: 4,
    relocateAt: variant.relocateAt,
    releaseStackAt: variant.releaseStackAt,
    finishCheckAt: variant.finishCheckAt,
    settledInitially: variant.settledInitially ?? false,
  };
  const checkpointId = "start";
  const events: ScriptEvent[] = [
    {
      id: "defile",
      at: variant.defileAt,
      checkpointId,
      kind: "defile",
      target,
    },
  ];
  variant.pickups?.forEach((at, index) =>
    events.push({
      id: `pickup-${index + 1}`,
      at,
      checkpointId,
      kind: "pickup",
      actorId: passengers[index]!,
    }),
  );
  if (variant.returnAt !== undefined)
    events.push({
      id: "return",
      at: variant.returnAt,
      checkpointId,
      kind: "return",
    });
  if (variant.waveAt !== undefined)
    events.push({
      id: "spirit-wave",
      at: variant.waveAt,
      checkpointId,
      kind: "spirit-wave",
      origin: variant.spiritOrigin,
    });
  if (variant.relocateAt !== null)
    events.push({
      id: "relocate",
      at: variant.relocateAt,
      checkpointId,
      kind: "relocate",
    });
  events.push(
    {
      id: "formation",
      at: variant.finishCheckAt,
      checkpointId,
      kind: "check-formation",
      anchor: "finish",
    },
    { id: "finish", at: variant.duration, checkpointId, kind: "finish" },
  );
  events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const initialSpirits = variant.initialSpirits
    ? {
        origin: { ...variant.initialSpirits.origin },
        firstBirthAt: variant.initialSpirits.firstBirthAt,
      }
    : null;
  const profile = structuredClone(lichKingPracticeProfile);
  const scenario: Scenario = {
    id: `lk-${variantId}`,
    revision:
      variant.family === "vile-spirits" ||
      variant.family === "frostmourne-return"
        ? 2
        : 1,
    family: variant.family,
    variantId,
    duration: variant.duration,
    profileId: profile.id,
    strategy,
    events,
    initialSpirits,
    checkpoints: [{ id: checkpointId, at: 0 }],
  };
  return { profile, scenario: structuredClone(scenario), seed, focus, mode };
}

const evidenceUnits: Record<string, string> = {
  arenaRadius: "yards",
  runSpeed: "yards/second",
  actorRadius: "yards",
  "defile.cast": "seconds",
  "defile.revealDelay": "seconds from cast start",
  "defile.radius": "yards",
  "defile.firstTick": "seconds after pool birth",
  "defile.tick": "seconds",
  "defile.life": "seconds",
  "defile.growthFactor": "multiplier per hit per tick",
  "spirits.count": "spirits",
  "spirits.spawnInterval": "seconds",
  "spirits.activationAge": "seconds from birth",
  "spirits.speed": "yards/second",
  "spirits.triggerRadius": "yards",
  "spirits.burstRadius": "yards",
  "spirits.maxAge": "seconds",
  "valkyrs.count": "passengers",
  "valkyrs.descent": "seconds",
  "valkyrs.speed": "yards/second",
  "valkyrs.stun": "seconds after pickup",
  "valkyrs.rescue": "seconds after pickup",
  "npc.reactionMin": "seconds",
  "npc.reactionMax": "seconds",
  "npc.decisionInterval": "seconds",
  "npc.commitment": "seconds",
  "strategy.formationRadius": "yards",
  "strategy.startingOffsetRadius": "yards",
  "strategy.routeHalfWidth": "yards",
  "strategy.soakInterceptRadius": "yards",
  "recording.frequency": "hertz plus event steps",
  "recording.maxExcerpt": "seconds",
  "recording.maxEvents": "events",
};

type NumericRule = {
  path: string;
  value: unknown;
  allowZero?: boolean;
  integer?: boolean;
};
export function validateRun(run: RunSpec): string[] {
  if (!run?.profile) return ["Missing profile"];
  if (!run.scenario) return ["Missing scenario"];
  const errors: string[] = [];
  const evidence = run.profile.evidence ?? {};
  for (const [key, unit] of Object.entries(evidenceUnits)) {
    const item = evidence[key];
    if (!item) {
      errors.push(`Missing evidence: ${key}`);
      continue;
    }
    if (!["documented", "reference-informed", "teaching"].includes(item.status))
      errors.push(`Invalid evidence status: ${key}`);
    if (!item.unit?.trim()) errors.push(`Missing evidence unit: ${key}`);
    else if (item.unit !== unit) errors.push(`Invalid evidence unit: ${key}`);
    if (!item.source?.trim()) errors.push(`Missing evidence source: ${key}`);
  }
  const profile = run.profile as Partial<Profile>;
  for (const group of ["defile", "spirits", "valkyrs", "npc"] as const) {
    if (!profile[group]) errors.push(`Missing profile group: ${group}`);
  }
  const numericRules: NumericRule[] = [
    { path: "revision", value: profile.revision, integer: true },
    { path: "arenaRadius", value: profile.arenaRadius },
    { path: "runSpeed", value: profile.runSpeed },
    { path: "actorRadius", value: profile.actorRadius },
    { path: "defile.cast", value: profile.defile?.cast },
    {
      path: "defile.revealDelay",
      value: profile.defile?.revealDelay,
      allowZero: true,
    },
    { path: "defile.radius", value: profile.defile?.radius },
    { path: "defile.firstTick", value: profile.defile?.firstTick },
    { path: "defile.tick", value: profile.defile?.tick },
    { path: "defile.life", value: profile.defile?.life },
    { path: "defile.growthFactor", value: profile.defile?.growthFactor },
    { path: "spirits.count", value: profile.spirits?.count, integer: true },
    { path: "spirits.spawnInterval", value: profile.spirits?.spawnInterval },
    { path: "spirits.activationAge", value: profile.spirits?.activationAge },
    { path: "spirits.speed", value: profile.spirits?.speed },
    { path: "spirits.triggerRadius", value: profile.spirits?.triggerRadius },
    { path: "spirits.burstRadius", value: profile.spirits?.burstRadius },
    { path: "spirits.maxAge", value: profile.spirits?.maxAge },
    { path: "valkyrs.count", value: profile.valkyrs?.count, integer: true },
    { path: "valkyrs.descent", value: profile.valkyrs?.descent },
    { path: "valkyrs.speed", value: profile.valkyrs?.speed },
    { path: "valkyrs.stun", value: profile.valkyrs?.stun },
    { path: "valkyrs.rescue", value: profile.valkyrs?.rescue },
    { path: "npc.reactionMin", value: profile.npc?.reactionMin },
    { path: "npc.reactionMax", value: profile.npc?.reactionMax },
    { path: "npc.decisionInterval", value: profile.npc?.decisionInterval },
    { path: "npc.commitment", value: profile.npc?.commitment },
  ];
  for (const rule of numericRules) {
    if (rule.value === undefined)
      errors.push(`Missing profile value: ${rule.path}`);
    else if (
      typeof rule.value !== "number" ||
      !Number.isFinite(rule.value) ||
      (rule.allowZero ? rule.value < 0 : rule.value <= 0) ||
      (rule.integer && !Number.isInteger(rule.value))
    )
      errors.push(`Invalid profile value: ${rule.path}`);
  }
  const geometry: [string, unknown][] = [
    ["arenaRadius", profile.arenaRadius],
    ["actorRadius", profile.actorRadius],
    ["defile.radius", profile.defile?.radius],
    ["spirits.triggerRadius", profile.spirits?.triggerRadius],
    ["spirits.burstRadius", profile.spirits?.burstRadius],
    ["strategy.formationRadius", run.scenario.strategy?.formationRadius],
    ["strategy.routeHalfWidth", run.scenario.strategy?.routeHalfWidth],
    [
      "strategy.soakInterceptRadius",
      run.scenario.strategy?.soakInterceptRadius,
    ],
  ];
  for (const [name, value] of geometry)
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
      errors.push(`Invalid geometry: ${name}`);
  if (profile.defile && profile.defile.revealDelay > profile.defile.cast)
    errors.push("Defile reveal occurs after resolution");
  if (!(scenarioFamilies as readonly string[]).includes(run.scenario.family))
    errors.push(`Unsupported family: ${run.scenario.family}`);
  if (run.scenario.profileId !== run.profile.id)
    errors.push(`Profile mismatch: ${run.scenario.profileId}`);
  if (!Number.isFinite(run.scenario.duration) || run.scenario.duration <= 0)
    errors.push("Invalid scenario duration");
  if (run.scenario.events.length > 2000)
    errors.push(`Too many events: ${run.scenario.events.length}`);
  const checkpoints = new Set<string>();
  for (const checkpoint of run.scenario.checkpoints ?? []) {
    if (checkpoints.has(checkpoint.id))
      errors.push(`Duplicate checkpoint ID: ${checkpoint.id}`);
    else checkpoints.add(checkpoint.id);
    if (
      !Number.isFinite(checkpoint.at) ||
      checkpoint.at < 0 ||
      checkpoint.at > run.scenario.duration
    )
      errors.push(`Invalid checkpoint time: ${checkpoint.id}`);
  }
  const actors =
    profile.npc && run.scenario.strategy
      ? new Map(createRoster(run).map((actor) => [actor.id, actor]))
      : new Map<string, Actor>();
  const seen = new Set<string>();
  const pickupTimes = new Map<string, number[]>();
  for (const event of run.scenario.events) {
    if (seen.has(event.id)) errors.push(`Duplicate event ID: ${event.id}`);
    else seen.add(event.id);
    if (!checkpoints.has(event.checkpointId))
      errors.push(`Unknown checkpoint: ${event.checkpointId}`);
    if (!Number.isFinite(event.at) || event.at < 0)
      errors.push(`Invalid event time: ${event.id}`);
    else if (event.at > run.scenario.duration)
      errors.push(`Event past endpoint: ${event.id}`);
    if (event.kind === "pickup") {
      const actor = actors.get(event.actorId);
      if (!actor) errors.push(`Unknown actor: ${event.actorId}`);
      else if (actor.control === "player")
        errors.push(`Player-controlled passenger: ${event.actorId}`);
      const times = pickupTimes.get(event.actorId) ?? [];
      times.push(event.at);
      pickupTimes.set(event.actorId, times);
    }
  }
  const rescue = profile.valkyrs?.rescue;
  if (typeof rescue === "number" && Number.isFinite(rescue) && rescue > 0)
    for (const [actorId, times] of pickupTimes) {
      times.sort((a, b) => a - b);
      if (
        times.some((at, index) => index > 0 && at < times[index - 1] + rescue)
      )
        errors.push(`Overlapping Val'kyr carries: ${actorId}`);
    }
  return errors;
}
