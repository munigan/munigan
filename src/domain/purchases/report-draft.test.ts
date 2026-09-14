import { expect, it } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import { decodeDraft, encodeRequest } from "@/domain/top-gear/request-schema";
import type { TopGearReport } from "@/domain/top-gear/model";
import { analyzePurchaseSelection } from "./analysis";
import { hydratePurchaseSnapshot } from "./frozen";
import { requestFromReport } from "./report-draft";

it("restores inputs without making generated rewards owned", () => {
  const request = purchaseFixture({ frost: 100 });
  const result = analyzePurchaseSelection(request, purchasePolicy);
  if (result.status !== "complete") throw new Error(result.status);
  const frozen = result.plan.purchases!;
  const report: TopGearReport = {
    token: "purchase-report",
    status: "complete",
    phase: "complete",
    snapshot: hydratePurchaseSnapshot(request.snapshot, frozen),
    selection: request.selection,
    purchases: {
      inputs: frozen.inputs,
      recipeRevision: frozen.recipeRevision,
      recipes: frozen.recipes,
      originalSnapshot: request.snapshot,
    },
    policy: {
      ...purchasePolicy,
      iterationsPerSet: 6000,
      selectableIterations: { min: 500, max: 6000, step: 500 },
    },
    rows: [],
    equippedId: "",
    highestId: null,
    recommendedId: null,
    coverage: {
      planned: result.plan.simulations.length,
      succeeded: result.plan.simulations.length,
      failed: 0,
      returned: 0,
      exhaustive: true,
    },
    termination: "complete",
    expiresAt: "2030-01-01T00:00:00.000Z",
  };

  const draft = requestFromReport(report);

  expect(draft.iterations).toBe(6000);
  expect(decodeDraft(encodeRequest(draft)).iterations).toBe(6000);
  expect(draft.snapshot).toEqual(report.purchases!.originalSnapshot);
  expect(draft.purchases).toEqual(report.purchases!.inputs);
  expect(
    draft.snapshot.inventory.some((item) => item.source === "purchase"),
  ).toBe(false);
  expect(draft.selection).toEqual(report.selection);
  expect(decodeDraft(encodeRequest(draft)).purchases).toEqual(draft.purchases);
});

it("restores legacy reports from their report snapshot", () => {
  const request = purchaseFixture();
  delete request.purchases;
  const report = {
    token: "legacy-report",
    status: "complete",
    phase: "complete",
    snapshot: request.snapshot,
    selection: request.selection,
    policy: purchasePolicy,
    rows: [],
    equippedId: "",
    highestId: null,
    recommendedId: null,
    coverage: {
      planned: 0,
      succeeded: 0,
      failed: 0,
      returned: 0,
      exhaustive: true,
    },
    termination: "complete",
    expiresAt: "2030-01-01T00:00:00.000Z",
  } satisfies TopGearReport;

  expect(requestFromReport(report)).toEqual({
    tool: "top-gear",
    precision: "standard",
    snapshot: report.snapshot,
    selection: report.selection,
  });
});
