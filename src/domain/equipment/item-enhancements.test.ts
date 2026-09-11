import { expect, it } from "vitest";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { simulationInput } from "@/server/simulator/evaluate";
import { prepareGems } from "./gemming";
import { prepareEnchants } from "./enhancements";
import { planRun } from "./enumerate";
import { workPolicy } from "@/server/jobs/policy";
import { rankResults } from "@/domain/top-gear/report";

it("sends fixed gems and explicit empty enhancements to simulation with automatic settings off", () => {
  const { snapshot: s } = fixtureRequest();
  const chest = s.inventory.find((i) => i.instanceId === s.equipped.legs)!;
  s.gemming = undefined;
  s.autoEnchant = false;
  s.itemEnhancements = {
    [chest.instanceId]: { gemIds: [40112, 0], enchantId: 0 },
  };
  const input = simulationInput(s, s.equipped, 20, "1001");
  expect(input.raid!.parties[0].players[0].equipment!.items[8]).toMatchObject({
    enchant: 0,
    gems: [40112, 0],
  });
  expect(chest.enchantId).not.toBe(0);
});
it("does not let automatic JC allocation or meta repair replace a fixed gem or empty socket", () => {
  const { snapshot: s } = fixtureRequest();
  const chest = s.inventory.find((i) => i.instanceId === s.equipped.legs)!;
  s.itemEnhancements = {
    [chest.instanceId]: { gemIds: [40112, 0], enchantId: 0 },
  };
  expect(
    prepareGems(s, s.equipped).overrides[chest.instanceId]?.slice(0, 2),
  ).toEqual([40112, 0]);
  expect(prepareEnchants(s, s.equipped).overrides[chest.instanceId]).toBe(0);
});
it("plans and ranks an enhancement-only candidate separately from the original equipped reference", () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  const chest = s.inventory.find((i) => i.instanceId === s.equipped.legs)!;
  s.itemEnhancements = { [chest.instanceId]: { enchantId: 0 } };
  const plan = planRun(s, request.selection, workPolicy());
  expect(plan.simulations).toHaveLength(2);
  expect(plan.simulations[0].isReference).toBe(true);
  const results = plan.simulations.map((work, index) => ({
    loadout: work.loadout,
    isReference: work.isReference,
    enchantOverrides: index ? { [chest.instanceId]: 0 } : {},
    inputHash: index ? "candidate" : "baseline",
    metric: { mean: index ? 1100 : 1000, stdev: 1, iterations: 20 },
    stats: [],
  }));
  const report = rankResults(s, results, plan.candidateLoadouts);
  expect(report.equippedId).toBe("baseline");
  expect(report.rows).toHaveLength(2);
  expect(report.rows.find((r) => r.id === "candidate")).toMatchObject({
    isEquipped: false,
    gain: 100,
  });
});

