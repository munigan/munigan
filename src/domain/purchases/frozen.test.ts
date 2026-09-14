import { expect, it } from "vitest";
import { loadoutKey } from "@/domain/equipment/enumerate";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import { analyzePurchaseSelection } from "./analysis";
import { hydratePurchaseSnapshot } from "./frozen";

function frozenFixture() {
  const request = purchaseFixture({ frost: 60 });
  request.snapshot.inventory.push({
    instanceId: "custom-shoulder",
    itemId: 50098,
    source: "custom",
    gemIds: [40111],
    enchantId: 3808,
  });
  request.selection.selectedInstanceIds.push("custom-shoulder");
  request.snapshot.itemEnhancements = { "custom-shoulder": { gemIds: [null] } };
  const result = analyzePurchaseSelection(request, purchasePolicy);
  if (result.status !== "complete") throw new Error(result.status);
  return { request, result, frozen: result.plan.purchases! };
}

it("freezes effective converted custom gems and hydrates identical simulation keys without a current recipe catalog", () => {
  const { request, result, frozen } = frozenFixture();
  expect(frozen.generatedItems.find((i) => i.itemId === 50098)).toMatchObject({
    gemIds: [40111],
    enchantId: 0,
  });
  expect(frozen.effectiveEnhancements["purchase-original-50098"]).toEqual({
    gemIds: [null],
    enchantId: 3808,
  });
  const persisted = JSON.parse(JSON.stringify(frozen));
  persisted.recipeRevision = "retired";
  persisted.recipes = [];
  const hydrated = hydratePurchaseSnapshot(request.snapshot, persisted);
  expect(hydrated).not.toBe(request.snapshot);
  expect(request.snapshot.inventory.some((i) => i.source === "purchase")).toBe(
    false,
  );
  for (const simulation of result.plan.simulations)
    expect(
      loadoutKey(hydrated, simulation.loadout, simulation.isReference),
    ).toBe(simulation.key);
});

it("freezes original inputs and referenced recipes without mutable aliases", () => {
  const { request, result, frozen } = frozenFixture();
  const balance = frozen.inputs.balances.frost;
  request.purchases!.balances.frost = 0;
  request.snapshot.itemEnhancements!["custom-shoulder"].gemIds![0] = 0;
  expect(frozen.inputs.balances.frost).toBe(balance);
  expect(frozen.effectiveEnhancements["custom-shoulder"].gemIds).toEqual([
    null,
  ]);
  expect(
    frozen.recipes.find((recipe) => recipe.itemId === 50098)?.cost,
  ).toEqual({ frost: 60 });
  expect(
    frozen.plansByLoadoutKey[result.plan.simulations[0].key].spent,
  ).toEqual({});
  const hydrated = hydratePurchaseSnapshot(request.snapshot, frozen);
  hydrated.inventory.find(
    (i) => i.instanceId === "purchase-original-50098",
  )!.gemIds[0] = 0;
  hydrated.itemEnhancements!["purchase-original-50098"].gemIds![0] = 0;
  expect(frozen.generatedItems.find((i) => i.itemId === 50098)?.gemIds).toEqual(
    [40111],
  );
  expect(
    frozen.effectiveEnhancements["purchase-original-50098"].gemIds,
  ).toEqual([null]);
});

it("rejects duplicate persisted generated IDs and collisions with physical inventory", () => {
  const { request, frozen } = frozenFixture();
  frozen.generatedItems.push({ ...frozen.generatedItems[0] });
  expect(() => hydratePurchaseSnapshot(request.snapshot, frozen)).toThrow(
    /duplicate/i,
  );
  frozen.generatedItems.pop();
  frozen.generatedItems[0].instanceId = "owned-legs";
  expect(() => hydratePurchaseSnapshot(request.snapshot, frozen)).toThrow(
    /duplicate/i,
  );
  expect(request.snapshot.inventory[0].itemId).toBe(48504);
});
