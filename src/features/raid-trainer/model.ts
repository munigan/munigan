/** Experimental trainer contracts. World coordinates are independent of display pixels. */
export type Point = { x: number; y: number };
export type TrainingMode = "guided" | "timers";
export type Actor = Point & {
  id: string;
  name: string;
  role: "player" | "raid";
  color: string;
  radius: number;
  home: Point;
};
export type GrowingPool = {
  kind: "growing-pool";
  radius: number;
  growthPerHit: number;
  tickSeconds: number;
  lifetimeSeconds: number;
};
export type AbilityDefinition = {
  id: string;
  name: string;
  icon?: string;
  color: string;
  castSeconds: number;
  warningSeconds: number;
  regroupAfterSeconds: number;
  mechanic: GrowingPool;
};
export type ScheduledCast = {
  id: string;
  at: number;
  abilityId: string;
  target: "player" | "raid";
};
export type EncounterDefinition = {
  id: string;
  raidId: string;
  name: string;
  subtitle: string;
  location: string;
  lesson: { summary: string; steps: [string, string][] };
  duration: number;
  arena: { center: Point; radius: number; width: number; height: number };
  boss: Point & { name: string; portrait?: string };
  artwork?: string;
  actors: Actor[];
  abilities: Record<string, AbilityDefinition>;
  timeline: ScheduledCast[];
};
export type Cast = {
  id: string;
  abilityId: string;
  targetId: string;
  startedAt: number;
  resolvesAt: number;
  regroupAt: number;
  resolved: boolean;
};
export type Pool = Point & {
  id: string;
  abilityId: string;
  radius: number;
  bornAt: number;
  expiresAt: number;
  nextTick: number;
  growths: number;
};
export type TrainerEvent = {
  at: number;
  text: string;
  kind: "cast" | "pool" | "damage" | "regroup";
};
export type Snapshot = {
  elapsed: number;
  status: "ready" | "countdown" | "running" | "paused" | "complete" | "failed";
  actors: Actor[];
  casts: Cast[];
  pools: Pool[];
  stats: {
    casts: number;
    personalHits: number;
    raidHits: number;
    growths: number;
  };
  events: TrainerEvent[];
  trail: Point[];
};
export type Session = Snapshot & {
  encounter: EncounterDefinition;
  step: number;
  remainder: number;
  seed: number;
};
export type Timer = {
  id: string;
  name: string;
  icon?: string;
  remaining: number;
  duration: number;
  color: string;
  kind: "cast" | "upcoming" | "regroup";
};
