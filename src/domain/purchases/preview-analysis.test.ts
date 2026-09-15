import { expect, it } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import { getCatalog } from "@/domain/equipment/catalog";
import {
  analyzePurchaseSelection,
  createPurchasePreviewAnalyzer,
} from "./analysis";

it("finishes a large interactive count without bypassing the free run allowance", () => {
  const request = purchaseFixture({
    frost: 1000,
    "mark:normal:vanquisher": 5,
    "mark:heroic:vanquisher": 5,
  });
  for (const type of [2, 6]) {
    for (const item of [...getCatalog("original").items.values()]
      .filter(
        (item) =>
          item.type === type &&
          item.ilvl >= 200 &&
          item.classAllowlist.length === 0,
      )
      .slice(0, 6)) {
      const instanceId = `extra-${item.id}`;
      request.snapshot.inventory.push({
        instanceId,
        itemId: item.id,
        source: "bag",
        gemIds: [],
        enchantId: 0,
      });
      request.selection.selectedInstanceIds.push(instanceId);
    }
  }
  const policy = {
    ...purchasePolicy,
    maxUnits: 120 * purchasePolicy.unitsPerSet,
  };
  expect(analyzePurchaseSelection(request, policy).status).toBe("search-limit");
  const result = createPurchasePreviewAnalyzer()(request, policy);
  expect(result).toMatchObject({
    status: "over-limit",
    allowance: { count: 50176, countKind: "exact", allowed: false },
  });
}, 15000);
