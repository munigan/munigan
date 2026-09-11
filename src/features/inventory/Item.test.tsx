import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import inventory from "../../../messages/en-US/inventory.json";
import settings from "../../../messages/en-US/settings.json";
import common from "../../../messages/en-US/common.json";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ItemLink, ItemIcon } from "./Item";
import { ItemVersionContext } from "./ItemVersionContext";
import {
  tooltipSourceUrl,
  type ItemTooltipResponse,
} from "@/domain/tooltips/contracts";
const item = {
  instanceId: "head",
  itemId: 48493,
  enchantId: 3817,
  gemIds: [41398, 49110],
  source: "equipped" as const,
};
function view(ui: ReactNode, version: "classic" | "original" = "classic") {
  return (
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, settings, common }}
    >
      <ItemVersionContext.Provider value={version}>
        {ui}
      </ItemVersionContext.Provider>
    </NextIntlClientProvider>
  );
}
function response(
  id = 48493,
  version: "classic" | "original" = "classic",
): ItemTooltipResponse {
  return {
    item: {
      schemaVersion: 1,
      id,
      version,
      source: {
        provider: version === "classic" ? "wowhead" : "cavernoftime",
        url: tooltipSourceUrl(version, id),
      },
      name: `Enriched ${id}`,
      quality: 4,
      icon: null,
      itemLevel: 245,
      heroic: false,
      lines: [
        { kind: "effect", text: "Equip: Complete effect description." },
        { kind: "requirement", text: "Requires Level 80" },
        { kind: "set", text: "(4) Set: Full set effect." },
      ],
      sockets: ["meta", "red"],
      socketBonus: "+8 Strength",
    },
    meta: { fetchedAt: "2026-09-11T00:00:00.000Z", cache: "fresh" },
  };
}
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  ),
);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("keeps known content free of skeletons and opens cached details immediately", async () => {
  vi.useFakeTimers();
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(
    view(
      <ItemLink item={{ ...item, itemId: 50362, enchantId: 0, gemIds: [] }}>
        Item
      </ItemLink>,
    ),
  );
  const link = screen.getByRole("link");
  fireEvent.focus(link);
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toHaveTextContent("Deathbringer's Will");
  expect(tooltip).toHaveTextContent("155");
  await act(() => vi.advanceTimersByTimeAsync(119));
  expect(tooltip.querySelector(".compact-tooltip-skeleton")).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(tooltip.querySelectorAll(".compact-tooltip-skeleton")).toHaveLength(0);
  expect(within(tooltip).getByRole("status")).toHaveTextContent(
    "Fetching additional details…",
  );
  expect(
    tooltip.querySelector(
      ".compact-tooltip-footer .compact-tooltip-loading-dot",
    ),
  ).not.toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(1880));
  expect(within(tooltip).getByRole("status")).toHaveTextContent(
    "Fetching additional details…",
  );
  await act(async () => {
    resolve(new Response(JSON.stringify(response(50362))));
  });
  expect(tooltip.querySelector(".compact-tooltip-skeleton")).toBeNull();
  expect(tooltip).toHaveTextContent("Complete effect description.");
  expect(tooltip.querySelector('[data-reveal="true"]')).not.toBeNull();
  fireEvent.keyDown(link, { key: "Escape" });
  fireEvent.focus(link);
  expect(screen.getByRole("tooltip")).toHaveTextContent(
    "Complete effect description.",
  );
  expect(
    screen.getByRole("tooltip").querySelector(".compact-tooltip-skeleton"),
  ).toBeNull();
  expect(
    screen.getByRole("tooltip").querySelector('[data-reveal="true"]'),
  ).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("stops the footer loading indicator on failure and retries on reopen", async () => {
  vi.useFakeTimers();
  let reject!: (reason: Error) => void;
  vi.mocked(fetch).mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  render(view(<ItemLink item={{ ...item, itemId: 50363 }}>Item</ItemLink>));
  fireEvent.focus(screen.getByRole("link"));
  await act(() => vi.advanceTimersByTimeAsync(120));
  expect(
    screen.getByRole("tooltip").querySelector(".compact-tooltip-loading-dot"),
  ).not.toBeNull();
  await act(async () => {
    reject(new Error("offline"));
  });
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.querySelector(".compact-tooltip-skeleton")).toBeNull();
  expect(tooltip).toHaveTextContent("Deathbringer's Will");
  expect(tooltip).toHaveTextContent("Arcanum of Torment");
  expect(tooltip).toHaveTextContent("Additional details unavailable");
  fireEvent.mouseEnter(screen.getByRole("link", { name: "Item" }));
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(tooltip).not.toHaveTextContent("Still loading");
  fireEvent.keyDown(screen.getByRole("link", { name: "Item" }), {
    key: "Escape",
  });
  await act(() => vi.advanceTimersByTimeAsync(61000));
  fireEvent.focus(screen.getByRole("link", { name: "Item" }));
  await act(() => vi.advanceTimersByTimeAsync(120));
  expect(
    screen.getByRole("tooltip").querySelector(".compact-tooltip-loading-dot"),
  ).not.toBeNull();
  expect(screen.getByRole("tooltip")).not.toHaveTextContent(
    "Additional details unavailable",
  );
});

