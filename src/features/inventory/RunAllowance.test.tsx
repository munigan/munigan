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
  const run = screen.getByRole("button", { name: /Find Top Gear/ });
  expect(run).toBeEnabled();
  fireEvent.click(run);
  expect(onRun).toHaveBeenCalledOnce();
});

it("waits for the server allowance before enabling the iterations control or submitting", () => {
  setup(null);
  expect(
    screen.getByRole("slider", { name: "Iterations per set" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: /Find Top Gear/ })).toBeDisabled();
});
