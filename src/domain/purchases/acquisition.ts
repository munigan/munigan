import type { SearchBudget } from "@/domain/equipment/search-budget";
import type { Loadout } from "@/domain/top-gear/model";
import type {
  AcquisitionStep,
  PreparedPurchases,
  PurchasePlan,
  PurchaseRecipe,
  ResourceAmounts,
  ResourceId,
} from "./model";
import { resourceIds } from "./schema";

const priority = (id: ResourceId) =>
  id.startsWith("mark:heroic:")
    ? 0
    : id.startsWith("regalia:")
      ? 1
      : id.startsWith("mark:normal:")
        ? 2
        : id === "trophy"
          ? 3
          : id === "frost"
            ? 4
            : 5;
const orderedResources = [...resourceIds].sort(
  (a, b) => priority(a) - priority(b) || lexical(a, b),
);
function lexical(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function noMore(a: ResourceAmounts, b: ResourceAmounts) {
  return resourceIds.every((id) => (a[id] ?? 0) <= (b[id] ?? 0));
}
/** Only compares explanations for identical final gear, never their DPS. */
export function comparePurchasePlans(a: PurchasePlan, b: PurchasePlan): number {
  if (noMore(a.spent, b.spent) && !noMore(b.spent, a.spent)) return -1;
  if (noMore(b.spent, a.spent) && !noMore(a.spent, b.spent)) return 1;
  for (const id of orderedResources) {
    const difference = (a.spent[id] ?? 0) - (b.spent[id] ?? 0);
    if (difference) return difference;
  }
  return (
    lexical(
      JSON.stringify([...a.consumedInstanceIds].sort()),
      JSON.stringify([...b.consumedInstanceIds].sort()),
    ) ||
    lexical(
      JSON.stringify(
        a.steps.map((s) => [s.recipeId, s.resultId, s.prerequisite]),
      ),
      JSON.stringify(
        b.steps.map((s) => [s.recipeId, s.resultId, s.prerequisite]),
      ),
    )
  );
}

function nondominated(
  plans: PurchasePlan[],
  budget: SearchBudget,
): PurchasePlan[] {
  const retained: PurchasePlan[] = [];
  for (const plan of plans.sort(comparePurchasePlans)) {
    // Different consumed IDs retain distinct physical ownership choices. A
    // cheaper owned path cannot erase a bought path needed by another final.
    if (
      !retained.some((other) => {
        budget.visit();
        return (
          JSON.stringify(other.consumedInstanceIds) ===
            JSON.stringify(plan.consumedInstanceIds) &&
          noMore(other.spent, plan.spent)
        );
      })
    )
      retained.push(plan);
  }
  return retained;
}

/** Internal DAG search shared by individual review and whole-set solving.
 * No reward-only memoization: each branch carries its full resource/ownership
 * state. The bounded search retains ownership-distinct affordable paths.
 */
export function acquisitionPaths(
  prepared: PreparedPurchases,
  rewards: Array<{ itemId: number; resultId: string }>,
  reserved: ReadonlySet<string>,
  budget: SearchBudget,
): PurchasePlan[] {
  type State = {
    spent: ResourceAmounts;
    consumed: Set<string>;
    steps: AcquisitionStep[];
  };
  const owned = prepared.snapshot.inventory
    .filter((i) => i.source === "bag" || i.source === "equipped")
    .sort((a, b) => lexical(a.instanceId, b.instanceId));
  function* acquire(
    recipe: PurchaseRecipe,
    resultId: string,
    state: State,
  ): Generator<State> {
    budget.visit();
    const spent = { ...state.spent };
    for (const [key, amount] of Object.entries(recipe.cost)) {
      const resource = key as ResourceId;
      spent[resource] = (spent[resource] ?? 0) + amount;
      if (spent[resource]! > (prepared.inputs.balances[resource] ?? 0)) return;
    }
    const charged = { ...state, spent };
    const step: AcquisitionStep = {
      recipeId: recipe.id,
      itemId: recipe.itemId,
      resultId,
      cost: { ...recipe.cost },
    };
    if (recipe.prerequisiteItemId === undefined) {
      yield { ...charged, steps: [...charged.steps, step] };
      return;
    }
    const itemId = recipe.prerequisiteItemId;
    for (const item of owned) {
      if (item.itemId !== itemId) continue;
      budget.visit();
      if (reserved.has(item.instanceId) || state.consumed.has(item.instanceId))
        continue;
      yield {
        ...charged,
        consumed: new Set([...state.consumed, item.instanceId]),
        steps: [
          ...state.steps,
          { ...step, prerequisite: { itemId, instanceId: item.instanceId } },
        ],
      };
    }
    const previous = prepared.catalog.byItemId.get(itemId);
    if (!previous) return;
    const stepId = `${resultId}:prerequisite-${itemId}`;
    for (const predecessor of acquire(previous, stepId, charged)) {
      budget.visit();
      yield {
        ...predecessor,
        steps: [
          ...predecessor.steps,
          { ...step, prerequisite: { itemId, stepId } },
        ],
      };
    }
  }
  let states: State[] = [{ spent: {}, consumed: new Set(), steps: [] }];
  for (const reward of [...rewards].sort((a, b) =>
    lexical(a.resultId, b.resultId),
  )) {
    const recipe = prepared.catalog.byItemId.get(reward.itemId);
    if (!recipe) return [];
    const next: State[] = [];
    for (const state of states) {
      budget.visit();
      for (const acquired of acquire(recipe, reward.resultId, state))
        next.push(acquired);
    }
    states = next;
    if (!states.length) break;
  }
  return nondominated(
    states.map((state) => ({
      steps: state.steps,
      spent: state.spent,
      consumedInstanceIds: [...state.consumed].sort(),
      remaining: Object.fromEntries(
        Object.entries(prepared.inputs.balances).map(([key, amount]) => [
          key,
          amount - (state.spent[key as ResourceId] ?? 0),
        ]),
      ),
    })),
    budget,
  );
}

export function solveAcquisition(
  prepared: PreparedPurchases,
  loadout: Loadout,
  budget: SearchBudget,
): PurchasePlan | null {
  budget.visit();
  const inventory = new Map(
    prepared.snapshot.inventory.map((i) => [i.instanceId, i]),
  );
  const candidates = new Map(
    prepared.candidates.map((c) => [c.instance.instanceId, c]),
  );
  const reserved = new Set<string>();
  const rewards: Array<{ itemId: number; resultId: string }> = [];
  const seen = new Set<string>();
  for (const id of Object.values(loadout)) {
    if (id === null) continue;
    const item = inventory.get(id);
    if (!item || seen.has(id)) return null;
    seen.add(id);
    if (item.source === "purchase") {
      const candidate = candidates.get(id);
      if (!candidate?.available || !candidate.included) return null;
      rewards.push({ itemId: item.itemId, resultId: id });
    } else {
      // Registered custom rewards may not bypass the effective selection.
      if (
        item.source === "custom" &&
        prepared.catalog.byItemId.has(item.itemId)
      )
        return null;
      reserved.add(id);
    }
  }
  return acquisitionPaths(prepared, rewards, reserved, budget)[0] ?? null;
}
