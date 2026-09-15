import {
  allowanceForCount,
  enumerateLoadouts,
  createLoadoutEvaluator,
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
import { comparePurchasePlans, createAcquisitionSolver } from "./acquisition";
import { preparePurchases } from "./candidates";
import { getPurchaseCatalog } from "./catalog";
import type {
  PreparedPurchases,
  PurchaseAnalysis,
  PurchasePlan,
  ResourceAmounts,
  ResourceId,
} from "./model";

function analyzeSelection(
  request: TopGearRequest,
  policy: WorkPolicy,
  onPrepared: ((prepared: PreparedPurchases) => void) | undefined,
  prepare: (
    request: TopGearRequest,
    budget: ReturnType<typeof createSearchBudget>,
  ) => {
    prepared: PreparedPurchases;
    solve: ReturnType<typeof createAcquisitionSolver>;
    evaluator: ReturnType<typeof createLoadoutEvaluator>;
  },
): PurchaseAnalysis {
  if (!request.purchases) throw new Error("Purchase inputs are required");
  const catalog = getPurchaseCatalog(itemVersionOf(request.snapshot));
  if (request.purchases.recipeRevision !== catalog.revision)
    return { status: "catalog-changed", currentRevision: catalog.revision };
  const budget = createSearchBudget(policy.maxSearchNodes);
  try {
    const { prepared, solve, evaluator } = prepare(request, budget);
    onPrepared?.(prepared);
    const { snapshot, selection } = prepared;
    const referenceKey = evaluator.key(snapshot.equipped, true);
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
        catalog.byItemId.get(candidate.instance.itemId)!.alternativeCosts
          ?.length
          ? {}
          : catalog.byItemId.get(candidate.instance.itemId)!.cost,
      ]),
    );
    let acquisition: PurchasePlan | null = null;
    const maxSets =
      policy.maxUnits === null
        ? null
        : Math.floor(policy.maxUnits / policy.unitsPerSet);
    for (const loadout of enumerateLoadouts(
      snapshot,
      selection,
      undefined,
      policy.maxSearchNodes,
      (excluded, errors) => {
        excludedKeys.add(evaluator.key(excluded));
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
        evaluator,
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
          acquisition = solve(complete, budget);
          return acquisition !== null;
        },
      },
    )) {
      const key = evaluator.key(loadout);
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
    }
    if (maxSets !== null && keyed.size > maxSets)
      return {
        status: "over-limit",
        allowance: allowanceForCount(keyed.size, policy, "exact"),
        visitedNodes: budget.visitedNodes,
      };
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

/** A fresh analyzer preserves the standalone/server entry point. */
export function analyzePurchaseSelection(
  request: TopGearRequest,
  policy: WorkPolicy,
  onPrepared?: (prepared: PreparedPurchases) => void,
): PurchaseAnalysis {
  return createPurchaseAnalyzer()(request, policy, onPrepared);
}

/** Worker-local cache of purchase inputs, independent of ordinary item selection.
 * Full gear legality is still enumerated against the current selection each time.
 */
export function createPurchaseAnalyzer() {
  let previous:
    | {
        key: string;
        preparationNodes: number;
        prepared: PreparedPurchases;
        solve: ReturnType<typeof createAcquisitionSolver>;
        evaluator: ReturnType<typeof createLoadoutEvaluator>;
      }
    | undefined;
  return (
    request: TopGearRequest,
    policy: WorkPolicy,
    onPrepared?: (prepared: PreparedPurchases) => void,
  ): PurchaseAnalysis =>
    analyzeSelection(request, policy, onPrepared, (current, budget) => {
      const catalog = getPurchaseCatalog(itemVersionOf(current.snapshot));
      const selected = new Set(current.selection.selectedInstanceIds);
      const converted = current.snapshot.inventory
        .filter(
          (item) =>
            item.source === "custom" &&
            selected.has(item.instanceId) &&
            catalog.byItemId.has(item.itemId),
        )
        .map((item) => item.instanceId);
      // Requests are decoded afresh at the worker boundary: compare values here,
      // once per dispatch, rather than relying on React/store object identity.
      const key = JSON.stringify([
        current.snapshot,
        current.purchases,
        current.selection.lockedSlots,
        converted,
        policy.maxSearchNodes,
      ]);
      if (!previous || previous.key !== key) {
        // Never retain partial preparation after a budget/validation failure.
        previous = undefined;
        const before = budget.visitedNodes;
        const prepared = preparePurchases(current, budget);
        previous = {
          key,
          preparationNodes: budget.visitedNodes - before,
          prepared,
          solve: createAcquisitionSolver(prepared),
          evaluator: createLoadoutEvaluator(prepared.snapshot),
        };
      } else {
        // Cache warmth must not change whether cold server admission accepts a run.
        for (let node = 0; node < previous.preparationNodes; node++)
          budget.visit();
      }
      const removed = new Set(converted);
      const prepared: PreparedPurchases = {
        ...previous.prepared,
        selection: {
          ...current.selection,
          lockedSlots: previous.prepared.selection.lockedSlots,
          selectedInstanceIds: [
            ...current.selection.selectedInstanceIds.filter(
              (id) => !removed.has(id),
            ),
            ...previous.prepared.candidates
              .filter((c) => c.available && c.included)
              .map((c) => c.instance.instanceId),
          ],
        },
      };
      return { prepared, solve: previous.solve, evaluator: previous.evaluator };
    });
}

/** Interactive previews run in a cancellable worker, outside server admission.
 * Keep simulation limits; only the computational search budget is independent.
 */
export function createPurchasePreviewAnalyzer() {
  const analyze = createPurchaseAnalyzer();
  return (
    request: TopGearRequest,
    policy: WorkPolicy,
    onPrepared?: (prepared: PreparedPurchases) => void,
  ) => analyze(request, { ...policy, maxSearchNodes: null }, onPrepared);
}
