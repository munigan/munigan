import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import enCommon from "../../../../messages/en-US/common.json";
import enDiagnostics from "../../../../messages/en-US/diagnostics.json";
import enInventory from "../../../../messages/en-US/inventory.json";
import { purchaseFixture } from "../../../../tests/support/purchase-fixtures";
import type { ResourceAmounts } from "@/domain/purchases/model";
import { preparePurchases } from "@/domain/purchases/candidates";
import { createSearchBudget } from "@/domain/equipment/search-budget";
import {
  setPurchaseExcluded,
  setResourceBalance,
} from "@/domain/purchases/state";
import type { PurchaseAnalysisState } from "./purchase-worker-contract";
import ptInventory from "../../../../messages/pt-BR/inventory.json";
import { ResourceWallet } from "./ResourceWallet";

function renderWallet(balances: ResourceAmounts = { frost: 100, triumph: 30 }) {
  const onChange = vi.fn();
  const onReview = vi.fn();
  const request = purchaseFixture(balances);
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{
        inventory: enInventory,
        common: enCommon,
        diagnostics: enDiagnostics,
      }}
    >
      <ResourceWallet
        request={request}
        onChange={onChange}
        onReview={onReview}
      />
    </NextIntlClientProvider>,
  );
  return { request, onChange, onReview };
}

it("renders one localized wallet row per resource and reviews purchase candidates", async () => {
  const { onReview } = renderWallet();
  expect(screen.getAllByText("Emblems of Frost")).toHaveLength(1);
  expect(screen.getAllByText("Emblems of Triumph")).toHaveLength(1);
  expect(
    screen.getByRole("spinbutton", { name: "Emblems of Frost quantity" }),
  ).toHaveValue(100);
  expect(
    screen.getByRole("spinbutton", { name: "Emblems of Triumph quantity" }),
  ).toHaveValue(30);
  await userEvent.click(
    screen.getByRole("button", { name: "Review purchases" }),
  );
  expect(onReview).toHaveBeenCalledTimes(1);
});

it("describes Trophy purchases separately from Mark upgrades", () => {
  renderWallet({
    trophy: 1,
    "mark:normal:vanquisher": 1,
    "regalia:vanquisher": 1,
  });

  const trophy = screen
    .getByText("Trophy of the Crusade")
    .closest<HTMLElement>(".resource-wallet-row")!;
  expect(trophy).toHaveTextContent(
    "Also requires Emblems of Triumph · Buys T9 · Item level 245",
  );
  const mark = screen
    .getByText("Vanquisher’s Mark of Sanctification")
    .closest<HTMLElement>(".resource-wallet-row")!;
  expect(mark).toHaveTextContent("Normal · Upgrades T10 251 → 264");
  const regalia = screen
    .getByText("Regalia of the Grand Vanquisher")
    .closest<HTMLElement>(".resource-wallet-row")!;
  expect(regalia).toHaveTextContent(
    "Heroic · Redeems directly for T9 · Item level 258",
  );
});

it("updates inline quantities and removes a resource with accessible actions", async () => {
  const { onChange } = renderWallet({ frost: 2, triumph: 30 });
  await userEvent.click(
    screen.getByRole("button", { name: "Increase Emblems of Frost quantity" }),
  );
  expect(onChange.mock.calls[0][0].purchases.balances.frost).toBe(3);

  await userEvent.click(
    screen.getByRole("button", { name: "Remove Emblems of Triumph" }),
  );
  expect(onChange.mock.calls[1][0].purchases.balances).toEqual({ frost: 2 });
});

