import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import inventory from "../../../messages/en-US/inventory.json";
import common from "../../../messages/en-US/common.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { InventoryItemRow } from "./InventoryItemRow";
import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/react";

afterEach(cleanup);
function setup(itemId?: number, enchantId = 3817) {
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
        preview={{ ...item, gemIds: [41398, 40111], enchantId }}
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
it("explains the source icon without opening the editor or selecting the row", async () => {
  const user = userEvent.setup();
  const { container, onEdit, onToggle } = setup();
  const source = within(
    container.querySelector(".item-source") as HTMLElement,
  ).getByRole("img", { name: "Equipped" });
  await user.hover(source);
  expect(
    await screen.findByText("Equipped", { selector: ".app-tooltip-popup" }),
  ).toHaveTextContent("Equipped");
  await user.click(source);
  expect(onEdit).not.toHaveBeenCalled();
  expect(onToggle).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(
    screen.queryByText("Equipped", { selector: ".app-tooltip-popup" }),
  ).not.toBeInTheDocument();
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

it.each([
  {
    itemId: 44006,
    enchantId: 3817,
    name: "Arcanum of Torment",
    target: "spell=59954",
  },
  {
    itemId: 50037,
    enchantId: 3604,
    name: "Hyperspeed Accelerators",
    target: "spell=54999",
  },
  {
    itemId: 40539,
    enchantId: 3832,
    name: "Powerful Stats",
    target: "spell=60692",
  },
  {
    itemId: 40539,
    enchantId: 3252,
    name: "Super Stats",
    target: "spell=44623",
  },
])(
  "shows owned local enchant details for $name and retains edit controls",
  async ({ itemId, enchantId, name, target }) => {
    const user = userEvent.setup();
    const { onEdit, onToggle } = setup(itemId, enchantId);
    const enchant = screen.getByRole("button", {
      name: new RegExp(`Edit enchant on ${name}`),
    });
    expect(enchant).toHaveAttribute(
      "href",
      `https://www.wowhead.com/wotlk/${target}`,
    );
    expect(enchant).not.toHaveAttribute("data-wowhead");
    await user.hover(enchant);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(name);
    await user.click(enchant);
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("enchant");
    expect(onToggle).not.toHaveBeenCalled();
    onEdit.mockClear();
    await user.keyboard(" ");
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("enchant");
    expect(onToggle).not.toHaveBeenCalled();
  },
);

it("keeps an empty enchant editable without requesting a nonexistent Wowhead tooltip", async () => {
  const user = userEvent.setup();
  const { onEdit } = setup(44006, 0);
  const enchant = screen.getByRole("button", {
    name: "Edit enchant on No enchant",
  });
  expect(enchant.tagName).toBe("BUTTON");
  expect(enchant).not.toHaveAttribute("data-wowhead");
  await user.hover(enchant);
  expect(await screen.findByRole("tooltip")).toBeVisible();
  await user.click(enchant);
  expect(onEdit).toHaveBeenCalledExactlyOnceWith("enchant");
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

it("coordinates item and local enchant tooltips in both directions", async () => {
  const user = userEvent.setup();
  const { container } = setup(44006, 3817);
  const name = container.querySelector(
    ".item-row-copy > .item-tooltip-trigger > a",
  )!;
  const enchant = screen.getByRole("button", {
    name: /Edit enchant on Arcanum of Torment/,
  });
  fireEvent.focus(name);
  await user.hover(enchant);
  await vi.waitFor(() =>
    expect(
      document.querySelector(".compact-enchant-tooltip"),
    ).toBeInTheDocument(),
  );
  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Arcanum of Torment");
  await user.unhover(enchant);
  fireEvent.focus(enchant);
  await vi.waitFor(() =>
    expect(
      document.querySelector(".compact-enchant-tooltip"),
    ).toBeInTheDocument(),
  );
  fireEvent.mouseEnter(name);
  await vi.waitFor(() =>
    expect(screen.getByRole("tooltip")).toHaveTextContent("Obsidian Greathelm"),
  );
  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
});