import {
  previewItemEnhancements,
  validateItemEnhancements,
  setItemEnhancements,
} from "./item-enhancements";
import {
  encodeRequest,
  decodeDraft,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import { Profession } from "@/generated/wotlk/common";
import { defaultGemming } from "./gemming";

it("round trips sparse automatic values and resets without touching the imported reference", () => {
  const request = fixtureRequest(),
    item = request.snapshot.inventory.find((i) => i.equippedSlot === "legs")!;
  const edited = setItemEnhancements(request, item.instanceId, {
    gemIds: [null, 0],
    enchantId: 0,
  });
  expect(
    decodeDraft(encodeRequest(edited)).snapshot.itemEnhancements?.[
      item.instanceId
    ],
  ).toEqual({ gemIds: [null, 0], enchantId: 0 });
  expect(edited.snapshot.inventory).toEqual(request.snapshot.inventory);
  expect(edited.selection).toEqual(request.selection);
  const reset = setItemEnhancements(edited, item.instanceId, {});
  expect(reset.snapshot.itemEnhancements?.[item.instanceId]).toBeUndefined();
  expect(previewItemEnhancements(reset.snapshot, item).gemIds).toEqual(
    item.gemIds,
  );
});
it("previews automatic enhancements for an empty candidate even when it is equipped", () => {
  const request = fixtureRequest(),
    s = request.snapshot,
    item = s.inventory.find((i) => i.equippedSlot === "legs")!;
  item.gemIds = [];
  s.gemming = defaultGemming(s);
  expect(previewItemEnhancements(s, item).gemIds).toHaveLength(2);
  expect(previewItemEnhancements(s, item).gemIds.every(Boolean)).toBe(true);
  expect(item.gemIds).toEqual([]);
});
it("rejects unknown IDs, wrong sockets, incompatible enchants and forged override fields at admission", () => {
  const request = fixtureRequest(),
    s = request.snapshot,
    item = s.inventory.find((i) => i.equippedSlot === "legs")!;
  for (const override of [
    { gemIds: [9999999] },
    { gemIds: [41398] },
    { gemIds: [null, null, 0] },
    { enchantId: 3839 },
    { enchantId: 9999999 },
  ]) {
    expect(
      validateItemEnhancements(s, item, override).some(
        (d) => d.severity === "error",
      ),
    ).toBe(true);
    s.itemEnhancements = { [item.instanceId]: override };
    expect(() => validateRequest(encodeRequest(request))).toThrow();
  }
  s.itemEnhancements = { "not-owned": { enchantId: 0 } };
  expect(() => validateRequest(encodeRequest(request))).toThrow(
    /instance|owned/,
  );
  const forged = encodeRequest(request);
  forged.snapshot.itemEnhancements = {
    [item.instanceId]: { enchantId: 0, forged: true } as never,
  };
  expect(() => decodeDraft(forged)).toThrow();
});
it("requires verified profession rank for manually selected JC gems and blacksmith sockets", () => {
  const { snapshot: s } = fixtureRequest(),
    legs = s.inventory.find((i) => i.equippedSlot === "legs")!,
    wrist = s.inventory.find((i) => i.equippedSlot === "wrist")!;
  delete s.professionLevels;
  expect(validateItemEnhancements(s, legs, { gemIds: [42142] })).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "profession-rank-unknown" }),
    ]),
  );
  s.professionLevels = { [Profession.Jewelcrafting]: 349 };
  expect(
    validateItemEnhancements(s, legs, { gemIds: [42142] }).some(
      (d) => d.code === "profession-rank",
    ),
  ).toBe(true);
  s.professionLevels[Profession.Jewelcrafting] = 450;
  expect(validateItemEnhancements(s, legs, { gemIds: [42142] })).toEqual([]);
  s.settings.player!.profession2 = Profession.Blacksmithing;
  s.professionLevels[Profession.Blacksmithing] = 399;
  expect(
    validateItemEnhancements(s, wrist, { gemIds: [null, 40111] }).length,
  ).toBeGreaterThan(0);
  s.professionLevels[Profession.Blacksmithing] = 400;
  expect(validateItemEnhancements(s, wrist, { gemIds: [null, 40111] })).toEqual(
    [],
  );
});
it("requires engineering rank for manual tinkers but allows ordinary enchants without enchanting", () => {
  const { snapshot: s } = fixtureRequest(),
    hands = s.inventory.find((i) => i.equippedSlot === "hands")!,
    legs = s.inventory.find((i) => i.equippedSlot === "legs")!;
  s.professionLevels = { [Profession.Engineering]: 399 };
  expect(
    validateItemEnhancements(s, hands, { enchantId: 3604 }).some(
      (d) => d.code === "profession-rank",
    ),
  ).toBe(true);
  s.professionLevels[Profession.Engineering] = 400;
  expect(validateItemEnhancements(s, hands, { enchantId: 3604 })).toEqual([]);
  expect(validateItemEnhancements(s, legs, { enchantId: 3823 })).toEqual([]);
});
it("preserves the original native reference equipment with an enhancement-only candidate", () => {
  const { snapshot: s } = fixtureRequest(),
    legs = s.inventory.find((i) => i.equippedSlot === "legs")!;
  const original = simulationInput(s, s.equipped, 20, "1001", true).raid!
    .parties[0].players[0].equipment;
  s.itemEnhancements = {
    [legs.instanceId]: { gemIds: [40112, 0], enchantId: 0 },
  };
  expect(
    simulationInput(s, s.equipped, 20, "1001", true).raid!.parties[0].players[0]
      .equipment,
  ).toEqual(original);
  expect(
    simulationInput(s, s.equipped, 20, "1001").raid!.parties[0].players[0]
      .equipment,
  ).not.toEqual(original);
});

import { analyzeItemEnhancementSets, enumerateLoadouts } from "./enumerate";

