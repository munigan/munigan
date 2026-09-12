import {
  allowanceForCount,
  enumerateLoadouts,
  loadoutKey,
} from "@/domain/equipment/enumerate";
import {
  createSearchBudget,
  SearchLimitError,
} from "@/domain/equipment/search-budget";
import { itemVersionOf } from "@/domain/top-gear/item-version";
import type {
  Diagnostic,
  Loadout,
  TopGearRequest,
  WorkPolicy,
} from "@/domain/top-gear/model";
import { comparePurchasePlans, solveAcquisition } from "./acquisition";
import { preparePurchases } from "./candidates";
import { getPurchaseCatalog } from "./catalog";
import type {
  PreparedPurchases,
  PurchaseAnalysis,
  PurchasePlan,
  ResourceAmounts,
  ResourceId,
} from "./model";

export function analyzePurchaseSelection(
  request: TopGearRequest,
  policy: WorkPolicy,
  onPrepared?: (prepared: PreparedPurchases) => void,
): PurchaseAnalysis {
  if (!request.purchases) throw new Error("Purchase inputs are required");
  const catalog = getPurchaseCatalog(itemVersionOf(request.snapshot));
  if (request.purchases.recipeRevision !== catalog.revision)
    return { status: "catalog-changed", currentRevision: catalog.revision };
  const budget = createSearchBudget(policy.maxSearchNodes);
  try {
    const prepared = preparePurchases(request, budget);
    onPrepared?.(prepared);
    const { snapshot, selection } = prepared;
    const referenceKey = loadoutKey(snapshot, snapshot.equipped, true);
    const keyed = new Map<string, { loadout: Loadout; plan: PurchasePlan }>([
      [
        referenceKey,
        {
          loadout: snapshot.equipped,
          plan: {
            steps: [],
            spent: {},
            remaining: { ...prepared.inputs.balances },
            consumedInstanceIds: [],
          },
        },
      ],
    ]);
    const candidates = new Map<
      string,
      { loadout: Loadout; plan: PurchasePlan }
    >();
    const excludedKeys = new Set<string>();
    const diagnostics: Diagnostic[] = [];
    const diagnosticKeys = new Set<string>();
    const rewardCosts = new Map(
      prepared.candidates.map((candidate) => [
        candidate.instance.instanceId,
        catalog.byItemId.get(candidate.instance.itemId)!.cost,
      ]),
    );
    let acquisition: PurchasePlan | null = null;
    const maxSets = Math.floor(policy.maxUnits / policy.unitsPerSet);
    for (const loadout of enumerateLoadouts(
      snapshot,
      selection,
      undefined,
      policy.maxSearchNodes,
      (excluded, errors) => {
        excludedKeys.add(loadoutKey(snapshot, excluded));
        for (const diagnostic of errors) {
          const key = JSON.stringify(diagnostic);
          if (!diagnosticKeys.has(key)) {
            diagnosticKeys.add(key);
            diagnostics.push(diagnostic);
          }
        }
      },
      {
        budget,
        deduplicate: false,
        acceptPartial: (partial, assignedSlots) => {
          // Every final reward pays its own recipe cost, regardless of which
          // prerequisite path wins. Ignore unassigned slots and prerequisite
          // costs here: this is a lower bound, never a greedy path decision.
          const spent: ResourceAmounts = {};
          for (const slot of assignedSlots) {
            const id = partial[slot];
            if (id === null) continue;
            for (const [resource, amount] of Object.entries(
              rewardCosts.get(id) ?? {},
            )) {
              const resourceId = resource as ResourceId;
              spent[resourceId] = (spent[resourceId] ?? 0) + amount;
              if (
                spent[resourceId]! > (prepared.inputs.balances[resourceId] ?? 0)
              )
                return false;
            }
          }
          return true;
        },
        acceptComplete: (complete) => {
          acquisition = solveAcquisition(prepared, complete, budget);
          return acquisition !== null;
        },
      },
    )) {
      const key = loadoutKey(snapshot, loadout);
      const previousCandidate = candidates.get(key);
      if (
        !previousCandidate ||
        comparePurchasePlans(acquisition!, previousCandidate.plan) < 0
      )
        candidates.set(key, { loadout, plan: acquisition! });
      const previous = keyed.get(key);
      // The reference always describes the unchanged input with zero spend.
      // Replace gear and explanation together when a cheaper physical path wins.
      if (
        !previous ||
        (key !== referenceKey &&
          comparePurchasePlans(acquisition!, previous.plan) < 0)
      )
        keyed.set(key, { loadout, plan: acquisition! });
      if (keyed.size > maxSets)
        return {
          status: "over-limit",
          allowance: allowanceForCount(keyed.size, policy, "over-limit"),
          visitedNodes: budget.visitedNodes,
        };
    }
    if (!candidates.size)
      return {
        status: "no-legal-sets",
        visitedNodes: budget.visitedNodes,
        diagnostics,
      };
    const simulations = [...keyed].map(([key, { loadout }], index) => ({
      key,
      loadout,
      isReference: index === 0,
      seed: String(100000 + index * (policy.iterationsPerSet + 1)),
      iterations: policy.iterationsPerSet,
    }));
    const plansByLoadoutKey = Object.fromEntries(
      [...keyed].map(([key, value]) => [key, value.plan]),
    );
    const recipeIds = new Set(
      prepared.candidates.map((candidate) => candidate.recipeId),
    );
    for (const plan of Object.values(plansByLoadoutKey))
      for (const step of plan.steps) recipeIds.add(step.recipeId);
    return {
      status: "complete",
      visitedNodes: budget.visitedNodes,
      excludedByEnhancements: excludedKeys.size,
      diagnostics,
      plan: {
        candidateLoadouts: [...candidates.values()].map(
          ({ loadout }) => loadout,
        ),
        reference: snapshot.equipped,
        simulations,
        allowance: allowanceForCount(simulations.length, policy),
        purchases: structuredClone({
          version: 1,
          recipeRevision: prepared.inputs.recipeRevision,
          inputs: prepared.inputs,
          recipes: catalog.recipes.filter((recipe) => recipeIds.has(recipe.id)),
          generatedItems: snapshot.inventory.filter(
            (item) => item.source === "purchase",
          ),
          effectiveEnhancements: snapshot.itemEnhancements ?? {},
          plansByLoadoutKey,
        }),
      },
    };
  } catch (error) {
    if (error instanceof SearchLimitError)
      return { status: "search-limit", visitedNodes: budget.visitedNodes };
    throw error;
  }
}