it("edits an existing resource atomically without adding another wallet row", async () => {
  const { onChange } = renderWallet({ frost: 100, triumph: 30 });
  const edit = screen.getByRole("button", { name: "Edit Emblems of Frost" });
  await userEvent.click(edit);
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("spinbutton", { name: "Quantity" }),
  ).toHaveValue(100);
  await userEvent.clear(
    within(dialog).getByRole("spinbutton", { name: "Quantity" }),
  );
  await userEvent.type(
    within(dialog).getByRole("spinbutton", { name: "Quantity" }),
    "60",
  );
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Save resource" }),
  );
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].purchases.balances).toEqual({
    frost: 60,
    triumph: 30,
  });
});

it("returns focus to the invoking add or edit control after Cancel and Escape", async () => {
  renderWallet({ frost: 100, triumph: 30 });
  const add = screen.getByRole("button", { name: "Add resource" });
  await userEvent.click(add);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(add).toHaveFocus();

  const edit = screen.getByRole("button", { name: "Edit Emblems of Frost" });
  await userEvent.click(edit);
  await userEvent.keyboard("{Escape}");
  expect(edit).toHaveFocus();
});

it.each(["en-US", "pt-BR"] as const)(
  "counts only available included rewards and clears the count while updating (%s)",
  (locale) => {
    let request = purchaseFixture({ frost: 60 });
    const state = (): PurchaseAnalysisState => ({
      status: "ready",
      analysis: { status: "no-legal-sets", visitedNodes: 0, diagnostics: [] },
      preview: preparePurchases(request, createSearchBudget(100000)),
    });
    const view = (analysis: PurchaseAnalysisState) => (
      <NextIntlClientProvider
        locale={locale}
        messages={{
          inventory: locale === "en-US" ? enInventory : ptInventory,
          common: enCommon,
          diagnostics: enDiagnostics,
        }}
      >
        <ResourceWallet
          request={request}
          analysis={analysis}
          onChange={vi.fn()}
          onReview={vi.fn()}
        />
      </NextIntlClientProvider>
    );
    const { rerender } = render(view(state()));
    const summary = () => document.querySelector(".resource-wallet-review")!;
    expect(summary()).toHaveTextContent(
      locale === "en-US"
        ? "2 compatible purchases included"
        : "2 compras compatíveis incluídas",
    );
    request = setPurchaseExcluded(request, 50098, true);
    rerender(view({ status: "loading" }));
    expect(summary()).not.toHaveTextContent(/4/);
    expect(summary()).toHaveTextContent(
      locale === "en-US" ? "Calculating" : "Calculando",
    );
    rerender(view(state()));
    expect(summary()).toHaveTextContent(
      locale === "en-US"
        ? "1 compatible purchase included"
        : "1 compra compatível incluída",
    );
    for (const itemId of [50853])
      request = setPurchaseExcluded(request, itemId, true);
    rerender(view(state()));
    expect(summary()).toHaveTextContent(
      locale === "en-US"
        ? "1 compatible purchase included"
        : "1 compra compatível incluída",
    );
    request = setResourceBalance(request, "frost", 0);
    rerender(view(state()));
    expect(summary()).toHaveTextContent(
      locale === "en-US"
        ? "0 compatible purchases included"
        : "0 compras compatíveis incluídas",
    );
    rerender(
      view({
        status: "ready",
        analysis: { status: "search-limit", visitedNodes: 1 },
        preview: null,
      }),
    );
    expect(summary()).not.toHaveTextContent(/0/);
    expect(summary()).toHaveTextContent(
      locale === "en-US" ? "unavailable" : "indisponível",
    );
  },
);

it("shows the token's five specialization rewards in the shared tooltip", async () => {
  renderWallet({ "regalia:vanquisher": 1 });
  const trigger = screen.getByRole("button", { name: "5 tier items" });
  expect(trigger).toHaveTextContent("+5");
  await userEvent.hover(trigger);
  const tooltip = await screen.findByRole("tooltip");
  expect(within(tooltip).getAllByRole("listitem")).toHaveLength(5);
  expect(tooltip).toHaveTextContent("Koltira's Battleplate of Triumph");
  expect(tooltip).not.toHaveTextContent("Chestguard");
});
