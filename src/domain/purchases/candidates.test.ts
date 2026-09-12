import { expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { preparePurchases } from "./candidates";
import { createSearchBudget } from "@/domain/equipment/search-budget";
import { Race } from "@/generated/wotlk/common";
import { encodeRequest } from "@/domain/top-gear/request-schema";
const prepare = (request = purchaseFixture({ frost: 60 })) =>
  preparePurchases(request, createSearchBudget(100000));
it("reviews compatible unavailable variants but selects only available included rewards", () => {
  const request = purchaseFixture({ frost: 60 });
  request.purchases!.excludedItemIds.original = [50098];
  const prepared = prepare(request);
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 50853)?.available,
  ).toBe(true);
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 51125),
  ).toMatchObject({
    available: false,
    missing: expect.arrayContaining([
      { resourceId: "mark:normal:vanquisher", quantity: 1 },
    ]),
  });
  expect(prepared.selection.selectedInstanceIds).not.toContain(
    "purchase-original-50098",
  );
  expect(prepared.selection.selectedInstanceIds).not.toContain(
    "purchase-original-51125",
  );
  expect(prepared.selection.selectedInstanceIds).toContain(
    "purchase-original-50853",
  );
  expect(
    prepared.candidates.every(
      (c) =>
        c.instance.source === "purchase" &&
        c.instance.equippedSlot === undefined,
    ),
  ).toBe(true);
});
it("explains the missing normal Mark and 264 predecessor while leaving unrelated purchases available", () => {
  const request = purchaseFixture({ "mark:heroic:vanquisher": 1, triumph: 30 });
  request.snapshot.inventory.push({
    instanceId: "owned-base",
    itemId: 50098,
    source: "bag",
    gemIds: [],
    enchantId: 0,
  });
  const prepared = prepare(request);
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 51314),
  ).toMatchObject({
    available: false,
    missing: expect.arrayContaining([
      { resourceId: "mark:normal:vanquisher", quantity: 1 },
      { itemId: 51125, quantity: 1 },
    ]),
  });
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 48505)?.available,
  ).toBe(true);
});
it("filters faction, class and profile while retaining both DK variants", () => {
  for (const profile of ["original", "classic"] as const) {
    const request = purchaseFixture({ "regalia:vanquisher": 1 });
    request.snapshot.itemVersion = profile;
    request.snapshot.settings.player!.race = Race.RaceHuman;
    const prepared = prepare(request);
    expect(prepared.candidates.some((c) => c.instance.itemId === 48486)).toBe(
      true,
    );
    expect(prepared.candidates.some((c) => c.instance.itemId === 48543)).toBe(
      true,
    );
    expect(prepared.candidates.some((c) => c.instance.itemId === 48495)).toBe(
      false,
    );
    expect(
      prepared.candidates.every(
        (c) =>
          prepared.catalog.byItemId.get(c.instance.itemId)!.classId ===
          request.snapshot.settings.player!.class,
      ),
    ).toBe(true);
    expect(
      prepared.candidates.every((c) =>
        c.instance.instanceId.startsWith(`purchase-${profile}-`),
      ),
    ).toBe(true);
  }
});
it("costs selected custom tier rewards, preserves intent, and retains physical duplicates and unrelated customs", () => {
  const request = purchaseFixture({ frost: 60 });
  request.snapshot.inventory.push(
    {
      instanceId: "custom-tier",
      itemId: 50098,
      source: "custom",
      gemIds: [40111],
      enchantId: 3808,
    },
    {
      instanceId: "owned-tier",
      itemId: 50098,
      source: "bag",
      gemIds: [],
      enchantId: 0,
    },
    {
      instanceId: "custom-other",
      itemId: 51000,
      source: "custom",
      gemIds: [],
      enchantId: 0,
    },
  );
  request.selection.selectedInstanceIds.push(
    "custom-tier",
    "owned-tier",
    "custom-other",
  );
  request.snapshot.itemEnhancements = {
    "custom-tier": { gemIds: [0], enchantId: 0 },
  };
  const before = encodeRequest(request);
  const prepared = prepare(request);
  expect(prepared.selection.selectedInstanceIds).not.toContain("custom-tier");
  expect(prepared.selection.selectedInstanceIds).toEqual(
    expect.arrayContaining([
      "owned-tier",
      "custom-other",
      "purchase-original-50098",
    ]),
  );
  expect(
    prepared.snapshot.itemEnhancements?.["purchase-original-50098"],
  ).toEqual({ gemIds: [0], enchantId: 0 });
  expect(encodeRequest(request)).toEqual(before);
  request.purchases!.itemEnhancements.original = {
    "50098": { enchantId: 3808 },
  };
  expect(
    prepare(request).snapshot.itemEnhancements?.["purchase-original-50098"],
  ).toEqual({ enchantId: 3808 });
});
it("allows an excluded reward as a purchased intermediate", () => {
  const request = purchaseFixture({ frost: 60, "mark:normal:vanquisher": 1 });
  request.purchases!.excludedItemIds.original = [50098];
  expect(
    prepare(request)
      .candidates.find((c) => c.instance.itemId === 51125)
      ?.paths[0].steps.map((s) => s.itemId),
  ).toEqual([50098, 51125]);
});
