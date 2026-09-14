import { expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { preparePurchases } from "./candidates";
import { createSearchBudget } from "@/domain/equipment/search-budget";
import { Race } from "@/generated/wotlk/common";
import { encodeRequest } from "@/domain/top-gear/request-schema";
const prepare = (request = purchaseFixture({ frost: 60 })) =>
  preparePurchases(request, createSearchBudget(100000));
it("reviews specialization rewards and selects only available included rewards", () => {
  const request = purchaseFixture({ frost: 60 });
  request.purchases!.excludedItemIds.original = [50098];
  const prepared = prepare(request);
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 50853),
  ).toBeUndefined();
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
  expect(prepared.selection.selectedInstanceIds).not.toContain(
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
it("filters faction, class and profile and defaults to the Frost DK DPS variant", () => {
  for (const profile of ["original", "classic"] as const) {
    const request = purchaseFixture({ "regalia:vanquisher": 1 });
    request.snapshot.itemVersion = profile;
    request.snapshot.settings.player!.race = Race.RaceHuman;
    const prepared = prepare(request);
    expect(prepared.candidates.some((c) => c.instance.itemId === 48486)).toBe(
      true,
    );
    expect(prepared.candidates.some((c) => c.instance.itemId === 48543)).toBe(
      false,
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

import { prepareGems } from "@/domain/equipment/gemming";
import { Profession } from "@/generated/wotlk/common";

for (const automatic of [false, true]) {
  it.each([
    { label: "null", override: [null, 40111], expected: [40111, 40111] },
    { label: "omitted tail", override: [40111], expected: [40111, 40112] },
    { label: "explicit zero", override: [null, 0], expected: [40111, 0] },
    { label: "empty array", override: [], expected: [40111, 40112] },
  ])(
    `preserves custom $label gems with automatic gemming ${automatic}`,
    ({ override, expected }) => {
      const request = purchaseFixture({ frost: 95 });
      const custom = {
        instanceId: "custom-chest",
        itemId: 50094,
        source: "custom" as const,
        gemIds: [40111, 40112],
        enchantId: 0,
      };
      request.snapshot.inventory.push(custom);
      request.selection.selectedInstanceIds.push(custom.instanceId);
      request.snapshot.itemEnhancements = {
        [custom.instanceId]: { gemIds: override },
      };
      request.snapshot.gemming = {
        enabled: automatic,
        defaultGemId: 40111,
        metaGemId: 41398,
        jcGemId: 42142,
      };
      request.snapshot.settings.player!.profession1 = Profession.Jewelcrafting;
      request.snapshot.professionLevels = { [Profession.Jewelcrafting]: 450 };
      const originalLoadout = {
        ...request.snapshot.equipped,
        chest: custom.instanceId,
      };
      const originalGems =
        prepareGems(request.snapshot, originalLoadout).overrides[
          custom.instanceId
        ] ?? custom.gemIds;
      if (!automatic) expect(originalGems).toEqual(expected);
      else expect(originalGems).toContain(42142);
      const before = encodeRequest(request);
      const prepared = prepare(request);
      const generatedId = "purchase-original-50094";
      const generated = prepared.snapshot.inventory.find(
        (item) => item.instanceId === generatedId,
      )!;
      const generatedLoadout = {
        ...prepared.snapshot.equipped,
        chest: generatedId,
      };
      const generatedGems =
        prepareGems(prepared.snapshot, generatedLoadout).overrides[
          generatedId
        ] ?? generated.gemIds;
      expect(generatedGems).toEqual(originalGems);
      expect(
        prepared.candidates.find(
          (candidate) => candidate.instance.itemId === 50094,
        )!.instance.gemIds,
      ).toEqual([]);
      expect(encodeRequest(request)).toEqual(before);
    },
  );
}

it("supports explicit specialization choice without changing owned gear or exclusions", () => {
  const request = purchaseFixture({ frost: 100 });
  request.purchases!.gearVariant = "dk-tank";
  request.purchases!.excludedItemIds.original = [50853];
  const prepared = prepare(request);
  expect(
    prepared.candidates.every(
      (c) =>
        prepared.catalog.byItemId.get(c.instance.itemId)!.setVariant ===
        "dk-tank",
    ),
  ).toBe(true);
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 50853)?.included,
  ).toBe(false);
  expect(prepared.snapshot.inventory).toContainEqual(
    request.snapshot.inventory[0],
  );
  request.purchases!.gearVariant = "mage-dps";
  expect(() => prepare(request)).toThrow(
    "Invalid purchase gear specialization",
  );
});

it("keeps an explicitly selected other-specialization custom reward costed", () => {
  const request = purchaseFixture({ frost: 60 });
  request.snapshot.inventory.push({
    instanceId: "custom-tank",
    itemId: 50853,
    source: "custom",
    gemIds: [],
    enchantId: 0,
  });
  request.selection.selectedInstanceIds.push("custom-tank");
  const prepared = prepare(request);
  expect(prepared.selection.selectedInstanceIds).not.toContain("custom-tank");
  expect(prepared.selection.selectedInstanceIds).toContain(
    "purchase-original-50853",
  );
  expect(
    prepared.candidates.find((c) => c.instance.itemId === 50853)?.paths[0]
      .spent,
  ).toEqual({ frost: 60 });
});

it.each(["bag", "equipped"] as const)(
  "does not generate an already owned %s reward, even when deselected, and keeps its upgrade",
  (source) => {
    const request = purchaseFixture({
      frost: 100,
      "mark:normal:vanquisher": 1,
    });
    request.snapshot.inventory.push({
      instanceId: "existing-tier-head",
      itemId: 50096,
      source,
      gemIds: [],
      enchantId: 0,
    });
    const prepared = prepare(request);
    expect(prepared.candidates.some((c) => c.instance.itemId === 50096)).toBe(
      false,
    );
    expect(
      prepared.snapshot.inventory.filter((i) => i.itemId === 50096),
    ).toHaveLength(1);
    const upgrade = prepared.candidates.find(
      (c) => c.instance.itemId === 51127,
    );
    expect(upgrade?.available).toBe(true);
    expect(upgrade?.paths[0].spent).toEqual({ "mark:normal:vanquisher": 1 });
  },
);
