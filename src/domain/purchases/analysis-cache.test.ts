import { afterEach, expect, it, vi } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import { createPurchaseAnalyzer, analyzePurchaseSelection } from "./analysis";
import * as candidates from "./candidates";
import { createAcquisitionSolver, solveAcquisition } from "./acquisition";
import { createSearchBudget } from "../equipment/search-budget";
import { purchaseInstanceId } from "./schema";

afterEach(() => vi.restoreAllMocks());
const policy = { ...purchasePolicy, maxUnits: null, maxSearchNodes: null };
function fixture() {
  const request = purchaseFixture({ frost: 134, "regalia:vanquisher": 1 });
  request.snapshot.inventory.push({
    instanceId: "trinket",
    itemId: 49487,
    source: "bag",
    gemIds: [],
    enchantId: 0,
  });
  return request;
}
function resultContent(result: ReturnType<typeof analyzePurchaseSelection>) {
  return "visitedNodes" in result ? { ...result, visitedNodes: 0 } : result;
}
it("reuses tier preparation across decoded ordinary selections without reusing stale combinations", () => {
  const analyze = createPurchaseAnalyzer();
  const prepare = vi.spyOn(candidates, "preparePurchases");
  const request = fixture();
  const first = analyze(structuredClone(request), policy);
  request.selection.selectedInstanceIds.push("trinket");
  const next = analyze(structuredClone(request), policy);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(first.status).toBe("complete");
  expect(next.status).toBe("complete");
  if (first.status === "complete" && next.status === "complete")
    expect(next.plan.simulations.length).toBeGreaterThan(
      first.plan.simulations.length,
    );
  expect(resultContent(next)).toEqual(
    resultContent(analyzePurchaseSelection(request, policy)),
  );
});
it("invalidates preparation when the wallet, enhancements, or custom conversion changes", () => {
  const analyze = createPurchaseAnalyzer();
  const prepare = vi.spyOn(candidates, "preparePurchases");
  const request = fixture();
  analyze(structuredClone(request), policy);
  request.purchases!.balances.frost = 60;
  analyze(structuredClone(request), policy);
  request.purchases!.itemEnhancements.original = {
    "50098": { gemIds: [40111] },
  };
  analyze(structuredClone(request), policy);
  request.snapshot.inventory.push({
    instanceId: "custom",
    itemId: 50098,
    source: "custom",
    gemIds: [],
    enchantId: 0,
  });
  analyze(structuredClone(request), policy);
  request.selection.selectedInstanceIds.push("custom");
  const result = analyze(structuredClone(request), policy);
  expect(prepare).toHaveBeenCalledTimes(5);
  expect(resultContent(result)).toEqual(
    resultContent(analyzePurchaseSelection(request, policy)),
  );
});
it("reuses purchase decisions for ordinary slots but distinguishes reserved upgrade prerequisites", () => {
  const request = purchaseFixture({ "mark:normal:vanquisher": 1 });
  request.snapshot.inventory.push(
    {
      instanceId: "base",
      itemId: 50098,
      source: "bag",
      gemIds: [],
      enchantId: 0,
    },
    {
      instanceId: "trinket",
      itemId: 49487,
      source: "bag",
      gemIds: [],
      enchantId: 0,
    },
  );
  const prepared = candidates.preparePurchases(
    request,
    createSearchBudget(null),
  );
  const solve = createAcquisitionSolver(prepared);
  const loadout = {
    ...prepared.snapshot.equipped,
    shoulder: purchaseInstanceId("original", 51125),
  };
  const budget = createSearchBudget(null);
  const first = solve(loadout, budget);
  const spent = budget.visitedNodes;
  const next = solve({ ...loadout, trinket1: "trinket" }, budget);
  expect(next).toEqual(first);
  expect(budget.visitedNodes - spent).toBe(1);
  const freshBudget = createSearchBudget(null);
  expect(solve(loadout, freshBudget)).toEqual(first);
  expect(freshBudget.visitedNodes).toBe(spent);
  const reserved = { ...loadout, head: "base" };
  expect(solve(reserved, createSearchBudget(null))).toEqual(
    solveAcquisition(prepared, reserved, createSearchBudget(null)),
  );
  expect(solve(reserved, createSearchBudget(null))).toBeNull();
  expect(
    solve({ ...loadout, trinket1: "missing" }, createSearchBudget(null)),
  ).toBeNull();
});

it("does not recalculate automatic gems for unchanged sets after deselecting ordinary gear", async () => {
  const { createGearLabStore } =
    await import("../../features/inventory/state/gear-lab-store");
  const gems = await import("../equipment/gemming");
  const request = fixture();
  request.selection.selectedInstanceIds.push("trinket");
  const draft = createGearLabStore(request).getState().draft!;
  const analyze = createPurchaseAnalyzer();
  const prepare = vi.spyOn(gems, "prepareGems");
  analyze(structuredClone(draft), policy);
  expect(prepare).toHaveBeenCalled();
  prepare.mockClear();
  draft.selection.selectedInstanceIds =
    draft.selection.selectedInstanceIds.filter((id) => id !== "trinket");
  const warm = analyze(structuredClone(draft), policy);
  expect(prepare).not.toHaveBeenCalled();
  expect(resultContent(warm)).toEqual(
    resultContent(analyzePurchaseSelection(draft, policy)),
  );
});

it("drops cached loadout evaluation when automatic enhancements or profile inputs change", async () => {
  const { createGearLabStore } =
    await import("../../features/inventory/state/gear-lab-store");
  const request = createGearLabStore(fixture()).getState().draft!;
  const analyze = createPurchaseAnalyzer();
  analyze(structuredClone(request), policy);
  request.snapshot.gemming!.defaultGemId = 40112;
  const updated = analyze(structuredClone(request), policy);
  expect(resultContent(updated)).toEqual(
    resultContent(analyzePurchaseSelection(request, policy)),
  );
  request.snapshot.autoEnchant = false;
  expect(resultContent(analyze(structuredClone(request), policy))).toEqual(
    resultContent(analyzePurchaseSelection(request, policy)),
  );
});
it("does not let a warm context bypass a newly reduced search budget", () => {
  const request = fixture();
  const analyze = createPurchaseAnalyzer();
  analyze(request, policy);
  expect(
    analyze(structuredClone(request), { ...policy, maxSearchNodes: 1 }),
  ).toMatchObject({ status: "search-limit", visitedNodes: 1 });
  expect(resultContent(analyze(structuredClone(request), policy))).toEqual(
    resultContent(analyzePurchaseSelection(request, policy)),
  );
});

it("keeps the same search-limit outcome for warm preview and cold admission at the same budget", () => {
  const request = fixture();
  request.selection.selectedInstanceIds.push("trinket");
  const full = analyzePurchaseSelection(request, policy);
  if (full.status !== "complete") throw new Error(full.status);
  const limited = { ...policy, maxSearchNodes: full.visitedNodes - 1 };
  const cold = analyzePurchaseSelection(structuredClone(request), limited);
  expect(cold.status).toBe("search-limit");
  const analyze = createPurchaseAnalyzer();
  expect(resultContent(analyze(structuredClone(request), limited))).toEqual(
    resultContent(cold),
  );
  expect(resultContent(analyze(structuredClone(request), limited))).toEqual(
    resultContent(cold),
  );
});
