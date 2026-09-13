import { useEffect, useMemo } from "react";
import { GearLabProvider } from "./state/GearLabProvider";
import {
  GearLabRuntimeProvider,
  createGearLabRuntime,
} from "./state/GearLabRuntime";
import { createGearLabStore } from "./state/gear-lab-store";
import type { TopGearRequest } from "@/domain/top-gear/model";
import type { PurchasePreview } from "./purchases/purchase-worker-contract";
import {
  act,
  render,
  screen,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { Race } from "@/generated/wotlk/common";
import inventory from "../../../messages/en-US/inventory.json";
import common from "../../../messages/en-US/common.json";
import diagnostics from "../../../messages/en-US/diagnostics.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { InventorySelector as ConnectedInventorySelector } from "./InventorySelector";

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

it("cannot edit the original custom enhancements while its costed preview is absent", async () => {
  const { purchaseFixture } =
    await import("../../../tests/support/purchase-fixtures");
  const request = purchaseFixture({ frost: 100 });
  request.snapshot.inventory.push({
    instanceId: "custom-shoulders",
    itemId: 50098,
    source: "custom",
    gemIds: [40111],
    enchantId: 3808,
  });
  request.selection.selectedInstanceIds.push("custom-shoulders");
  request.purchases!.itemEnhancements.original = {
    "50098": { gemIds: [0], enchantId: 0 },
  };
  const before = JSON.stringify(request);
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, diagnostics, common }}
    >
      <InventorySelector
        request={request}
        purchasePreview={null}
        onChange={onChange}
      />
    </NextIntlClientProvider>,
  );
  const row = document.querySelector('[data-instance-id="custom-shoulders"]')!;
  expect(row).toHaveTextContent("Uses resources");
  fireEvent.click(row);
  expect(
    screen.queryByRole("button", {
      name: /Edit gems and enchants for Scourgelord/,
    }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(
    row.querySelector(".item-row-copy > .item-tooltip-trigger > a")!,
    { key: " " },
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  for (const field of ["0", "enchant"]) {
    const control = row.querySelector(`[data-enhancement-field="${field}"]`)!;
    fireEvent.click(control);
    fireEvent.keyDown(control, { key: " " });
    fireEvent.keyDown(control, { key: "Enter" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  }
  expect(onChange).not.toHaveBeenCalled();
  expect(JSON.stringify(request)).toBe(before);
});

it("shows only the detected Feral purchase variant", async () => {
  const { purchaseFixture } =
    await import("../../../tests/support/purchase-fixtures");
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
      messages={{ inventory, diagnostics, common }}
    >
      <InventorySelector
        request={request}
        purchasePreview={preview}
        onChange={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  const ids = Array.from(
    document.querySelectorAll(".inventory-row[data-source=purchase]"),
  ).map((row) => row.getAttribute("data-instance-id"));
  expect(
    ids.filter((id) =>
      [
        "purchase-original-50107",
        "purchase-original-50822",
        "purchase-original-50827",
      ].includes(id!),
    ),
  ).toEqual(["purchase-original-50827"]);
  expect(preview.candidates.map((c) => c.instance.instanceId)).toEqual(
    original,
  );
});

it("refreshes an invalid custom item's explanation when its eligibility changes", async () => {
  const { purchaseFixture } =
    await import("../../../tests/support/purchase-fixtures");
  const request = purchaseFixture();
  request.snapshot.settings.player!.race = Race.RaceHuman;
  request.snapshot.inventory.push({
    instanceId: "custom-48503",
    itemId: 48503,
    source: "custom",
    gemIds: [9999999],
    enchantId: 0,
  });
  const store = createGearLabStore(request);
  const runtime = createGearLabRuntime(store);

  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, diagnostics, common }}
    >
      <GearLabProvider store={store}>
        <GearLabRuntimeProvider runtime={runtime}>
          <ConnectedInventorySelector />
        </GearLabRuntimeProvider>
      </GearLabProvider>
    </NextIntlClientProvider>,
  );

  expect(
    screen.getByText(
      "Koltira's Helmet of Conquest is restricted to the other faction",
    ),
  ).toBeVisible();

  act(() => {
    const snapshot = store.getState().draft!.snapshot;
    store.getState().actions.applySettings({
      specId: snapshot.specId,
      settings: {
        ...snapshot.settings,
        player: { ...snapshot.settings.player!, race: Race.RaceOrc },
      },
      provenance: snapshot.provenance,
      professionLevels: snapshot.professionLevels,
    });
  });

  expect(screen.getByText("Unknown gem 9999999")).toBeVisible();
  expect(
    screen.queryByText(
      "Koltira's Helmet of Conquest is restricted to the other faction",
    ),
  ).not.toBeInTheDocument();
});

function InventorySelector({
  request,
  purchasePreview = null,
  onChange,
}: {
  request: TopGearRequest;
  purchasePreview?: PurchasePreview | null;
  onChange: (request: TopGearRequest) => void;
}) {
  const store = useMemo(() => {
    const store = createGearLabStore();
    store.setState({ draft: request });
    return store;
  }, [request]);
  const runtime = useMemo(() => {
    const runtime = createGearLabRuntime(store);
    const value = runtime.session.getSnapshot();
    const snapshot = {
      ...value,
      view: { ...value.view, preview: purchasePreview },
    };
    runtime.session.getSnapshot = () => snapshot;
    return runtime;
  }, [store, purchasePreview]);
  useEffect(
    () =>
      store.subscribe((s) => {
        if (s.draft) onChange(s.draft);
      }),
    [store, onChange],
  );
  return (
    <GearLabProvider store={store}>
      <GearLabRuntimeProvider runtime={runtime}>
        <ConnectedInventorySelector />
      </GearLabRuntimeProvider>
    </GearLabProvider>
  );
}
