import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import inventory from "../../../messages/en-US/inventory.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { estimateAllowance } from "@/domain/equipment/enumerate";
import type { WorkPolicy } from "@/domain/top-gear/model";
import { RunAllowance } from "./RunAllowance";

const policy: WorkPolicy = {
  version: "test",
  unitsPerSet: 5000,
  maxUnits: 600000,
  iterationsPerSet: 500,
  maxSearchNodes: 100000,
  maxJobSeconds: 900,
  maxAttempts: 2,
};

function setup(loadedPolicy: WorkPolicy | null = policy) {
  const request = fixtureRequest();
  const onRun = vi.fn();
  render(
    <NextIntlClientProvider locale="en-US" messages={{ inventory }}>
      <RunAllowance
        request={request}
        policy={loadedPolicy}
        allowance={
          loadedPolicy
            ? estimateAllowance(
                request.snapshot,
                request.selection,
                loadedPolicy,
              )
            : null
        }
        error=""
        readinessError=""
        pending={false}
        onRun={onRun}
      />
    </NextIntlClientProvider>,
  );
  return { onRun };
}

it("keeps Free at 500 after repeated locked slider attempts without blocking a valid run", () => {
  const { onRun } = setup();
  const slider = screen.getByRole("slider", { name: "Iterations per set" });
  expect(slider).toBeVisible();
  expect(slider).toHaveAttribute("min", "500");
  expect(slider).toHaveAttribute("max", "3000");
  expect(slider).toHaveAttribute("step", "500");
  expect(slider).toHaveValue("500");
  for (const value of ["1000", "3000", "1500"]) {
    fireEvent.change(slider, { target: { value } });
    expect(slider).toHaveValue("500");
    expect(screen.getByRole("status")).toHaveTextContent(/Free.*500/);
  }
  const run = screen.getByRole("button", { name: /Run Gear Lab/ });
  expect(run).toBeEnabled();
  fireEvent.click(run);
  expect(onRun).toHaveBeenCalledOnce();
});

it("waits for the server allowance before enabling the iterations control or submitting", () => {
  setup(null);
  expect(
    screen.getByRole("slider", { name: "Iterations per set" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeDisabled();
});

it.each([
  "loading",
  "search-limit",
  "catalog-changed",
  "no-legal-sets",
] as const)(
  "blocks a stale allowed allowance for purchase state %s",
  (status) => {
    const request = fixtureRequest();
    const purchaseAnalysis =
      status === "loading"
        ? ({ status } as const)
        : {
            status: "ready" as const,
            analysis:
              status === "catalog-changed"
                ? { status, currentRevision: "new" }
                : { status, visitedNodes: 12, diagnostics: [] },
            preview: null,
          };
    render(
      <NextIntlClientProvider locale="en-US" messages={{ inventory }}>
        <RunAllowance
          request={request}
          policy={policy}
          allowance={estimateAllowance(
            request.snapshot,
            request.selection,
            policy,
          )}
          purchaseAnalysis={purchaseAnalysis}
          error=""
          readinessError=""
          pending={false}
          onRun={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeDisabled();
    expect(document.querySelector(".set-count")).not.toHaveTextContent("/ 120");
  },
);

it("marks an early stopped purchase count as a lower bound rather than exact", async () => {
  const { purchaseFixture, purchasePolicy } =
    await import("../../../tests/support/purchase-fixtures");
  const { analyzePurchaseSelection } =
    await import("@/domain/purchases/analysis");
  const request = purchaseFixture({ frost: 100 });
  const policy = { ...purchasePolicy, maxUnits: 20 };
  const analysis = analyzePurchaseSelection(request, policy);
  expect(analysis.status).toBe("over-limit");
  render(
    <NextIntlClientProvider locale="en-US" messages={{ inventory }}>
      <RunAllowance
        request={request}
        policy={policy}
        allowance={null}
        purchaseAnalysis={{ status: "ready", analysis, preview: null }}
        error=""
        readinessError=""
        pending={false}
        onRun={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(document.querySelector(".set-count")).toHaveTextContent("≥2 / 1 sets");
  expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeDisabled();
});

it("shows uncapped local allowance and sends the chosen 6000 iterations to the draft", () => {
  const request = fixtureRequest();
  const localPolicy = {
    ...policy,
    maxUnits: null,
    maxSearchNodes: null,
    maxJobSeconds: null,
    selectableIterations: { min: 500, max: 6000, step: 500 },
  };
  const onIterationsChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en-US" messages={{ inventory }}>
      <RunAllowance
        request={request}
        policy={localPolicy}
        allowance={estimateAllowance(
          request.snapshot,
          request.selection,
          localPolicy,
        )}
        error=""
        readinessError=""
        pending={false}
        onRun={() => {}}
        onIterationsChange={onIterationsChange}
      />
    </NextIntlClientProvider>,
  );
  expect(document.querySelector(".set-count")).toHaveTextContent("/ ∞");
  expect(screen.queryByRole("progressbar")).toBeNull();
  const slider = screen.getByRole("slider", { name: "Iterations per set" });
  expect(slider).toHaveAttribute("max", "6000");
  fireEvent.change(slider, { target: { value: "6000" } });
  expect(onIterationsChange).toHaveBeenCalledWith(6000);
  expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeEnabled();
});
