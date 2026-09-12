import { expect, it } from "vitest";
import { fixtureRequest } from "../support/fixtures";
import { purchasePolicy } from "../support/purchase-fixtures";
import { getCatalog } from "@/domain/equipment/catalog";
import { defaultGemming } from "@/domain/equipment/gemming";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { analyzePurchaseSelection } from "@/domain/purchases/analysis";
import { hydratePurchaseSnapshot } from "@/domain/purchases/frozen";
import { purchaseInstanceId } from "@/domain/purchases/schema";
import { itemVersions, type ItemVersion } from "@/domain/top-gear/item-version";
import {
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import { simulationInput, evaluate } from "@/server/simulator/evaluate";

it.each<ItemVersion>(["original", "classic"])(
  "hydrates final upgraded gear and crosses the native two-piece threshold in %s",
  async (profile) => {
    const request = fixtureRequest();
    request.snapshot.itemVersion = profile;
    request.snapshot.itemDataRevision = itemVersions[profile].revision;
    const catalog = getPurchaseCatalog(profile);
    const recipe = (slot: string, level: number) =>
      catalog.recipes.find(
        (r) =>
          r.classId === request.snapshot.settings.player!.class &&
          r.setVariant === "warrior-dps" &&
          r.tier === 10 &&
          r.slot === slot &&
          r.itemLevel === level,
      )!;
    const base = recipe("shoulder", 251);
    const normal = recipe("shoulder", 264);
    const final = recipe("shoulder", 277);
    const hands = request.snapshot.inventory.find(
      (i) => i.equippedSlot === "hands",
    )!;
    hands.itemId = recipe("hands", 251).itemId;
    hands.gemIds = [];
    hands.enchantId = 0;
    request.snapshot.autoEnchant = true;
    request.snapshot.gemming = defaultGemming(request.snapshot);
    request.purchases = {
      version: 1,
      recipeRevision: catalog.revision,
      balances: {
        frost: 60,
        "mark:normal:protector": 1,
        "mark:heroic:protector": 1,
      },
      excludedItemIds: {},
      itemEnhancements: {
        [profile]: { [final.itemId]: { enchantId: 3808, gemIds: [40111] } },
      },
    };
    const admitted = validateRequest(encodeRequest(request));
    const before = encodeRequest(admitted);
    const analysis = analyzePurchaseSelection(admitted, purchasePolicy);
    expect(analysis.status).toBe("complete");
    if (analysis.status !== "complete") throw new Error(analysis.status);
    const frozen = analysis.plan.purchases!;
    const finalId = purchaseInstanceId(profile, final.itemId);
    const candidate = analysis.plan.simulations.find(
      (s) => s.loadout.shoulder === finalId,
    )!;
    expect(candidate).toBeDefined();
    const acquisition = frozen.plansByLoadoutKey[candidate.key];
    expect(acquisition.steps.map((s) => s.itemId)).toEqual([
      base.itemId,
      normal.itemId,
      final.itemId,
    ]);
    expect(acquisition.spent).toEqual(request.purchases.balances);
    const snapshot = hydratePurchaseSnapshot(admitted.snapshot, frozen);
    const input = simulationInput(snapshot, candidate.loadout, 20, "12345");
    const equipment = input.raid!.parties[0].players[0].equipment!.items;
    expect(equipment.map((i) => i.id)).toContain(final.itemId);
    expect(equipment.map((i) => i.id)).not.toContain(base.itemId);
    expect(equipment.map((i) => i.id)).not.toContain(normal.itemId);
    expect(equipment.find((i) => i.id === final.itemId)).toMatchObject({
      enchant: 3808,
      gems: [40111],
    });
    const itemCatalog = getCatalog(profile);
    const setName = itemCatalog.items.get(final.itemId)!.setName;
    expect(setName).toBe("Ymirjar Lord's Battlegear");
    const pieces = (ids: number[]) =>
      ids.filter((id) => itemCatalog.items.get(id)?.setName === setName).length;
    expect(pieces(admitted.snapshot.inventory.map((i) => i.itemId))).toBe(1);
    expect(pieces(equipment.map((i) => i.id))).toBe(2);

    // Equivalent ordinary gear must produce exactly the same native input. The
    // simulator, not purchase code, owns the set-bonus implementation.
    const ordinary = structuredClone(admitted.snapshot);
    const shoulder = ordinary.inventory.find(
      (i) => i.equippedSlot === "shoulder",
    )!;
    shoulder.itemId = final.itemId;
    shoulder.gemIds = [];
    shoulder.enchantId = 0;
    ordinary.itemEnhancements = {
      [shoulder.instanceId]: { enchantId: 3808, gemIds: [40111] },
    };
    expect(simulationInput(ordinary, ordinary.equipped, 20, "12345")).toEqual(
      input,
    );
    const result = await evaluate(
      snapshot,
      candidate.loadout,
      20,
      "12345",
      new AbortController().signal,
    );
    expect(Number.isFinite(result.metric.mean)).toBe(true);
    expect(result.metric.mean).toBeGreaterThan(0);
    expect(result.stats.length).toBeGreaterThan(30);
    expect(result.stats.every(Number.isFinite)).toBe(true);
    expect(encodeRequest(admitted)).toEqual(before);
  },
);
