import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SetRow, TopGearReport } from "@/domain/top-gear/model";
import { ItemVersionContext } from "@/features/inventory/ItemVersionContext";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import commonEn from "../../../messages/en-US/common.json";
import commonPt from "../../../messages/pt-BR/common.json";
import inventoryEn from "../../../messages/en-US/inventory.json";
import inventoryPt from "../../../messages/pt-BR/inventory.json";
import reportsEn from "../../../messages/en-US/reports.json";
import reportsPt from "../../../messages/pt-BR/reports.json";
import { PurchasePlanPanel } from "./PurchasePlanPanel";

const purchased = (itemId: number) => ({
  instanceId: `purchase-original-${itemId}`,
  itemId,
  source: "purchase" as const,
  gemIds: [],
  enchantId: 0,
});

function purchaseReport(): { report: TopGearReport; row: SetRow } {
  const request = purchaseFixture({
    frost: 100,
    "mark:normal:vanquisher": 1,
    "regalia:vanquisher": 1,
  });
  request.snapshot.inventory.push({
    instanceId: "owned-base-shoulders",
    itemId: 50098,
    source: "bag",
    gemIds: [],
    enchantId: 0,
  });
  request.selection.selectedInstanceIds.push("owned-base-shoulders");
  const snapshot = structuredClone(request.snapshot);
  snapshot.inventory.push(purchased(48493), purchased(50098), purchased(51125));
  const row: SetRow = {
    id: "purchase-row",
    loadout: {
      ...snapshot.equipped,
      head: "purchase-original-48493",
      shoulder: "purchase-original-51125",
    },
    purchasePlan: {
      steps: [
        {
          recipeId: "t9-head-258",
          itemId: 48493,
          resultId: "purchase-original-48493",
          cost: { "regalia:vanquisher": 1 },
        },
        {
          recipeId: "t10-shoulder-251",
          itemId: 50098,
          resultId: "purchase-original-51125:prerequisite-50098",
          cost: { frost: 60 },
        },
        {
          recipeId: "t10-shoulder-264",
          itemId: 51125,
          resultId: "purchase-original-51125",
          prerequisite: {
            itemId: 50098,
            stepId: "purchase-original-51125:prerequisite-50098",
          },
          cost: { "mark:normal:vanquisher": 1 },
        },
      ],
      spent: {
        frost: 60,
        "mark:normal:vanquisher": 1,
        "regalia:vanquisher": 1,
      },
      remaining: {
        frost: 40,
        "mark:normal:vanquisher": 0,
        "regalia:vanquisher": 0,
      },
      consumedInstanceIds: [],
    },
    dps: 10200,
    gain: 200,
    percent: 2,
    swaps: 2,
    eligible: true,
    isEquipped: false,
    tiedToHighest: true,
    iterations: 1000,
    inputHash: "purchase-row",
  };
  const report: TopGearReport = {
    token: "purchase-report",
    status: "complete",
    phase: "complete",
    snapshot,
    selection: request.selection,
    purchases: {
      inputs: request.purchases!,
      recipeRevision: request.purchases!.recipeRevision,
      originalSnapshot: request.snapshot,
      recipes: [
        {
          id: "t9-head-258",
          itemId: 48493,
          tier: 9,
          itemLevel: 258,
          setVariant: "dk-dps",
          slot: "head",
          classId: 10,
          faction: "horde",
          profiles: ["original", "classic"],
          cost: { "regalia:vanquisher": 1 },
          sourceUrls: [],
        },
        {
          id: "t10-shoulder-251",
          itemId: 50098,
          tier: 10,
          itemLevel: 251,
          setVariant: "dk-dps",
          slot: "shoulder",
          classId: 10,
          faction: "both",
          profiles: ["original", "classic"],
          cost: { frost: 60 },
          sourceUrls: [],
        },
        {
          id: "t10-shoulder-264",
          itemId: 51125,
          tier: 10,
          itemLevel: 264,
          setVariant: "dk-dps",
          slot: "shoulder",
          classId: 10,
          faction: "both",
          profiles: ["original", "classic"],
          cost: { "mark:normal:vanquisher": 1 },
          prerequisiteItemId: 50098,
          sourceUrls: [],
        },
      ],
    },
    policy: purchasePolicy,
    rows: [row],
    equippedId: "baseline",
    highestId: row.id,
    recommendedId: row.id,
    coverage: {
      planned: 2,
      succeeded: 2,
      failed: 0,
      returned: 2,
      exhaustive: true,
    },
    termination: "complete",
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
  return { report, row };
}

function view(
  report: TopGearReport,
  row: SetRow,
  locale: "en-US" | "pt-BR" = "en-US",
) {
  const english = locale === "en-US";
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{
        common: english ? commonEn : commonPt,
        inventory: english ? inventoryEn : inventoryPt,
        reports: english ? reportsEn : reportsPt,
      }}
    >
      <ItemVersionContext.Provider value="original">
        <PurchasePlanPanel report={report} row={row} />
      </ItemVersionContext.Provider>
    </NextIntlClientProvider>
  );
}

