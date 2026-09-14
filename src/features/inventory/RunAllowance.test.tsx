import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import inventory from "../../../messages/en-US/inventory.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { estimateAllowance } from "@/domain/equipment/enumerate";
import type { Allowance, WorkPolicy } from "@/domain/top-gear/model";
import { allowanceForCount } from "@/domain/equipment/enumerate";
import { RunAllowance } from "./RunAllowance";

const { open } = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/features/pro-launch/ProLaunchProvider", () => ({
  useProLaunch: () => ({ open }),
}));

const policy: WorkPolicy = {
  version: "test",
  unitsPerSet: 5000,
  maxUnits: 600000,
  iterationsPerSet: 500,
  maxSearchNodes: 100000,
  maxJobSeconds: 900,
  maxAttempts: 2,
};

function setup({
  loadedPolicy = policy,
  suppliedAllowance,
  error = "",
  readinessError = "",
  pending = false,
}: {
  loadedPolicy?: WorkPolicy | null;
  suppliedAllowance?: Allowance | null;
  error?: string;
  readinessError?: string;
  pending?: boolean;
} = {}) {
  const request = fixtureRequest();
  const onRun = vi.fn();
  const onReduceSelection = vi.fn();
  render(
    <NextIntlClientProvider locale="en-US" messages={{ inventory }}>
      <RunAllowance
        request={request}
        policy={loadedPolicy}
        allowance={
          suppliedAllowance !== undefined
            ? suppliedAllowance
            : loadedPolicy
              ? estimateAllowance(
                  request.snapshot,
                  request.selection,
                  loadedPolicy,
                )
              : null
        }
        error={error}
        readinessError={readinessError}
        pending={pending}
        onRun={onRun}
        onReduceSelection={onReduceSelection}
      />
    </NextIntlClientProvider>,
  );
  return { onRun, onReduceSelection };
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
  setup({ loadedPolicy: null });
  expect(
    screen.getByRole("slider", { name: "Iterations per set" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeDisabled();
});

it("shows submission progress and keeps the run action disabled", () => {
  setup({ pending: true });
  expect(screen.getByRole("button", { name: /Submitting/ })).toBeDisabled();
});

it("offers PRO for a known exact excess and never starts a run", () => {
  const { onRun, onReduceSelection } = setup({
    suppliedAllowance: allowanceForCount(144, policy),
  });
  const addCredits = screen.getByRole("button", { name: /Add credits/ });
  fireEvent.click(addCredits);
  expect(open).toHaveBeenCalledWith("gear_limit", addCredits);
  expect(onRun).not.toHaveBeenCalled();
  expect(screen.getByText(/144 combinations/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Reduce selection/ }));
  expect(onReduceSelection).toHaveBeenCalledOnce();
});

it("qualifies an upper-bound excess without claiming an exact paid requirement", () => {
  setup({
    suppliedAllowance: allowanceForCount(144, policy, "upper-bound"),
  });
  expect(screen.getByText("Up to 144 combinations")).toBeInTheDocument();
  expect(
    screen.getByText("This selection may exceed the free limit."),
  ).toBeInTheDocument();
});

it.each([
  { error: "Service unavailable", readinessError: "" },
  { error: "", readinessError: "Select at least one item" },
])("preserves ordinary errors instead of presenting PRO", (messages) => {
  setup({
    ...messages,
    suppliedAllowance: allowanceForCount(144, policy),
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.error || messages.readinessError,
  );
  expect(screen.queryByRole("button", { name: /Add credits/ })).toBeNull();
});

it("opens the iteration PRO invitation while retaining the valid free run", () => {
  const { onRun } = setup({ suppliedAllowance: allowanceForCount(96, policy) });
  const slider = screen.getByRole("slider", { name: "Iterations per set" });
  fireEvent.change(slider, { target: { value: "1000" } });
  const seePro = screen.getByRole("button", { name: "See PRO" });
  fireEvent.click(seePro);
  expect(open).toHaveBeenCalledWith("iterations_limit", seePro);
  fireEvent.click(screen.getByRole("button", { name: /Run Gear Lab/ }));
  expect(onRun).toHaveBeenCalledOnce();
});

it("toggles the allowance tooltip by touch and dismisses it with Escape", async () => {
  setup({ suppliedAllowance: allowanceForCount(96, policy) });
  const trigger = screen.getByRole("button", { name: "About the set limit" });
  fireEvent.pointerDown(trigger, { pointerType: "touch" });
  fireEvent.click(trigger);
  expect(
    await screen.findByText(/Each admitted set receives 500/),
  ).toBeVisible();
  fireEvent.pointerLeave(trigger, { pointerType: "touch" });
  expect(screen.getByText(/Each admitted set receives 500/)).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByText(/Each admitted set receives 500/)).toBeNull(),
  );
});

it("opens the allowance explanation from keyboard focus", async () => {
  setup({ suppliedAllowance: allowanceForCount(96, policy) });
  fireEvent.focus(screen.getByRole("button", { name: "About the set limit" }));
  expect(
    await screen.findByText(/Each admitted set receives 500/),
  ).toBeVisible();
});
