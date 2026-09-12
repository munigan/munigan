import { it, expect } from "vitest";
import { decodeDraft, encodeRequest, validateRequest } from "./request-schema";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { Profession } from "@/generated/wotlk/common";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import { describeError } from "@/i18n/error";
import { localizeDiagnostic } from "@/i18n/diagnostics";
import { createTranslator } from "next-intl";
import portugueseDiagnostics from "../../../messages/pt-BR/diagnostics.json";
import {
  isGeneratedPurchaseId,
  purchaseInstanceId,
} from "@/domain/purchases/schema";

const portuguese = createTranslator<Record<string, string>>({
  locale: "pt-BR",
  messages: portugueseDiagnostics,
});

it("accepts crafting professions below 450 without changing their imported ranks", () => {
  const request = fixtureRequest();
  request.snapshot.professionLevels = {
    [Profession.Engineering]: 425,
    [Profession.Jewelcrafting]: 400,
  };
  const admitted = validateRequest(encodeRequest(request));
  expect(admitted.snapshot.professionLevels).toEqual(
    request.snapshot.professionLevels,
  );
  expect(admitted.snapshot.settings.player?.profession1).toBe(
    Profession.Engineering,
  );
  expect(admitted.snapshot.inventory).toEqual(request.snapshot.inventory);
});

it("identifies a gathering bonus that still depends on maximum skill", () => {
  const request = fixtureRequest();
  request.snapshot.settings.player!.profession2 = Profession.Skinning;
  request.snapshot.professionLevels = { [Profession.Skinning]: 375 };
  expect(() => validateRequest(encodeRequest(request))).toThrow(
    /Skinning.*40 critical strike/i,
  );
});
it("round trips protobuf settings and rejects forged inventory references", () => {
  const r = fixtureRequest();
  expect(validateRequest(encodeRequest(r)).snapshot.equipped).toEqual(
    r.snapshot.equipped,
  );
  const forged = encodeRequest(r);
  forged.selection.selectedInstanceIds.push("not-owned");
  expect(() => validateRequest(forged)).toThrow(/owned|instance/);
});
it("requires unsupported bag exclusions and blocks a custom mechanics database", () => {
  const r = fixtureRequest();
  r.snapshot.inventory.push({
    instanceId: "junk",
    itemId: 9999999,
    enchantId: 0,
    gemIds: [],
    source: "bag",
  });
  expect(() => validateRequest(encodeRequest(r))).toThrow(/exclu/i);
  r.selection.acknowledgedExclusions = ["junk"];
  expect(() => validateRequest(encodeRequest(r))).not.toThrow();
  r.snapshot.settings.player!.database = { items: [], enchants: [], gems: [] };
  expect(() => validateRequest(encodeRequest(r))).toThrow(/database/i);
});

it.each([-1, 1.5, 1_000_001, Infinity])(
  "rejects invalid purchase quantity %s",
  (quantity) => {
    const wire = encodeRequest(purchaseFixture({ frost: quantity }));
    expect(() => validateRequest(wire)).toThrow();
  },
);

it("keeps legacy requests purchase-free and normalizes an empty wallet away", () => {
  const legacy = encodeRequest(fixtureRequest());
  expect(legacy).not.toHaveProperty("purchases");

  const empty = encodeRequest(purchaseFixture());
  expect(decodeDraft(empty)).not.toHaveProperty("purchases");
  expect(encodeRequest(decodeDraft(empty))).not.toHaveProperty("purchases");

  const zero = encodeRequest(purchaseFixture({ frost: 0 }));
  expect(decodeDraft(zero).purchases?.balances.frost).toBe(0);
});

it("rejects unknown resource names and client-authoritative purchase fields", () => {
  for (const extra of [
    { spent: { frost: 1 } },
    { price: 20 },
    { plan: { steps: [] } },
  ]) {
    const wire = encodeRequest(purchaseFixture({ frost: 1 }));
    Object.assign(wire.purchases!, extra);
    expect(() => decodeDraft(wire)).toThrow();
  }
  const wire = encodeRequest(purchaseFixture({ frost: 1 }));
  Object.assign(wire.purchases!.balances, { justice: 10 });
  expect(() => decodeDraft(wire)).toThrow();
});

