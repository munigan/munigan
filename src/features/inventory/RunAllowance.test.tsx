import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("describes all six iteration choices and keeps locked choices at the free allowance", async () => {
  const user = userEvent.setup();
  const { onRun } = setup();
  const select = screen.getByRole("combobox", { name: "Iterations per set" });
  expect(screen.queryByRole("slider")).toBeNull();
  for (const value of ["1000", "3000", "1500"]) {
    await user.click(select);
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(6);
    for (const option of options) expect(option).toHaveAccessibleDescription();
    await user.click(
      options.find(
        (option) => option.getAttribute("data-select-value") === value,
      )!,
    );
    expect(select).toHaveAttribute("data-select-value", "500");
    expect(screen.getByRole("status")).toHaveTextContent(/Free.*500/);
  }
  const run = screen.getByRole("button", { name: /Run Gear Lab/ });
  expect(run).toBeEnabled();
  await user.click(run);
  expect(onRun).toHaveBeenCalledOnce();
});

it("waits for the server allowance before enabling the iterations control or submitting", () => {
  setup({ loadedPolicy: null });
  expect(
    screen.getByRole("combobox", { name: "Iterations per set" }),
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
  expect(
    screen.getByText("24 combinations above the free limit."),
  ).toBeInTheDocument();
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
  expect(screen.getByText("May exceed free limit")).toBeInTheDocument();
  expect(screen.queryByText("Free limit reached")).toBeNull();
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
  expect(screen.getByRole("alert").closest(".run-action-panel")).not.toBeNull();
  expect(screen.queryByRole("button", { name: /Add credits/ })).toBeNull();
});

it("opens the iteration PRO invitation while retaining the valid free run", async () => {
  const user = userEvent.setup();
  const { onRun } = setup({ suppliedAllowance: allowanceForCount(96, policy) });
  await user.click(
    screen.getByRole("combobox", { name: "Iterations per set" }),
  );
  await user.click((await screen.findAllByRole("option"))[1]);
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
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    /Each admitted set receives 500/,
  );
  fireEvent.pointerLeave(trigger, { pointerType: "touch" });
  expect(screen.getByRole("tooltip")).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});

it("opens the allowance explanation from keyboard focus", async () => {
  setup({ suppliedAllowance: allowanceForCount(96, policy) });
  fireEvent.focus(screen.getByRole("button", { name: "About the set limit" }));
  expect(await screen.findByRole("tooltip")).toBeVisible();
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
  expect(document.querySelector(".set-count")).toHaveTextContent(
    "≥ 2 combinations",
  );
  expect(screen.getByRole("button", { name: /Add credits/ })).toBeEnabled();
  expect(screen.queryByRole("button", { name: /Run Gear Lab/ })).toBeNull();
});

it("shows uncapped local allowance and sends the chosen 6000 iterations to the draft", async () => {
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
  expect(screen.getByText("Local")).toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).toBeNull();
  await userEvent.click(
    screen.getByRole("combobox", { name: "Iterations per set" }),
  );
  await userEvent.click((await screen.findAllByRole("option"))[11]);
  expect(onIterationsChange).toHaveBeenCalledWith(6000);
  expect(screen.getByRole("button", { name: /Run Gear Lab/ })).toBeEnabled();
});
