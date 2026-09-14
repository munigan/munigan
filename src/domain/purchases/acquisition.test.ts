import { describe, expect, it } from "vitest";
import { purchaseFixture } from "../../../tests/support/purchase-fixtures";
import { preparePurchases } from "./candidates";
import { comparePurchasePlans, solveAcquisition } from "./acquisition";
import {
  createSearchBudget,
  SearchLimitError,
} from "@/domain/equipment/search-budget";
import { purchaseInstanceId } from "./schema";
import { encodeRequest } from "@/domain/top-gear/request-schema";
import type { ItemVersion } from "@/domain/top-gear/item-version";
import type { ItemInstance, TopGearRequest } from "@/domain/top-gear/model";

function own(
  request: TopGearRequest,
  itemId: number,
  instanceId = "base",
  source: ItemInstance["source"] = "bag",
) {
  request.snapshot.inventory.push({
    instanceId,
    itemId,
    source,
    gemIds: [40111],
    enchantId: 3808,
  });
}
for (const profile of ["original", "classic"] satisfies ItemVersion[])
  describe(profile, () => {
    function prepare(request: TopGearRequest) {
      request.snapshot.itemVersion = profile;
      const budget = createSearchBudget(100000);
      return { prepared: preparePurchases(request, budget), budget };
    }
    it("charges a purchased base and normal upgrade together without changing the input", () => {
      const request = purchaseFixture({
        frost: 60,
        "mark:normal:vanquisher": 1,
      });
      request.snapshot.itemVersion = profile;
      const before = encodeRequest(request);
      const { prepared, budget } = prepare(request);
      const plan = solveAcquisition(
        prepared,
        {
          ...prepared.snapshot.equipped,
          shoulder: purchaseInstanceId(profile, 51125),
        },
        budget,
      );
      expect(plan?.steps.map((s) => s.itemId)).toEqual([50098, 51125]);
      expect(plan?.spent).toEqual({ frost: 60, "mark:normal:vanquisher": 1 });
      expect(plan?.remaining).toEqual({
        frost: 0,
        "mark:normal:vanquisher": 0,
      });
      expect(plan?.steps[1].prerequisite?.stepId).toBe(plan?.steps[0].resultId);
      expect(encodeRequest(request)).toEqual(before);
    });
    it.each(["bag", "equipped"] as const)(
      "consumes unchecked imported %s prerequisites, without transferring enhancements",
      (source) => {
        const request = purchaseFixture({ "mark:normal:vanquisher": 1 });
        own(request, 50098, "base", source);
        const { prepared, budget } = prepare(request);
        const plan = solveAcquisition(
          prepared,
          {
            ...prepared.snapshot.equipped,
            shoulder: purchaseInstanceId(profile, 51125),
          },
          budget,
        );
        expect(plan?.spent).toEqual({ "mark:normal:vanquisher": 1 });
        expect(plan?.consumedInstanceIds).toEqual(["base"]);
        expect(plan?.steps[0].prerequisite).toEqual({
          itemId: 50098,
          instanceId: "base",
        });
        expect(
          prepared.candidates.find((c) => c.instance.itemId === 51125)
            ?.instance,
        ).toMatchObject({ gemIds: [], enchantId: 0 });
      },
    );
    it("upgrades an owned 264 directly with a heroic Mark and no lower-tier resources", () => {
      const request = purchaseFixture({ "mark:heroic:vanquisher": 1 });
      own(request, 51125, "normal-owned");
      const { prepared, budget } = prepare(request);
      const plan = solveAcquisition(
        prepared,
        {
          ...prepared.snapshot.equipped,
          shoulder: purchaseInstanceId(profile, 51314),
        },
        budget,
      );
      expect(plan?.steps.map((step) => step.itemId)).toEqual([51314]);
      expect(plan?.spent).toEqual({ "mark:heroic:vanquisher": 1 });
      expect(plan?.consumedInstanceIds).toEqual(["normal-owned"]);
    });
    it("charges all three stages and never forces unused balances to be spent", () => {
      const { prepared, budget } = prepare(
        purchaseFixture({
          frost: 100,
          "mark:normal:vanquisher": 1,
          "mark:heroic:vanquisher": 1,
          triumph: 0,
        }),
      );
      const plan = solveAcquisition(
        prepared,
        {
          ...prepared.snapshot.equipped,
          shoulder: purchaseInstanceId(profile, 51314),
        },
        budget,
      );
      expect(plan?.steps.map((s) => s.itemId)).toEqual([50098, 51125, 51314]);
      expect(plan?.remaining).toEqual({
        frost: 40,
        "mark:normal:vanquisher": 0,
        "mark:heroic:vanquisher": 0,
        triumph: 0,
      });
      expect(
        solveAcquisition(prepared, prepared.snapshot.equipped, budget),
      ).toEqual({
        steps: [],
        spent: {},
        remaining: prepared.inputs.balances,
        consumedInstanceIds: [],
      });
    });
    it("enforces combined Frost and Regalia balances on simultaneous final pieces", () => {
      for (const [balances, shoulder, hands, affordable] of [
        [{ frost: 120 }, 50098, 50095, true],
        [{ frost: 119 }, 50098, 50095, false],
        [{ "regalia:vanquisher": 1 }, 48495, 48492, false],
      ] as const) {
        const { prepared, budget } = prepare(purchaseFixture(balances));
        const plan = solveAcquisition(
          prepared,
          {
            ...prepared.snapshot.equipped,
            shoulder: purchaseInstanceId(profile, shoulder),
            hands: purchaseInstanceId(profile, hands),
          },
          budget,
        );
        expect(plan !== null).toBe(affordable);
      }
    });
    it("shares a tight Triumph balance across 232 and 245 and redeems multiple tokens directly", () => {
      for (const [triumph, affordable] of [
        [75, true],
        [74, false],
      ] as const) {
        const { prepared, budget } = prepare(
          purchaseFixture({ triumph, trophy: 1 }),
        );
        const recipes = prepared.catalog.recipes.filter(
          (r) => r.setVariant === "dk-dps" && r.faction === "horde",
        );
        const shoulder = recipes.find(
          (r) => r.slot === "shoulder" && r.itemLevel === 232,
        )!;
        const hands = recipes.find(
          (r) => r.slot === "hands" && r.itemLevel === 245,
        )!;
        const plan = solveAcquisition(
          prepared,
          {
            ...prepared.snapshot.equipped,
            shoulder: purchaseInstanceId(profile, shoulder.itemId),
            hands: purchaseInstanceId(profile, hands.itemId),
          },
          budget,
        );
        expect(plan !== null).toBe(affordable);
        if (plan) {
          expect(plan.spent).toEqual({ triumph: 75, trophy: 1 });
          expect(plan.remaining).toEqual({ triumph: 0, trophy: 0 });
          expect(plan.steps).toHaveLength(2);
          expect(plan.steps.every((step) => !step.prerequisite)).toBe(true);
        }
      }
      const { prepared, budget } = prepare(
        purchaseFixture({ "regalia:vanquisher": 2 }),
      );
      const plan = solveAcquisition(
        prepared,
        {
          ...prepared.snapshot.equipped,
          shoulder: purchaseInstanceId(profile, 48495),
          hands: purchaseInstanceId(profile, 48492),
        },
        budget,
      )!;
      expect(plan.spent).toEqual({ "regalia:vanquisher": 2 });
      expect(plan.remaining).toEqual({ "regalia:vanquisher": 0 });
      expect(plan.steps.map((step) => step.itemId).sort()).toEqual([
        48492, 48495,
      ]);
      expect(plan.steps.every((step) => !step.prerequisite)).toBe(true);
      expect(plan.consumedInstanceIds).toEqual([]);
    });
    it("rejects custom and other-variant prerequisites", () => {
      for (const [itemId, source] of [
        [50098, "custom"],
        [50853, "bag"],
      ] as const) {
        const request = purchaseFixture({ "mark:normal:vanquisher": 1 });
        own(request, itemId, "base", source);
        const { prepared, budget } = prepare(request);
        expect(
          solveAcquisition(
            prepared,
            {
              ...prepared.snapshot.equipped,
              shoulder: purchaseInstanceId(profile, 51125),
            },
            budget,
          ),
        ).toBeNull();
      }
    });
    it("retains distinct ownership paths and chooses an affordable deterministic explanation", () => {
      const request = purchaseFixture({
        frost: 60,
        "mark:normal:vanquisher": 1,
      });
      own(request, 50098, "z-copy");
      own(request, 50098, "a-copy");
      const { prepared, budget } = prepare(request);
      const candidate = prepared.candidates.find(
        (c) => c.instance.itemId === 51125,
      )!;
      expect(candidate.paths.map((p) => p.consumedInstanceIds)).toEqual(
        expect.arrayContaining([["a-copy"], ["z-copy"], []]),
      );
      const loadout = {
        ...prepared.snapshot.equipped,
        shoulder: candidate.instance.instanceId,
      };
      expect(
        solveAcquisition(prepared, loadout, budget)?.consumedInstanceIds,
      ).toEqual(["a-copy"]);
      // Even malformed intermediate callers cannot consume a reserved physical ID.
      loadout.head = "a-copy";
      expect(
        solveAcquisition(prepared, loadout, budget)?.consumedInstanceIds,
      ).toEqual(["z-copy"]);
      loadout.chest = "z-copy";
      expect(solveAcquisition(prepared, loadout, budget)?.spent.frost).toBe(60);
    });
    it("never reuses one physical prerequisite across final rewards", () => {
      const request = purchaseFixture({ "mark:normal:vanquisher": 2 });
      own(request, 50098);
      const { prepared, budget } = prepare(request);
      // A synthetic same-predecessor DAG isolates ownership accounting from slot legality.
      const second = {
        ...prepared.catalog.byItemId.get(51128)!,
        prerequisiteItemId: 50098,
      };
      prepared.catalog = {
        ...prepared.catalog,
        byItemId: new Map([...prepared.catalog.byItemId, [51128, second]]),
      };
      // With the synthetic DAG, both rewards are individually obtainable from base.
      prepared.candidates.find((c) => c.instance.itemId === 51128)!.available =
        true;
      expect(
        solveAcquisition(
          prepared,
          {
            ...prepared.snapshot.equipped,
            shoulder: purchaseInstanceId(profile, 51125),
            hands: purchaseInstanceId(profile, 51128),
          },
          budget,
        ),
      ).toBeNull();
    });
  });
