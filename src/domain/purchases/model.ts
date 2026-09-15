import type { ItemVersion } from "@/domain/top-gear/item-version";
import type {
  ItemInstance,
  ItemEnhancementOverride,
  Snapshot,
  Selection,
  RunPlan,
  Allowance,
  Diagnostic,
} from "@/domain/top-gear/model";
export type TokenFamily = "vanquisher" | "protector" | "conqueror";
export type ResourceId =
  | "heroism"
  | "valor"
  | "conquest"
  | `tier:${7 | 8}:${10 | 25}:${"head" | "shoulder" | "chest" | "hands" | "legs"}:${TokenFamily}`
  | "frost"
  | "triumph"
  | "trophy"
  | `regalia:${TokenFamily}`
  | `mark:normal:${TokenFamily}`
  | `mark:heroic:${TokenFamily}`;
export type ResourceAmounts = Partial<Record<ResourceId, number>>;
export type PurchaseInputs = {
  version: 1;
  recipeRevision: string;
  balances: ResourceAmounts;
  gearVariant?: string;
  excludedItemIds: Partial<Record<ItemVersion, number[]>>;
  itemEnhancements: Partial<
    Record<ItemVersion, Record<string, ItemEnhancementOverride>>
  >; // decimal reward item IDs
};
export type PurchaseRecipe = {
  id: string; // e.g. t10-dk-dps-shoulder-264
  itemId: number;
  tier: 7 | 8 | 9 | 10;
  itemLevel: 200 | 213 | 219 | 225 | 226 | 232 | 245 | 258 | 251 | 264 | 277;
  setVariant: string; // stable class + variant, never a translated name
  slot: "head" | "shoulder" | "chest" | "hands" | "legs";
  classId: number;
  faction: "alliance" | "horde" | "both";
  profiles: ItemVersion[];
  cost: ResourceAmounts;
  alternativeCosts?: ResourceAmounts[];
  prerequisiteItemId?: number;
  sourceUrls: string[];
};
export type PurchaseCatalog = {
  revision: string;
  recipes: readonly PurchaseRecipe[];
  byItemId: ReadonlyMap<number, PurchaseRecipe>;
};
export type AcquisitionStep = {
  recipeId: string;
  itemId: number;
  resultId: string; // generated final ID or stable intermediate step ID
  prerequisite?: { itemId: number; instanceId?: string; stepId?: string };
  cost: ResourceAmounts;
};
export type PurchasePlan = {
  steps: AcquisitionStep[]; // topological order, prerequisites first
  spent: ResourceAmounts;
  remaining: ResourceAmounts;
  consumedInstanceIds: string[];
};
export type PurchaseCandidate = {
  instance: ItemInstance; // source purchase, stable ID, no equippedSlot
  recipeId: string;
  included: boolean;
  available: boolean;
  missing: Array<{
    resourceId?: ResourceId;
    itemId?: number;
    quantity: number;
  }>;
  paths: PurchasePlan[]; // individually affordable, nondominated paths
};
export type PreparedPurchases = {
  snapshot: Snapshot;
  selection: Selection;
  inputs: PurchaseInputs;
  candidates: PurchaseCandidate[];
  catalog: PurchaseCatalog;
};
export type FrozenPurchases = {
  version: 1;
  recipeRevision: string;
  inputs: PurchaseInputs;
  recipes: PurchaseRecipe[]; // recipes referenced by candidates/steps only
  generatedItems: ItemInstance[];
  effectiveEnhancements: Record<string, ItemEnhancementOverride>;
  plansByLoadoutKey: Record<string, PurchasePlan>;
};
export type PurchaseAnalysis =
  | {
      status: "complete";
      plan: RunPlan;
      visitedNodes: number;
      excludedByEnhancements: number;
      diagnostics: Diagnostic[];
    }
  | { status: "no-legal-sets"; visitedNodes: number; diagnostics: Diagnostic[] }
  | { status: "over-limit"; allowance: Allowance; visitedNodes: number }
  | { status: "search-limit"; visitedNodes: number }
  | { status: "catalog-changed"; currentRevision: string };
