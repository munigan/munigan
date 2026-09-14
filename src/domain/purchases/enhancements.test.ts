import { expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { setPurchaseEnhancements } from "./enhancements";
import { preparePurchases } from "./candidates";
import { createSearchBudget } from "@/domain/equipment/search-budget";
import { decodeDraft, encodeRequest } from "@/domain/top-gear/request-schema";
import { Profession } from "@/generated/wotlk/common";
it("normalizes profile-scoped overrides without changing the original input or generated raw enhancements", () => {
  const request = purchaseFixture({ frost: 60 });
  const before = encodeRequest(request);
  const next = setPurchaseEnhancements(request, 50098, {
    gemIds: [0, null],
    enchantId: 0,
  });
  expect(next.purchases!.itemEnhancements.original?.["50098"]).toEqual({
    gemIds: [0],
    enchantId: 0,
  });
  const prepared = preparePurchases(next, createSearchBudget(100000));
  expect(
    prepared.snapshot.itemEnhancements?.["purchase-original-50098"],
  ).toEqual({ gemIds: [0], enchantId: 0 });
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 50098)?.instance,
  ).toMatchObject({ gemIds: [], enchantId: 0 });
  expect(encodeRequest(request)).toEqual(before);
  expect(
    setPurchaseEnhancements(next, 50098, {}).purchases!.itemEnhancements
      .original?.["50098"],
  ).toBeUndefined();
});
it("validates socket, enchant and profession rank rules in edits and preparation", () => {
  for (const override of [
    { gemIds: [41398] },
    { enchantId: 3839 },
    { gemIds: [42142] },
  ]) {
    const request = purchaseFixture({ frost: 60 });
    request.snapshot.settings.player!.profession1 = Profession.Jewelcrafting;
    delete request.snapshot.professionLevels;
    expect(() => setPurchaseEnhancements(request, 50098, override)).toThrow();
    request.purchases!.itemEnhancements.original = { "50098": override };
    expect(() =>
      preparePurchases(request, createSearchBudget(100000)),
    ).toThrow();
  }
});
it("preserves other profiles and permits overrides for unavailable compatible rewards", () => {
  const request = purchaseFixture({ frost: 0 });
  request.purchases!.itemEnhancements.classic = { "50098": { enchantId: 0 } };
  const next = setPurchaseEnhancements(request, 51125, { enchantId: 3808 });
  expect(next.purchases!.itemEnhancements.classic).toEqual(
    request.purchases!.itemEnhancements.classic,
  );
  expect(next.purchases!.itemEnhancements.original?.["51125"]).toEqual({
    enchantId: 3808,
  });
  expect(() => setPurchaseEnhancements(request, 48486, {})).toThrow();
});
it("identifies an invalid purchase override so the editor can reset that exact reward", async () => {
  const { PurchaseEnhancementError } = await import("./enhancements");
  const request = purchaseFixture({ frost: 60 });
  request.purchases!.itemEnhancements.original = {
    "50098": { enchantId: 3839 },
  };
  try {
    preparePurchases(request, createSearchBudget(100000));
    expect.fail("Expected invalid enhancement");
  } catch (error) {
    expect(error).toBeInstanceOf(PurchaseEnhancementError);
    expect(error).toMatchObject({
      itemId: 50098,
      profile: "original",
      diagnostics: [
        expect.objectContaining({
          code: "enchant",
          path: "purchase-original-50098.enchantId",
        }),
      ],
    });
  }
  const reset = setPurchaseEnhancements(request, 50098, {});
  expect(() =>
    preparePurchases(reset, createSearchBudget(100000)),
  ).not.toThrow();
});
it("explicitly resets inherited custom intent to defaults without modifying the original custom item", () => {
  const request = purchaseFixture({ frost: 60 });
  request.snapshot.inventory.push({
    instanceId: "custom-tier",
    itemId: 50098,
    source: "custom",
    gemIds: [40111],
    enchantId: 3808,
  });
  request.selection.selectedInstanceIds.push("custom-tier");
  request.snapshot.itemEnhancements = { "custom-tier": { enchantId: 3839 } };
  const before = encodeRequest(request);
  expect(() => preparePurchases(request, createSearchBudget(100000))).toThrow();
  const reset = setPurchaseEnhancements(request, 50098, {});
  expect(reset.purchases!.itemEnhancements.original?.["50098"]).toEqual({});
  expect(
    decodeDraft(encodeRequest(reset)).purchases!.itemEnhancements.original?.[
      "50098"
    ],
  ).toEqual({});
  const prepared = preparePurchases(reset, createSearchBudget(100000));
  expect(
    prepared.snapshot.itemEnhancements?.["purchase-original-50098"],
  ).toEqual({});
  expect(
    prepared.snapshot.inventory.find(
      (item) => item.instanceId === "purchase-original-50098",
    )?.gemIds,
  ).toEqual([]);
  expect(reset.snapshot).toEqual(request.snapshot);
  expect(encodeRequest(request)).toEqual(before);
});
