import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ItemLink, ItemIcon } from "./Item";
import { ItemVersionContext } from "./ItemVersionContext";

afterEach(cleanup);

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
