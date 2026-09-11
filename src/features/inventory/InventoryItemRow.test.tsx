import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import inventory from "../../../messages/en-US/inventory.json";
import common from "../../../messages/en-US/common.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { InventoryItemRow } from "./InventoryItemRow";

afterEach(cleanup);
function setup(itemId?: number) {
  const { snapshot } = fixtureRequest();
  const item = {
    ...snapshot.inventory[0],
    itemId: itemId ?? snapshot.inventory[0].itemId,
  };
  const onEdit = vi.fn(),
    onToggle = vi.fn(),
    onRemove = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en-US" messages={{ inventory, common }}>
      <InventoryItemRow
        item={item}
        preview={{ ...item, gemIds: [41398, 40111], enchantId: 3817 }}
        snapshot={snapshot}
        index={0}
        selected
        onEdit={onEdit}
        onToggle={onToggle}
        onRemove={onRemove}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, onEdit, onToggle, item };
}
it("opens the item from its row without changing checkbox selection", () => {
  const { container, onEdit, onToggle } = setup();
  fireEvent.click(container.querySelector(".inventory-row")!);
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onToggle).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox")).toBeChecked();
});
it("selects through the checkbox without opening the item editor", () => {
  const { onEdit, onToggle } = setup();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(onEdit).not.toHaveBeenCalled();
});
it("shows resolved gems and opens their exact fields without selecting the item", () => {
  const { container, onEdit, onToggle } = setup();
  const gem = container.querySelector('[data-enhancement-field="1"]');
  expect(gem?.querySelector("img")).toHaveAttribute(
    "src",
    expect.stringContaining("inv_jewelcrafting_gem_37"),
  );
  fireEvent.click(gem!);
  expect(onEdit).toHaveBeenLastCalledWith(1);
  fireEvent.click(
    container.querySelector('[data-enhancement-field="enchant"]')!,
  );
  expect(onEdit).toHaveBeenLastCalledWith("enchant");
  expect(onToggle).not.toHaveBeenCalled();
});

it("omits enchant previews from necklaces", () => {
  const { container, onEdit } = setup(47988);
  expect(
    container.querySelector('[data-enhancement-field="enchant"]'),
  ).toBeNull();
  fireEvent.click(container.querySelector(".inventory-row")!);
  expect(onEdit).toHaveBeenCalledWith(0);
});

it("does not open an empty editor for items without sockets or enchants", () => {
  const { container, onEdit } = setup(42987);
  expect(container.querySelector(".item-enhancement-preview")).toBeNull();
  fireEvent.click(container.querySelector(".inventory-row")!);
  expect(onEdit).not.toHaveBeenCalled();
});