it("shows complete local gems without skeletons during enrichment", async () => {
  vi.useFakeTimers();
  render(
    view(
      <ItemLink item={{ ...item, itemId: 40112, enchantId: 0, gemIds: [] }}>
        Item
      </ItemLink>,
    ),
  );
  fireEvent.focus(screen.getByRole("link"));
  await act(() => vi.advanceTimersByTimeAsync(2100));
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toHaveTextContent("Delicate Cardinal Ruby");
  expect(tooltip.querySelector(".compact-tooltip-skeleton")).toBeNull();
  expect(tooltip).not.toHaveTextContent(/Loading|Still loading/);
});

it("shows catalog basics immediately on focus without waiting for enrichment", () => {
  render(view(<ItemIcon item={item} size={40} />));
  const link = screen.getByRole("link", {
    name: "Koltira's Helmet of Triumph",
  });
  fireEvent.focus(link);
  expect(screen.getByRole("tooltip")).toHaveTextContent(
    "Koltira's Helmet of Triumph",
  );
  expect(link.querySelector("img")).toHaveAttribute("width", "40");
  expect(link).not.toHaveAttribute("data-wowhead");
});

it.each([40207, 48493, 45931, 46312])(
  "routes every Original item %s to Original data and source",
  (id) => {
    render(
      view(
        <ItemLink item={{ ...item, itemId: id }}>Item</ItemLink>,
        "original",
      ),
    );
    const link = screen.getByRole("link");
    fireEvent.focus(link);
    expect(link).toHaveAttribute(
      "href",
      `https://wotlk.cavernoftime.com/item=${id}`,
    );
    expect(link).not.toHaveAttribute("data-wowhead");
    expect(fetch).toHaveBeenCalledWith(
      `/api/tooltips/original/${id}`,
      expect.anything(),
    );
    if (id === 46312)
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Not supported for simulation",
      );
  },
);

it("renders full effects, sets and requirements from validated JSON", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(response(47528))),
  );
  render(view(<ItemLink item={{ ...item, itemId: 47528 }}>Item</ItemLink>));
  fireEvent.mouseEnter(screen.getByRole("link"));
  await waitFor(() =>
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Equip: Complete effect description.",
    ),
  );
  expect(screen.getByRole("tooltip")).toHaveTextContent(
    "(4) Set: Full set effect.",
  );
  expect(screen.getByRole("tooltip")).toHaveTextContent("Requires Level 80");
});

it("keeps useful basics when the provider fails", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  render(view(<ItemLink item={{ ...item, itemId: 45931 }}>Item</ItemLink>));
  fireEvent.focus(screen.getByRole("link"));
  await waitFor(() =>
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Additional details unavailable",
    ),
  );
  expect(screen.getByRole("tooltip")).toHaveTextContent("Mjolnir Runestone");
});