it("shows final rewards, ordered prerequisite steps, and frozen resource totals", () => {
  const { report, row } = purchaseReport();
  const { container } = render(view(report, row));

  expect(
    screen.getByRole("heading", { name: "Your purchase plan" }),
  ).toBeInTheDocument();
  expect(screen.getByText("2 final items · 3 steps")).toBeInTheDocument();
  expect(
    container.querySelectorAll('.purchase-plan-rewards [data-item-id="48493"]'),
  ).toHaveLength(1);
  expect(
    container.querySelectorAll('.purchase-plan-rewards [data-item-id="51125"]'),
  ).toHaveLength(1);
  const steps = screen.getAllByRole("listitem");
  expect(steps).toHaveLength(3);
  expect(within(steps[0]).getByText("Step 1")).toBeInTheDocument();
  expect(within(steps[1]).getByText("Step 2")).toBeInTheDocument();
  expect(within(steps[2]).getByText("Step 3")).toBeInTheDocument();
  expect(
    within(steps[2]).getByText("Uses the item from step 2"),
  ).toBeInTheDocument();
  const frost = screen.getByRole("row", { name: /Emblems of Frost/ });
  expect(within(frost).getByRole("cell", { name: "60" })).toBeInTheDocument();
  expect(within(frost).getByRole("cell", { name: "40" })).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: /Vanquisher.*Mark.*1.*0/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: /Regalia.*Vanquisher.*1.*0/ }),
  ).toBeInTheDocument();
});

it("identifies owned pieces consumed by an upgrade", () => {
  const { report, row } = purchaseReport();
  row.loadout.shoulder = "purchase-original-51125";
  row.purchasePlan = {
    steps: [
      {
        recipeId: "t10-shoulder-264",
        itemId: 51125,
        resultId: "purchase-original-51125",
        prerequisite: { itemId: 50098, instanceId: "owned-base-shoulders" },
        cost: { "mark:normal:vanquisher": 1 },
      },
    ],
    spent: { "mark:normal:vanquisher": 1 },
    remaining: {
      frost: 100,
      "mark:normal:vanquisher": 0,
      "regalia:vanquisher": 1,
    },
    consumedInstanceIds: ["owned-base-shoulders"],
  };
  render(view(report, row));

  expect(screen.getByText("Uses an owned prerequisite")).toBeInTheDocument();
  expect(screen.getByText("Owned pieces consumed")).toBeInTheDocument();
  expect(screen.getByText("Scourgelord Shoulderplates")).toBeInTheDocument();
});

it("localizes the zero-spend state and preserves unused balances", () => {
  const { report, row } = purchaseReport();
  row.purchasePlan = {
    steps: [],
    spent: {},
    remaining: {
      frost: 100,
      "mark:normal:vanquisher": 1,
      "regalia:vanquisher": 1,
    },
    consumedInstanceIds: [],
  };
  const { rerender } = render(view(report, row));
  expect(screen.getByText("No purchases needed")).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: /Emblems of Frost.*0.*100/ }),
  ).toBeInTheDocument();

  rerender(view(report, row, "pt-BR"));
  expect(screen.getByText("Nenhuma compra necessária")).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: /Emblemas de Gelo.*0.*100/ }),
  ).toBeInTheDocument();
});

it("renders nothing for legacy reports without frozen purchase metadata", () => {
  const { report, row } = purchaseReport();
  delete report.purchases;
  const { container } = render(view(report, row));
  expect(container).toBeEmptyDOMElement();
});