it("uses the shared budget in preparation and solving", () => {
  expect(() =>
    preparePurchases(purchaseFixture({ frost: 100 }), createSearchBudget(1)),
  ).toThrow(SearchLimitError);
  const budget = createSearchBudget(100000);
  const prepared = preparePurchases(purchaseFixture({ frost: 100 }), budget);
  expect(() =>
    solveAcquisition(
      prepared,
      {
        ...prepared.snapshot.equipped,
        shoulder: purchaseInstanceId("original", 50098),
      },
      createSearchBudget(0),
    ),
  ).toThrow(SearchLimitError);
});
it("orders equivalent explanations by resource preservation then stable ownership", () => {
  const plan = (spent: object, consumedInstanceIds: string[] = []) => ({
    steps: [],
    spent,
    remaining: {},
    consumedInstanceIds,
  });
  expect(
    comparePurchasePlans(plan({ frost: 60 }), plan({ frost: 95 })),
  ).toBeLessThan(0);
  expect(
    comparePurchasePlans(
      plan({ frost: 95 }),
      plan({ "mark:heroic:vanquisher": 1 }),
    ),
  ).toBeLessThan(0);
  expect(comparePurchasePlans(plan({}, ["a"]), plan({}, ["z"]))).toBeLessThan(
    0,
  );
});
