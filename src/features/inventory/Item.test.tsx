import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import inventory from "../../../messages/en-US/inventory.json";
import settings from "../../../messages/en-US/settings.json";
import common from "../../../messages/en-US/common.json";
function EnglishProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, settings, common }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
const render = (ui: ReactNode) => rtlRender(ui, { wrapper: EnglishProvider });
import { render as rtlRender, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ItemLink, ItemIcon } from "./Item";
import { ItemVersionContext } from "./ItemVersionContext";

afterEach(cleanup);

it.each([{ gemIds: [40111] }, { gemIds: [40111, 0, 0] }])(
  "does not turn padded gem positions $gemIds into extra sockets on Frigid Strength of Hodir",
  ({ gemIds }) => {
    render(
      <ItemVersionContext.Provider value="original">
        <ItemLink
          item={{
            instanceId: "neck",
            itemId: 45459,
            enchantId: 0,
            gemIds,
            source: "equipped",
          }}
        >
          Frigid Strength of Hodir
        </ItemLink>
      </ItemVersionContext.Provider>,
    );
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip).toHaveTextContent("Bold Cardinal Ruby");
    expect(tooltip).not.toHaveTextContent("Empty socket");
  },
);

it.each([
  { itemId: 45459, gemIds: [], attachments: 1, empty: 1 },
  { itemId: 45459, gemIds: [0, 0, 0], attachments: 1, empty: 1 },
  { itemId: 45931, gemIds: [0, 0, 0], attachments: 0, empty: 0 },
  // An equipped buckle or blacksmith gem remains visible beyond base sockets.
  { itemId: 40881, gemIds: [0, 40111, 0], attachments: 2, empty: 1 },
  { itemId: 40889, gemIds: [40111, 0, 0], attachments: 1, empty: 0 },
])(
  "shows real sockets and equipped gems for $itemId with $gemIds",
  ({ itemId, gemIds, attachments, empty }) => {
    render(
      <ItemVersionContext.Provider value="original">
        <ItemLink
          item={{
            instanceId: "item",
            itemId,
            enchantId: 0,
            gemIds,
            source: "equipped",
          }}
        >
          Item
        </ItemLink>
      </ItemVersionContext.Provider>,
    );
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip.querySelectorAll(".original-item-enhancement")).toHaveLength(
      attachments,
    );
    expect(tooltip.textContent?.match(/Empty socket/g) ?? []).toHaveLength(
      empty,
    );
    if (gemIds.includes(40111))
      expect(tooltip).toHaveTextContent("Bold Cardinal Ruby");
  },
);

it("renders an item icon with its enhancement-aware tooltip link", () => {
  render(
    <ItemIcon
      item={{
        instanceId: "head",
        itemId: 48493,
        enchantId: 3817,
        gemIds: [41398, 49110],
        source: "equipped",
      }}
      size={40}
    />,
  );
  const link = screen.getByRole("link", {
    name: "Koltira's Helmet of Triumph",
  });
  expect(link).toHaveAttribute("data-wowhead", "ench=3817&gems=41398:49110");
  expect(link.querySelector("img")).toHaveAttribute("width", "40");
});

it.each([40207, 48493])(
  "uses complete Wowhead tooltips for unchanged Original item %s",
  (itemId) => {
    render(
      <ItemVersionContext.Provider value="original">
        <ItemLink
          item={{
            instanceId: "equipped",
            itemId,
            enchantId: 3817,
            gemIds: [41398, 49110],
            source: "equipped",
          }}
        >
          Item
        </ItemLink>
      </ItemVersionContext.Provider>,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `https://www.wowhead.com/wotlk/item=${itemId}`,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "data-wowhead",
      "ench=3817&gems=41398:49110",
    );
  },
);

it.each([45931, 46312])(
  "keeps the version-aware tooltip for changed or unsupported Original item %s",
  (itemId) => {
    render(
      <ItemVersionContext.Provider value="original">
        <ItemLink
          item={{
            instanceId: "equipped",
            itemId,
            enchantId: 0,
            gemIds: [],
            source: "equipped",
          }}
        >
          Item
        </ItemLink>
      </ItemVersionContext.Provider>,
    );
    expect(screen.getByRole("link")).not.toHaveAttribute("data-wowhead");
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(
      itemId === 45931
        ? "665 armor penetration"
        : "Not supported for simulation",
    );
  },
);

it("requests a provider icon for bag items absent from the local icon catalog", () => {
  render(
    <ItemIcon
      tooltipOnly
      item={{
        instanceId: "bandage",
        itemId: 1251,
        enchantId: 0,
        gemIds: [],
        source: "bag",
      }}
    />,
  );
  expect(screen.getByRole("img", { name: "Item 1251" })).toHaveAttribute(
    "data-wh-icon-size",
    "medium",
  );
});