it("reserves manual JC gems before repairing automatic ones and excludes only actual conflicting sets", () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  s.professionLevels = {
    [Profession.Jewelcrafting]: 450,
    [Profession.Engineering]: 450,
  };
  const legs = s.inventory.find((i) => i.equippedSlot === "legs")!,
    chest = s.inventory.find((i) => i.equippedSlot === "chest")!,
    belt = s.inventory.find((i) => i.equippedSlot === "waist")!;
  s.gemming = defaultGemming(s);
  s.itemEnhancements = {
    [legs.instanceId]: { gemIds: [42142, 42142] },
    [chest.instanceId]: { gemIds: [42142] },
  };
  const plan = prepareGems(s, s.equipped);
  const all = s.inventory.flatMap(
    (i) => plan.overrides[i.instanceId] ?? i.gemIds,
  );
  expect(all.filter((id) => id === 42142)).toHaveLength(3);
  expect(plan.overrides[legs.instanceId]).toEqual([42142, 42142]);
  s.itemEnhancements[belt.instanceId] = { gemIds: [42142] };
  request.selection.lockedSlots = { ...s.equipped, waist: undefined };
  delete request.selection.lockedSlots.waist;
  const replacement = {
    ...belt,
    instanceId: "replacement-belt",
    source: "bag" as const,
    equippedSlot: undefined,
    gemIds: [],
  };
  s.inventory.push(replacement);
  request.selection.selectedInstanceIds.push(replacement.instanceId);
  const analysis = analyzeItemEnhancementSets(s, request.selection);
  expect(analysis).toMatchObject({
    validCount: 1,
    excludedCount: 1,
    complete: true,
  });
  expect(analysis.conflicts[0].instanceIds).toEqual(
    expect.arrayContaining([
      legs.instanceId,
      chest.instanceId,
      belt.instanceId,
    ]),
  );
  expect([...enumerateLoadouts(s, request.selection)]).toHaveLength(1);
  expect(() => validateRequest(encodeRequest(request))).not.toThrow();
});
it("allows mutually exclusive unique gems in the pool and counts duplicate unique gems only within one set", () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  s.gemming = undefined;
  const legs = s.inventory.find((i) => i.equippedSlot === "legs")!,
    chest = s.inventory.find((i) => i.equippedSlot === "chest")!;
  s.itemEnhancements = {
    [legs.instanceId]: { gemIds: [49110, null] },
    [chest.instanceId]: { gemIds: [49110] },
  };
  const replacement = {
    ...chest,
    instanceId: "replacement-chest",
    source: "bag" as const,
    equippedSlot: undefined,
    gemIds: [],
  };
  s.inventory.push(replacement);
  request.selection.selectedInstanceIds.push(replacement.instanceId);
  request.selection.lockedSlots = { ...s.equipped };
  delete request.selection.lockedSlots.chest;
  expect(analyzeItemEnhancementSets(s, request.selection)).toMatchObject({
    validCount: 1,
    excludedCount: 1,
    complete: true,
  });
  expect(() => validateRequest(encodeRequest(request))).not.toThrow();
});
it("reports bounded analysis as incomplete instead of claiming exact counts", () => {
  const request = fixtureRequest();
  expect(
    analyzeItemEnhancementSets(request.snapshot, request.selection, 1).complete,
  ).toBe(false);
});
it("deduplicates physical copies by their resolved enhancements, not their unedited imported identity", () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  s.gemming = undefined;
  s.autoEnchant = false;
  const ring = s.inventory.find((i) => i.equippedSlot === "finger1")!;
  s.inventory.push({
    ...ring,
    instanceId: "extra-ring",
    source: "bag",
    equippedSlot: undefined,
  });
  s.itemEnhancements = { "extra-ring": { gemIds: [0] } };
  request.selection.selectedInstanceIds.push("extra-ring");
  request.selection.lockedSlots = { ...s.equipped };
  delete request.selection.lockedSlots.finger1;
  const analysis = analyzeItemEnhancementSets(s, request.selection);
  expect(analysis.validCount).toBe(2);
});

import { estimateAllowance } from "./enumerate";
it("budgets only valid candidate sets and the original reference when enhancements exclude combinations", () => {
  const request = fixtureRequest(),
    s = request.snapshot,
    legs = s.inventory.find((i) => i.equippedSlot === "legs")!,
    chest = s.inventory.find((i) => i.equippedSlot === "chest")!;
  s.gemming = undefined;
  s.itemEnhancements = {
    [legs.instanceId]: { gemIds: [49110, null] },
    [chest.instanceId]: { gemIds: [49110] },
  };
  const replacement = {
    ...chest,
    instanceId: "replacement-chest",
    source: "bag" as const,
    equippedSlot: undefined,
    gemIds: [],
  };
  s.inventory.push(replacement);
  request.selection.selectedInstanceIds.push(replacement.instanceId);
  request.selection.lockedSlots = { ...s.equipped };
  delete request.selection.lockedSlots.chest;
  const budget = { ...workPolicy(), maxUnits: 10000 };
  expect(estimateAllowance(s, request.selection, budget)).toMatchObject({
    allowed: true,
    count: 2,
    countKind: "exact",
  });
  expect(planRun(s, request.selection, budget).simulations).toHaveLength(2);
});
it("marks the run unavailable when all enhanced candidate sets are invalid even though the reference remains valid", () => {
  const request = fixtureRequest(),
    s = request.snapshot,
    legs = s.inventory.find((i) => i.equippedSlot === "legs")!,
    chest = s.inventory.find((i) => i.equippedSlot === "chest")!;
  s.itemEnhancements = {
    [legs.instanceId]: { gemIds: [49110, null] },
    [chest.instanceId]: { gemIds: [49110] },
  };
  expect(estimateAllowance(s, request.selection, workPolicy()).allowed).toBe(
    false,
  );
});

