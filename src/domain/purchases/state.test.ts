import { describe, expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { getPurchaseCatalog } from "./catalog";
import {
  removeResource,
  revalidatePurchaseInputs,
  setPurchaseExcluded,
  setResourceBalance,
} from "./state";
import {
  decodeDraft,
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import type { ResourceId } from "./model";

describe("purchase input state", () => {
  it("replaces a balance immutably and preserves purchase inputs through a draft", () => {
    const request = purchaseFixture({ frost: 100 });
    const edited = setResourceBalance(request, "frost", 60);

    expect(edited.purchases?.balances.frost).toBe(60);
    expect(request.purchases?.balances.frost).toBe(100);
    expect(decodeDraft(encodeRequest(edited)).purchases).toEqual(
      edited.purchases,
    );
  });

  it("keeps an explicitly saved zero balance but removes the final resource", () => {
    const legacy = purchaseFixture();
    delete legacy.purchases;

    const enabled = setResourceBalance(legacy, "frost", 0);
    expect(enabled.purchases?.balances).toEqual({ frost: 0 });
    expect(validateRequest(encodeRequest(enabled)).purchases?.balances).toEqual(
      {
        frost: 0,
      },
    );
    expect(removeResource(enabled, "frost")).not.toHaveProperty("purchases");
    expect(enabled.purchases?.balances).toEqual({ frost: 0 });
  });

  it.each([-1, 1.5, 1_000_001, Infinity])(
    "rejects an invalid state quantity %s",
    (quantity) => {
      expect(() =>
        setResourceBalance(purchaseFixture(), "frost", quantity),
      ).toThrow(/quantity/i);
    },
  );

  it("rejects resource names outside the twelve supported wallet families", () => {
    expect(() =>
      setResourceBalance(purchaseFixture(), "justice" as ResourceId, 1),
    ).toThrow(/resource/i);
  });

  it("stores sorted exclusions separately for each item profile", () => {
    const originalIds = [...getPurchaseCatalog("original").byItemId.keys()];
    const classicId = [...getPurchaseCatalog("classic").byItemId.keys()][2];
    const request = purchaseFixture({ frost: 1 });
    const first = setPurchaseExcluded(request, originalIds[3], true);
    const second = setPurchaseExcluded(first, originalIds[1], true);
    const duplicate = setPurchaseExcluded(second, originalIds[3], true);
    const classic = setPurchaseExcluded(
      {
        ...duplicate,
        snapshot: { ...duplicate.snapshot, itemVersion: "classic" },
      },
      classicId,
      true,
    );

    expect(classic.purchases?.balances).toEqual({ frost: 1 });
    expect(classic.purchases?.excludedItemIds.original).toEqual(
      [originalIds[1], originalIds[3]].sort((a, b) => a - b),
    );
    expect(classic.purchases?.excludedItemIds.classic).toEqual([classicId]);
    expect(request.purchases?.excludedItemIds).toEqual({});

    const restored = setPurchaseExcluded(
      {
        ...classic,
        snapshot: { ...classic.snapshot, itemVersion: "original" },
      },
      originalIds[1],
      false,
    );
    expect(restored.purchases?.excludedItemIds.original).toEqual([
      originalIds[3],
    ]);
    expect(restored.purchases?.excludedItemIds.classic).toEqual([classicId]);
  });

  it("retains stale draft IDs until explicit revalidation removes them", () => {
    const request = purchaseFixture({ frost: 20 });
    const validId = [...getPurchaseCatalog("original").byItemId.keys()][0];
    request.purchases = {
      ...request.purchases!,
      recipeRevision: "retired-recipe-revision",
      excludedItemIds: { original: [9_999_998, validId, 9_999_998] },
      itemEnhancements: {
        original: {
          [validId]: { enchantId: 0 },
          "9999999": { gemIds: [null] },
        },
      },
    };

    const restored = decodeDraft(encodeRequest(request));
    expect(restored.purchases?.recipeRevision).toBe("retired-recipe-revision");
    expect(restored.purchases?.excludedItemIds.original).toContain(9_999_998);
    expect(() => validateRequest(encodeRequest(restored))).toThrow(
      /catalog changed/i,
    );

    const reconciled = revalidatePurchaseInputs(restored);
    expect(restored.purchases?.recipeRevision).toBe("retired-recipe-revision");
    expect(reconciled.removedItemIds).toEqual([9_999_998, 9_999_999]);
    expect(reconciled.request.purchases?.recipeRevision).toBe(
      getPurchaseCatalog("original").revision,
    );
    expect(reconciled.request.purchases?.excludedItemIds.original).toEqual([
      validId,
    ]);
    expect(reconciled.request.purchases?.itemEnhancements.original).toEqual({
      [validId]: { enchantId: 0 },
    });
    expect(() =>
      validateRequest(encodeRequest(reconciled.request)),
    ).not.toThrow();
  });
});