it("keeps empty socket indices, ignores trailing padding, shows gem stats and the actual enchant", () => {
  render(
    view(
      <ItemLink item={{ ...item, gemIds: [0, 40111, 0, 0] }}>Item</ItemLink>,
    ),
  );
  fireEvent.focus(screen.getByRole("link"));
  const tooltip = screen.getByRole("tooltip");
  const sockets = tooltip.querySelectorAll("[data-socket-index]");
  expect(sockets).toHaveLength(2);
  expect(sockets[0]).toHaveTextContent("Empty socket");
  expect(sockets[1]).toHaveTextContent("Bold Cardinal Ruby");
  expect(sockets[1]).toHaveTextContent("+20 Strength");
  expect(tooltip).toHaveTextContent("Arcanum of Torment");
  expect(tooltip.querySelector("[data-socket-bonus]")).toHaveAttribute(
    "data-active",
    "false",
  );
});

it("Escape dismisses without propagating to the enclosing dialog and preserves edit clicks", () => {
  const edit = vi.fn((event) => event.preventDefault());
  const outer = vi.fn();
  render(
    view(
      <div onKeyDown={outer}>
        <ItemLink item={item} onClick={edit}>
          Edit gear
        </ItemLink>
      </div>,
    ),
  );
  const link = screen.getByRole("link");
  fireEvent.focus(link);
  fireEvent.keyDown(link, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(outer).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(edit).toHaveBeenCalledOnce();
});

it("ignores late enrichment after the item changes", async () => {
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const rendered = render(
    view(<ItemLink item={{ ...item, itemId: 47475 }}>Item</ItemLink>),
  );
  fireEvent.focus(screen.getByRole("link"));
  rendered.rerender(
    view(<ItemLink item={{ ...item, itemId: 40111 }}>Item</ItemLink>),
  );
  resolve(new Response(JSON.stringify(response(47475))));
  await waitFor(() =>
    expect(screen.getByRole("tooltip")).toHaveTextContent("Bold Cardinal Ruby"),
  );
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("Enriched 47475");
});

it("provides touch close without changing passive bag semantics", () => {
  render(view(<ItemIcon tooltipOnly item={{ ...item, itemId: 1251 }} />));
  const icon = screen.getByRole("img", { name: "Item 1251" });
  fireEvent.pointerDown(icon, { pointerType: "touch" });
  fireEvent.click(icon);
  const tooltip = screen.getByRole("tooltip");
  fireEvent.click(
    within(tooltip).getByRole("button", { name: "Close item details" }),
  );
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("labels socket state and groups complete provider text with footer requirements", async () => {
  const data = response(50712);
  data.item.lines.unshift(
    { kind: "binding", text: "Binds when picked up" },
    { kind: "weapon", text: "350 Damage", rightText: "Speed 2.60" },
    { kind: "stat", text: "+100 Strength" },
  );
  data.item.sockets = ["blue"];
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(data)));
  render(
    view(
      <ItemLink item={{ ...item, itemId: 50712, gemIds: [40111] }}>
        Item
      </ItemLink>,
    ),
  );
  fireEvent.focus(screen.getByRole("link"));
  await waitFor(() =>
    expect(screen.getByRole("tooltip")).toHaveTextContent("Full set effect"),
  );
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toHaveTextContent("Sockets");
  expect(tooltip).toHaveTextContent("Inactive");
  expect(tooltip.querySelector('[data-socket-index="0"]')).toHaveAttribute(
    "data-socket-color",
    "blue",
  );
  expect(tooltip.querySelector(".compact-tooltip-footer")).toHaveTextContent(
    "Requires Level 80",
  );
  expect(tooltip.querySelector('[data-section="weapon"]')).toHaveTextContent(
    "350 Damage",
  );
  expect(tooltip.querySelector('[data-section="stat"]')).toHaveTextContent(
    "+100 Strength",
  );
});

it("tooltip actions do not bubble into the gear row and Escape dismisses hover from elsewhere", () => {
  const edit = vi.fn();
  render(
    view(
      <div onClick={edit}>
        <ItemLink item={item}>Item</ItemLink>
      </div>,
    ),
  );
  fireEvent.mouseEnter(screen.getByRole("link"));
  fireEvent.click(
    within(screen.getByRole("tooltip")).getByRole("button", {
      name: "Close item details",
    }),
  );
  expect(edit).not.toHaveBeenCalled();
  fireEvent.mouseEnter(screen.getByRole("link"));
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it.each([
  { itemId: 45459, gemIds: [40111], attachments: 1, empty: 0 },
  { itemId: 45459, gemIds: [40111, 0, 0], attachments: 1, empty: 0 },
  { itemId: 45459, gemIds: [], attachments: 1, empty: 1 },
  { itemId: 45459, gemIds: [0, 0, 0], attachments: 1, empty: 1 },
  { itemId: 45931, gemIds: [0, 0, 0], attachments: 0, empty: 0 },
  { itemId: 40881, gemIds: [0, 40111, 0], attachments: 2, empty: 1 },
  { itemId: 40889, gemIds: [40111, 0, 0], attachments: 1, empty: 0 },
])(
  "preserves base and added socket positions for $itemId with $gemIds",
  ({ itemId, gemIds, attachments, empty }) => {
    render(
      view(
        <ItemLink
          item={{
            instanceId: "regression",
            itemId,
            gemIds,
            enchantId: 0,
            source: "equipped",
          }}
        >
          Item
        </ItemLink>,
        "original",
      ),
    );
    fireEvent.focus(screen.getByRole("link", { name: "Item" }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.querySelectorAll("[data-socket-index]")).toHaveLength(
      attachments,
    );
    expect(tooltip.textContent?.match(/Empty socket/g) ?? []).toHaveLength(
      empty,
    );
    if (gemIds.includes(40111))
      expect(tooltip).toHaveTextContent("Bold Cardinal Ruby");
  },
);

it("dismisses a tooltip when page scrolling moves its anchor out of view", () => {
  render(view(<ItemLink item={item}>Item</ItemLink>));
  const link = screen.getByRole("link");
  vi.spyOn(link, "getBoundingClientRect").mockReturnValue({
    top: 100,
    bottom: 120,
    left: 20,
    right: 60,
    width: 40,
    height: 20,
    x: 20,
    y: 100,
    toJSON: () => ({}),
  });
  fireEvent.focus(link);
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  vi.spyOn(link, "getBoundingClientRect").mockReturnValue({
    top: -100,
    bottom: -80,
    left: 20,
    right: 60,
    width: 40,
    height: 20,
    x: 20,
    y: -100,
    toJSON: () => ({}),
  });
  fireEvent.scroll(window);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("shows only the latest tooltip when hover replaces a focused item", () => {
  render(
    view(
      <>
        <ItemLink item={item}>First item</ItemLink>
        <ItemLink item={{ ...item, itemId: 40111, enchantId: 0, gemIds: [] }}>
          Second gem
        </ItemLink>
      </>,
    ),
  );
  fireEvent.focus(screen.getByRole("link", { name: "First item" }));
  fireEvent.mouseEnter(screen.getByRole("link", { name: "Second gem" }));
  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Bold Cardinal Ruby");
});

it("keeps enrichment visible for meta gems with missing activation details", async () => {
  vi.useFakeTimers();
  render(
    view(
      <ItemLink item={{ ...item, itemId: 41285, enchantId: 0, gemIds: [] }}>
        Item
      </ItemLink>,
    ),
  );
  fireEvent.focus(screen.getByRole("link"));
  await act(() => vi.advanceTimersByTimeAsync(120));
  expect(
    screen.getByRole("tooltip").querySelector(".compact-tooltip-loading-dot"),
  ).not.toBeNull();
});

it("uses skeletons only when an item has no local catalog details", async () => {
  vi.useFakeTimers();
  render(
    view(
      <ItemLink item={{ ...item, itemId: 999999, enchantId: 0, gemIds: [] }}>
        Unknown
      </ItemLink>,
    ),
  );
  fireEvent.focus(screen.getByRole("link"));
  await act(() => vi.advanceTimersByTimeAsync(120));
  expect(
    screen.getByRole("tooltip").querySelectorAll(".compact-tooltip-skeleton"),
  ).toHaveLength(4);
});