import { removeCustomItem } from "./custom-items";
it("removes the enhancement override when a custom candidate is deleted", () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  const item = {
    instanceId: "custom:51000",
    itemId: 51000,
    enchantId: 0,
    gemIds: [],
    source: "custom" as const,
  };
  s.inventory.push(item);
  request.selection.selectedInstanceIds.push(item.instanceId);
  s.itemEnhancements = { [item.instanceId]: { gemIds: [0] } };
  const next = removeCustomItem(request, item.instanceId);
  expect(next.snapshot.itemEnhancements?.[item.instanceId]).toBeUndefined();
  expect(() => validateRequest(encodeRequest(next))).not.toThrow();
});
it("uses wearer rank for engineering cloaks and Nitro Boosts instead of their crafting recipe rank", () => {
  const { snapshot: s } = fixtureRequest(),
    back = s.inventory.find((i) => i.equippedSlot === "back")!,
    feet = s.inventory.find((i) => i.equippedSlot === "feet")!;
  s.professionLevels = { [Profession.Engineering]: 350 };
  expect(validateItemEnhancements(s, back, { enchantId: 3605 })).toEqual([]);
  expect(validateItemEnhancements(s, back, { enchantId: 3859 })).toEqual([]);
  s.professionLevels[Profession.Engineering] = 400;
  expect(validateItemEnhancements(s, feet, { enchantId: 3606 })).toEqual([]);
});

it("keeps incomplete allowance estimates conservative when identical physical copies have different manual gems", () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  s.gemming = undefined;
  s.autoEnchant = false;
  const ring = s.inventory.find((item) => item.equippedSlot === "finger1")!;
  s.inventory.push({
    ...ring,
    instanceId: "extra-ring",
    source: "bag",
    equippedSlot: undefined,
  });
  s.itemEnhancements = { "extra-ring": { gemIds: [0] } };
  request.selection.selectedInstanceIds.push("extra-ring");
  request.selection.lockedSlots = { ...s.equipped };
  delete request.selection.lockedSlots.finger1;
  const estimated = estimateAllowance(s, request.selection, {
    ...workPolicy(),
    maxSearchNodes: 1,
  });
  expect(estimated.countKind).toBe("upper-bound");
  expect(estimated.count).toBeGreaterThanOrEqual(2);
});

it("keeps an existing override visible and analyzable after its profession rank becomes invalid", () => {
  const request = fixtureRequest(),
    s = request.snapshot,
    legs = s.inventory.find((item) => item.equippedSlot === "legs")!;
  s.gemming = defaultGemming(s);
  s.professionLevels = { [Profession.Jewelcrafting]: 349 };
  s.itemEnhancements = { [legs.instanceId]: { gemIds: [42142] } };
  expect(() => previewItemEnhancements(s, legs)).not.toThrow();
  expect(previewItemEnhancements(s, legs).gemIds[0]).toBe(42142);
  expect(analyzeItemEnhancementSets(s, request.selection)).toMatchObject({
    validCount: 0,
    complete: true,
  });
  expect(s.itemEnhancements[legs.instanceId].gemIds).toEqual([42142]);
  expect(() => validateRequest(encodeRequest(request))).toThrow(
    /Jewelcrafting/,
  );
});

it("suppresses an inactive meta consistently in reference and candidate input when automatic gemming is disabled", () => {
  const { snapshot: s } = fixtureRequest();
  s.gemming = undefined;
  s.autoEnchant = false;
  for (const item of s.inventory)
    item.gemIds = item.gemIds.map((id, index) =>
      item.equippedSlot === "head" && index === 0 ? 41285 : id ? 40111 : 0,
    );
  const legs = s.inventory.find((item) => item.equippedSlot === "legs")!;
  s.itemEnhancements = { [legs.instanceId]: { enchantId: 0 } };
  const reference = simulationInput(s, s.equipped, 20, "1001", true).raid!
    .parties[0].players[0].equipment!.items[0];
  const candidate = simulationInput(s, s.equipped, 20, "1001").raid!.parties[0]
    .players[0].equipment!.items[0];
  expect(reference.gems).toEqual([0, 40111]);
  expect(candidate.gems).toEqual(reference.gems);
  expect(
    s.inventory.find((item) => item.equippedSlot === "head")!.gemIds[0],
  ).toBe(41285);
});
