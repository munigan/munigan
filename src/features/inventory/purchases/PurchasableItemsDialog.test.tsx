import { render, screen, within, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import inventory from "../../../../messages/en-US/inventory.json";
import common from "../../../../messages/en-US/common.json";
import diagnostics from "../../../../messages/en-US/diagnostics.json";
import { purchaseFixture } from "../../../../tests/support/purchase-fixtures";
import { preparePurchases } from "@/domain/purchases/candidates";
import { createSearchBudget } from "@/domain/equipment/search-budget";
import { PurchasableItemsDialog } from "./PurchasableItemsDialog";
import { setPurchaseExcluded } from "@/domain/purchases/state";
function setup(
  request = purchaseFixture({ frost: 100, "mark:heroic:vanquisher": 1 }),
) {
  const preview = preparePurchases(request, createSearchBudget(100000));
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, common, diagnostics }}
    >
      <PurchasableItemsDialog
        request={request}
        preview={preview}
        open
        onOpenChange={vi.fn()}
        onChange={onChange}
      />
    </NextIntlClientProvider>,
  );
  return { preview, onChange, request };
}
it("shows unavailable exact prerequisites and excludes final rewards without changing inventory", () => {
  const { request, onChange } = setup();
  const row = document.querySelector<HTMLElement>(
    '[data-purchase-id="51125"]',
  )!;
  expect(row).toHaveTextContent(/Unavailable/);
  expect(row).toHaveTextContent(/Mark of Sanctification/);
  expect(row).toHaveTextContent(/Scourgelord/);
  expect(row).toHaveTextContent(/60 Emblems of Frost/);
  expect(
    screen.getByText(
      /Excluded items can still be used as upgrade prerequisites/,
    ),
  ).toBeInTheDocument();
  fireEvent.click(within(row).getByRole("checkbox", { hidden: true }));
  const next = onChange.mock.calls[0][0];
  expect(next.purchases.excludedItemIds.original).toContain(51125);
  expect(next.snapshot).toEqual(request.snapshot);
});
it("re-includes an unaffordable excluded reward and preserves the other profile", () => {
  const request = setPurchaseExcluded(
    purchaseFixture({ frost: 0 }),
    51125,
    true,
  );
  request.purchases!.excludedItemIds.classic = [51125];
  const { onChange } = setup(request);
  fireEvent.click(
    within(
      document.querySelector<HTMLElement>('[data-purchase-id="51125"]')!,
    ).getByRole("checkbox", { hidden: true }),
  );
  expect(
    onChange.mock.calls[0][0].purchases.excludedItemIds.original ?? [],
  ).not.toContain(51125);
  expect(onChange.mock.calls[0][0].purchases.excludedItemIds.classic).toEqual([
    51125,
  ]);
});
it("explains owned items consumed by an upgrade and shared balances", () => {
  const request = purchaseFixture({ "mark:normal:vanquisher": 1 });
  request.snapshot.inventory.push({
    instanceId: "owned-shoulders",
    itemId: 50098,
    source: "bag",
    gemIds: [],
    enchantId: 0,
  });
  setup(request);
  expect(
    screen.getByText(/A complete set must fit all shared balances/),
  ).toBeInTheDocument();
  expect(screen.getAllByText(/Consumed owned item/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/owned-shoulders/).length).toBeGreaterThan(0);
});

it("edits an unavailable reward through the purchase override in its current profile", async () => {
  const request = purchaseFixture({ frost: 0 });
  request.purchases!.itemEnhancements.classic = {
    "50098": { enchantId: 3808 },
  };
  const { onChange } = setup(request);
  const row = document.querySelector<HTMLElement>(
    '[data-purchase-id="50098"]',
  )!;
  fireEvent.click(
    within(row).getByRole("button", {
      name: /Edit enhancements/,
      hidden: true,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Enchant" }));
  fireEvent.click(screen.getByRole("radio", { name: "No enchant" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  const next = onChange.mock.calls[0][0];
  expect(next.purchases.itemEnhancements.original["50098"]).toEqual({
    enchantId: 0,
  });
  expect(next.purchases.itemEnhancements.classic["50098"]).toEqual({
    enchantId: 3808,
  });
  expect(next.snapshot).toEqual(request.snapshot);
});

it("retains expanded review groups when a wallet edit invalidates the preview", () => {
  const request = purchaseFixture({ frost: 60 });
  const preview = preparePurchases(request, createSearchBudget(100000));
  const view = (value: typeof preview | null) => (
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, common, diagnostics }}
    >
      <PurchasableItemsDialog
        request={request}
        preview={value}
        open
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
      />
    </NextIntlClientProvider>
  );
  const { rerender } = render(view(preview));
  const group = document.querySelector("details")!;
  group.open = true;
  fireEvent(group, new Event("toggle"));
  rerender(view(null));
  rerender(view(preview));
  expect(document.querySelector("details")).toHaveAttribute("open");
});

it("puts Feral purchase variants first while keeping every legal alternative", async () => {
  const { purchaseFixture } =
    await import("../../../../tests/support/purchase-fixtures");
  const { listSpecs, defaultSettings } =
    await import("@/features/settings/registry");
  const { preparePurchases } = await import("@/domain/purchases/candidates");
  const { createSearchBudget } =
    await import("@/domain/equipment/search-budget");
  const { emptyLoadout } = await import("@/domain/top-gear/slots");
  const request = purchaseFixture({ frost: 60 });
  const spec = listSpecs().find((s) => s.module === "feral_druid")!;
  request.snapshot.specId = spec.id;
  request.snapshot.settings = defaultSettings(spec.id);
  request.snapshot.inventory = [];
  request.snapshot.equipped = emptyLoadout();
  request.selection.selectedInstanceIds = [];
  const preview = preparePurchases(request, createSearchBudget(100000));
  const original = preview.candidates.map((c) => c.instance.instanceId);
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, common, diagnostics }}
    >
      <PurchasableItemsDialog
        request={request}
        preview={preview}
        open
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  const ids = Array.from(document.querySelectorAll("[data-purchase-id]")).map(
    (row) => row.getAttribute("data-purchase-id"),
  );
  expect(ids.filter((id) => ["50107", "50822", "50827"].includes(id!))).toEqual(
    ["50827", "50107", "50822"],
  );
  expect(preview.candidates.map((c) => c.instance.instanceId)).toEqual(
    original,
  );
});
