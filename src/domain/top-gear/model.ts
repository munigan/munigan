import type { IndividualSimSettings } from "@/generated/wotlk/ui";
export type Slot =
  | "head"
  | "neck"
  | "shoulder"
  | "back"
  | "chest"
  | "wrist"
  | "hands"
  | "waist"
  | "legs"
  | "feet"
  | "finger1"
  | "finger2"
  | "trinket1"
  | "trinket2"
  | "mainHand"
  | "offHand"
  | "ranged";
export type ItemInstance = {
  instanceId: string;
  itemId: number;
  enchantId: number;
  gemIds: number[];
  source: "equipped" | "bag";
  equippedSlot?: Slot;
};
export type Loadout = Record<Slot, string | null>; // instance IDs; explicit empty slots
export type Versions = {
  engine: string;
  schema: string;
  presets: string;
  catalog: string;
  optimizer: string;
};
export type Snapshot = {
  id: string;
  specId: string;
  versions: Versions;
  professionLevels?: Record<string, number>;
  settings: IndividualSimSettings;
  inventory: ItemInstance[];
  equipped: Loadout;
  provenance: Record<string, "imported" | "preset" | "edited">;
};
export type Selection = {
  selectedInstanceIds: string[];
  acknowledgedExclusions: string[]; // unsupported bag instance IDs explicitly excluded
  lockedSlots: Partial<Record<Slot, string | null>>;
};
export type TopGearRequest = {
  tool: "top-gear";
  snapshot: Snapshot;
  selection: Selection;
  precision: "standard";
};
export type Diagnostic = {
  code: string;
  path: string;
  severity: "error" | "warning";
  message: string;
};
export type Metric = { mean: number; stdev: number | null; iterations: number };
export type SimulationResult = {
  loadout: Loadout;
  inputHash: string;
  metric: Metric;
  stats: number[];
};
export type WorkPolicy = {
  version: string;
  unitsPerSet: number;
  maxUnits: number;
  iterationsPerSet: number;
  maxSearchNodes: number;
  maxJobSeconds: number;
  maxAttempts: number;
};
export type Allowance = {
  count: number;
  countKind: "exact" | "upper-bound" | "over-limit";
  units: number;
  allowed: boolean;
  policyVersion: string;
};
export type RunPlan = {
  candidateLoadouts: Loadout[];
  reference: Loadout;
  simulations: Array<{
    key: string;
    loadout: Loadout;
    seed: string;
    iterations: number;
  }>;
  allowance: Allowance;
};
export type SetRow = {
  id: string;
  loadout: Loadout;
  dps: number;
  gain: number | null;
  percent: number | null;
  swaps: number;
  eligible: boolean;
  isEquipped: boolean;
  tiedToHighest: boolean | null;
  iterations: number;
  inputHash: string;
  stats?: number[];
  stdev?: number | null;
};
export type TopGearReport = {
  token: string;
  status: "queued" | "running" | "complete" | "partial" | "failed" | "canceled";
  phase: "planning" | "equipped" | "combinations" | "complete";
  snapshot: Snapshot;
  selection: Selection;
  policy: WorkPolicy;
  rows: SetRow[];
  equippedId: string;
  highestId: string | null;
  recommendedId: string | null;
  coverage: {
    planned: number | null;
    succeeded: number;
    failed: number;
    returned: number;
    exhaustive: boolean;
  };
  termination:
    | "complete"
    | "runtime-limit"
    | "search-limit"
    | "canceled"
    | "failed"
    | null;
  expiresAt: string;
};