it("bounds purchase collections by distinct exclusions and override entries", () => {
  const exclusions = Array.from({ length: 1_001 }, (_, index) => index + 1);
  const overrides = Object.fromEntries(
    exclusions.map((itemId) => [String(itemId), { enchantId: 0 }]),
  );
  const excludedWire = encodeRequest(purchaseFixture({ frost: 1 }));
  excludedWire.purchases!.recipeRevision = "stale";
  excludedWire.purchases!.excludedItemIds = { original: exclusions };
  expect(() => decodeDraft(excludedWire)).toThrow();

  const overrideWire = encodeRequest(purchaseFixture({ frost: 1 }));
  overrideWire.purchases!.recipeRevision = "stale";
  overrideWire.purchases!.itemEnhancements = { original: overrides };
  expect(() => decodeDraft(overrideWire)).toThrow();

  const repeatedWire = encodeRequest(purchaseFixture({ frost: 1 }));
  repeatedWire.purchases!.recipeRevision = "stale";
  repeatedWire.purchases!.excludedItemIds = {
    original: Array.from({ length: 1_001 }, () => 47748),
  };
  expect(decodeDraft(repeatedWire).purchases?.excludedItemIds.original).toEqual(
    [47748],
  );
});

it.each(["0", "01", "-1", "1.5", "10000001"])(
  "rejects non-canonical purchase override item ID %s",
  (itemId) => {
    const wire = encodeRequest(purchaseFixture({ frost: 1 }));
    wire.purchases!.itemEnhancements = {
      original: { [itemId]: { enchantId: 0 } },
    };
    expect(() => decodeDraft(wire)).toThrow();
  },
);

it("applies the existing strict enhancement shape to purchase overrides", () => {
  const wire = encodeRequest(purchaseFixture({ frost: 1 }));
  wire.purchases!.itemEnhancements = {
    original: {
      "47748": { gemIds: [1, 2, 3, 4, 5] },
    },
  };
  expect(() => decodeDraft(wire)).toThrow();

  wire.purchases!.itemEnhancements = {
    original: {
      "47748": { enchantId: 0, price: 1 } as { enchantId: number },
    },
  };
  expect(() => decodeDraft(wire)).toThrow();
});

it("retains structurally valid retired IDs in stale drafts but rejects forged current submissions", () => {
  const retiredId = 9_999_999;
  const stale = encodeRequest(purchaseFixture({ frost: 1 }));
  stale.purchases!.recipeRevision = "retired-revision";
  stale.purchases!.excludedItemIds = { original: [retiredId] };
  stale.purchases!.itemEnhancements = {
    original: { [retiredId]: { gemIds: [null] } },
  };
  expect(decodeDraft(stale).purchases?.excludedItemIds.original).toEqual([
    retiredId,
  ]);

  const current = structuredClone(stale);
  current.purchases!.recipeRevision = getPurchaseCatalog("original").revision;
  expect(() => validateRequest(current)).toThrow(/purchase item/i);
});

it("reports stale purchase catalogs with a localized diagnostic identity", () => {
  const wire = encodeRequest(purchaseFixture({ frost: 1 }));
  wire.purchases!.recipeRevision = "retired-revision";
  try {
    validateRequest(wire);
    expect.unreachable("stale purchase catalog was accepted");
  } catch (error) {
    expect(describeError(error)).toMatchObject({
      code: "purchaseCatalogChanged",
      message: expect.stringMatching(/catalog changed/i),
    });
    expect(localizeDiagnostic(error, portuguese)).toBe(
      portugueseDiagnostics.purchaseCatalogChanged,
    );
  }
});

it.each(
  ["purchase-original-51125", "purchase-classic-51125"].flatMap(
    (generatedId) =>
      ["inventory", "selected", "equipped", "locked", "override"].map(
        (reference) => [generatedId, reference] as const,
      ),
  ),
)(
  "rejects generated ID %s in submitted %s references",
  (generatedId, reference) => {
    const request = purchaseFixture({ frost: 1 });
    if (reference === "inventory") {
      request.snapshot.inventory[0].instanceId = generatedId;
      request.snapshot.equipped.legs = generatedId;
      request.selection.selectedInstanceIds = [generatedId];
    } else if (reference === "selected") {
      request.selection.selectedInstanceIds.push(generatedId);
    } else if (reference === "equipped") {
      request.snapshot.equipped.head = generatedId;
    } else if (reference === "locked") {
      request.selection.lockedSlots.head = generatedId;
    } else {
      request.snapshot.itemEnhancements = { [generatedId]: {} };
    }
    expect(() => validateRequest(encodeRequest(request))).toThrow(/generated/i);
  },
);

it.each(["purchase-original-51125", "purchase-classic-51125"])(
  "recognizes canonical generated purchase ID %s",
  (generatedId) => {
    expect(isGeneratedPurchaseId(generatedId)).toBe(true);
  },
);

it.each([
  ["original", "purchase-original-51125"],
  ["classic", "purchase-classic-51125"],
] as const)("constructs the canonical %s purchase ID", (profile, expected) => {
  expect(purchaseInstanceId(profile, 51125)).toBe(expected);
});

it("rejects purchase-source inventory at the incoming request boundary", () => {
  const wire = encodeRequest(purchaseFixture({ frost: 1 }));
  wire.snapshot.inventory[0].source = "purchase" as "bag";
  expect(() => decodeDraft(wire)).toThrow();
});
