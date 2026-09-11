import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import inventory from "../../../messages/en-US/inventory.json";
import diagnostics from "../../../messages/en-US/diagnostics.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { InventorySelector } from "./InventorySelector";

vi.mock("./InventoryItemRow", () => ({
  InventoryItemRow: () => <div>Item row</div>,
}));
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

function view(
  request: ReturnType<typeof fixtureRequest>,
  focusChanges = false,
) {
  return (
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, diagnostics }}
    >
      <InventorySelector
        request={request}
        focusChanges={focusChanges}
        onChange={vi.fn()}
      />
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
  render(view(request, true));
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(14);
  expect(
    screen.queryByRole("button", { name: /Other slots/ }),
  ).not.toBeInTheDocument();
});

it.each(["custom item", "selection", "enhancement"])(
  "focuses a restored %s change and allows expanding all other slots",
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
    render(view(request, true));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Head", level: 3 }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Other slots/ }));
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
