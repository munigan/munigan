import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import inventory from "../../../messages/en-US/inventory.json";
import diagnostics from "../../../messages/en-US/diagnostics.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { InventorySelector } from "./InventorySelector";

vi.mock("./custom-items/CustomItemPicker", () => ({
  AddCustomItem: () => <button>Add custom item</button>,
}));
vi.mock("./InventoryEnhancementIssues", () => ({
  InventoryEnhancementIssues: () => null,
}));
afterEach(cleanup);

it("shows every slot immediately after review, including equipped-only slots", () => {
  const request = fixtureRequest();
  request.snapshot.inventory = request.snapshot.inventory.filter(
    (i) => i.source === "equipped",
  );
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, diagnostics }}
    >
      <InventorySelector request={request} onChange={vi.fn()} />
    </NextIntlClientProvider>,
  );
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(14);
  expect(
    screen.queryByRole("button", { name: /Other slots/ }),
  ).not.toBeInTheDocument();
});

function view(request: ReturnType<typeof fixtureRequest>) {
  return (
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, diagnostics }}
    >
      <InventorySelector request={request} onChange={vi.fn()} />
    </NextIntlClientProvider>
  );
}

it("keeps a restored untouched setup fully visible, including unselected bag items", () => {
  const request = fixtureRequest();
  const head = request.snapshot.inventory.find(
    (i) => i.equippedSlot === "head",
  )!;
  request.snapshot.inventory.push({
    ...head,
    instanceId: "bag-head",
    source: "bag",
    equippedSlot: undefined,
  });
  render(view(request));
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(14);
  expect(
    screen.queryByRole("button", { name: /Other slots/ }),
  ).not.toBeInTheDocument();
});

it.each(["custom item", "selection", "enhancement"])(
  "keeps all slots visible with a restored %s change",
  (kind) => {
    const request = fixtureRequest();
    const head = request.snapshot.inventory.find(
      (i) => i.equippedSlot === "head",
    )!;
    if (kind === "custom item")
      request.snapshot.inventory.push({
        ...head,
        instanceId: "custom-head",
        source: "custom",
        equippedSlot: undefined,
      });
    if (kind === "selection")
      request.selection.selectedInstanceIds =
        request.selection.selectedInstanceIds.filter(
          (id) => id !== head.instanceId,
        );
    if (kind === "enhancement")
      request.snapshot.itemEnhancements = {
        [head.instanceId]: { enchantId: 0 },
      };
    render(view(request));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(14);
    expect(
      screen.getByRole("heading", { name: "Head", level: 3 }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Other slots/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(14);
  },
);

it("does not collapse the first visit when the user starts editing", () => {
  const request = fixtureRequest();
  const { rerender } = render(view(request));
  const edited = structuredClone(request);
  edited.selection.selectedInstanceIds =
    edited.selection.selectedInstanceIds.slice(1);
  rerender(view(edited));
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(14);
});

it("converts registered custom tiers into one costed row and routes exclusions to the original draft", async () => {
  const { purchaseFixture } =
    await import("../../../tests/support/purchase-fixtures");
  const { preparePurchases } = await import("@/domain/purchases/candidates");
  const { createSearchBudget } =
    await import("@/domain/equipment/search-budget");
  const { fireEvent } = await import("@testing-library/react");
  const request = purchaseFixture({ frost: 60 });
  request.snapshot.inventory.push({
    instanceId: "custom-shoulders",
    itemId: 50098,
    source: "custom",
    gemIds: [],
    enchantId: 0,
  });
  request.selection.selectedInstanceIds.push("custom-shoulders");
  const preview = preparePurchases(request, createSearchBudget(100000));
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, diagnostics }}
    >
      <InventorySelector
        request={request}
        purchasePreview={preview}
        onChange={onChange}
      />
    </NextIntlClientProvider>,
  );
  expect(
    document.querySelector('[data-instance-id="custom-shoulders"]'),
  ).toBeNull();
  const row = document.querySelector(
    '[data-instance-id="purchase-original-50098"]',
  )!;
  const checkbox = row.querySelector('input[type="checkbox"]')!;
  expect(checkbox).toBeChecked();
  expect(row).toHaveTextContent("Uses resources");
  expect(row.querySelector(".item-remove")).not.toBeNull();
  fireEvent.click(checkbox);
  expect(
    onChange.mock.calls[0][0].purchases.excludedItemIds.original,
  ).toContain(50098);
  expect(onChange.mock.calls[0][0].snapshot).toEqual(request.snapshot);
});
