export type Point = { x: number; y: number };
export type Family =
  "before-valkyrs" | "after-valkyrs" | "vile-spirits" | "frostmourne-return";
export type Focus = "defile" | "vile-spirits";
export type Mode = "guided" | "timers";
export type Status =
  "ready" | "countdown" | "running" | "paused" | "complete" | "failed";
export type Evidence = {
  status: "documented" | "reference-informed" | "teaching";
  unit: string;
  source: string;
};
export type Profile = {
  id: string;
  revision: number;
  arenaRadius: number;
  runSpeed: number;
  actorRadius: number;
  defile: {
    cast: number;
    revealDelay: number;
    radius: number;
    firstTick: number;
    tick: number;
    life: number;
    growthFactor: number;
  };
  spirits: {
    count: number;
    spawnInterval: number;
    activationAge: number;
    speed: number;
    triggerRadius: number;
    burstRadius: number;
    maxAge: number;
  };
  valkyrs: {
    count: number;
    descent: number;
    speed: number;
    stun: number;
    rescue: number;
  };
  npc: {
    reactionMin: number;
    reactionMax: number;
    decisionInterval: number;
    commitment: number;
  };
  evidence: Record<string, Evidence>;
};
export type Circle = Point & { id: string; radius: number };
export type Observation = {
  at: number;
  eventIds: string[];
  hazards: (Circle & { kind?: "pool" | "spirit"; targetId?: string })[];
  targetIds: string[];
  targets?: (Point & { id: string })[];
  anchor?: Point;
  stage?: World["stage"];
};
export type Mind = {
  reaction: number;
  observeAt: number;
  decideAt: number;
  holdUntil: number;
  direction: number;
  goal: Point;
  observed: Observation;
  reason: string;
  pending?: Observation[];
  routeHeading?: number;
};
export type Actor = Point & {
  id: string;
  name: string;
  control: "player" | "npc";
  role: "melee" | "ranged" | "healer" | "tank" | "soaker";
  classIcon: string;
  color: string;
  radius: number;
  available: boolean;
  carriedBy: string | null;
  mind: Mind | null;
};
export type Strategy = {
  start: Point;
  finish: Point;
  spiritOrigin: Point;
  soak: Point;
  formationRadius: number;
  routeHalfWidth: number;
  soakInterceptRadius: number;
  relocateAt: number | null;
  releaseStackAt: number | null;
  finishCheckAt: number;
  settledInitially: boolean;
};
export type ScriptEvent = { id: string; at: number; checkpointId: string } & (
  | { kind: "defile"; target: "you" | "neighbor" }
  | { kind: "pickup"; actorId: string }
  | { kind: "relocate" | "return" | "finish" }
  | { kind: "spirit-wave"; origin: Point }
  | { kind: "check-formation"; anchor: "start" | "finish" }
);
export type Scenario = {
  id: string;
  revision: number;
  family: Family;
  variantId: string;
  duration: number;
  profileId: string;
  strategy: Strategy;
  events: ScriptEvent[];
  initialSpirits: { origin: Point; firstBirthAt: number } | null;
  checkpoints: { id: string; at: number }[];
};
export type RunSpec = {
  profile: Profile;
  scenario: Scenario;
  seed: number;
  focus: Focus;
  mode: Mode;
};
export type Cast = {
  id: string;
  startedAt: number;
  revealAt: number;
  resolvesAt: number;
  targetCase: "you" | "neighbor";
  targetId: string | null;
  resolved: boolean;
};
export type Pool = Circle & {
  targetId: string;
  bornAt: number;
  expiresAt: number;
  nextTick: number;
  growths: number;
  formationRecovery?: {
    anchor: Point;
    radius: number;
    until: number;
    completed: boolean;
  };
};
export type Spirit = Point & {
  id: string;
  bornAt: number;
  activeAt: number;
  targetId: string | null;
  explodedAt: number | null;
  expiresAt: number;
};
export type Valkyr = Point & {
  id: string;
  passengerId: string;
  pickupAt: number;
  releaseAt: number;
  destination: Point;
  state: "descending" | "carrying" | "released" | "lost";
};
export type FormationObligation = {
  actorId: string;
  position: Point;
  anchor: Point;
  radius: number;
  responsibility: "hold-formation" | "return-to-formation";
  exemption?: { reason: string; sourceIds: string[] };
};
export type WorldEvent = {
  id: string;
  at: number;
  kind:
    | "cast"
    | "target"
    | "pool"
    | "damage"
    | "pickup"
    | "release"
    | "loss"
    | "relocate"
    | "return"
    | "spirit-spawn"
    | "spirit-active"
    | "explosion"
    | "formation"
    | "end";
  sourceId: string;
  mechanic: "defile" | "valkyrs" | "vile-spirits" | "strategy";
  actorIds: string[];
  position: Point | null;
  checkpointId: string;
  amount: number;
  protectedActorIds: string[];
  obligations: FormationObligation[];
};
export type Finding = {
  id: string;
  eventId: string;
  at: number;
  actorId: string;
  mechanic: WorldEvent["mechanic"];
  code: "exposure" | "outside-formation" | "route-overlap" | "formation-exempt";
  severity: "info" | "miss";
  detail: string;
};
export type World = {
  elapsed: number;
  step: number;
  status: Status;
  actors: Actor[];
  casts: Cast[];
  pools: Pool[];
  spirits: Spirit[];
  valkyrs: Valkyr[];
  events: WorldEvent[];
  anchor: Point;
  stage: "stack" | "spread" | "relocate" | "settled";
  endReason:
    | "completed"
    | "actor-lost"
    | "platform-unusable"
    | "spirit-unresolved"
    | "recording-limit"
    | null;
};
export type Attempt = {
  run: RunSpec;
  world: World;
  seed: number;
  rngState: number;
  cursor: number;
  remainder: number;
  findings: Finding[];
};
export type TimerView = {
  id: string;
  label: string;
  icon: string;
  remaining: number;
  duration: number;
  kind: "cast" | "upcoming";
  mechanic: WorldEvent["mechanic"];
};
export type CueView = {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: "neutral" | "warning" | "danger" | "success";
};
export type PublicWorld = Omit<World, "actors" | "casts"> & {
  actors: Omit<Actor, "mind">[];
  casts: Omit<Cast, "targetCase">[];
};
export type View = {
  world: PublicWorld;
  findings: Finding[];
  timers: TimerView[];
  cue: CueView | null;
};
export type ScenarioRenderOptions = {
  showTrail?: boolean;
  showGrowth?: boolean;
  recordedTrail?: Point[];
  highlightedEvent?: WorldEvent | null;
  highlightedLabel?: string;
  highlightedDetail?: string;
};
export type Checkpoint = {
  runId: string;
  scenarioRevision: number;
  profileRevision: number;
  seed: number;
  world: World;
  rngState: number;
  cursor: number;
  findings: Finding[];
};
export type Frame = {
  world: Omit<World, "events">;
  eventCount: number;
  findingCount: number;
};
export type Recording = {
  frames: Frame[];
  events: WorldEvent[];
  findings: Finding[];
  checkpoints: Record<string, Checkpoint>;
};
