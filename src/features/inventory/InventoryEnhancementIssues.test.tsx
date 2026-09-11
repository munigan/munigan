import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import inventory from "../../../messages/en-US/inventory.json";
import diagnostics from "../../../messages/en-US/diagnostics.json";
import common from "../../../messages/en-US/common.json";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { Profession } from "@/generated/wotlk/common";
import { defaultGemming } from "@/domain/equipment/gemming";
import { analyzeItemEnhancementSets } from "@/domain/equipment/enumerate";
import { InventoryEnhancementIssues } from "./InventoryEnhancementIssues";

afterEach(cleanup);
it("explains a real JC conflict and explicitly resets an affected item without changing imported gear", () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  s.professionLevels = {
    [Profession.Jewelcrafting]: 450,
    [Profession.Engineering]: 450,
  };
  s.gemming = defaultGemming(s);
  const legs = s.inventory.find((i) => i.equippedSlot === "legs")!;
  const chest = s.inventory.find((i) => i.equippedSlot === "chest")!;
  const belt = s.inventory.find((i) => i.equippedSlot === "waist")!;
  s.itemEnhancements = {
    [legs.instanceId]: { gemIds: [42142, 42142] },
    [chest.instanceId]: { gemIds: [42142] },
    [belt.instanceId]: { gemIds: [42142] },
  };
  const analysis = analyzeItemEnhancementSets(s, request.selection);
  expect(analysis.validCount).toBe(0);
  expect(analysis.excludedCount).toBe(1);
  const onChange = vi.fn(),
    onEdit = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, diagnostics, common }}
    >
      <InventoryEnhancementIssues
        request={request}
        analysis={analysis}
        onChange={onChange}
        onEdit={onEdit}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText(/0 valid sets · 1 combinations/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Review conflicts" }));
  expect(screen.getByText(/At most three Jewelcrafting gems/)).toBeVisible();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Edit item" })[0],
  );
  expect(onEdit).toHaveBeenCalled();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Reset item" })[0],
  );
  const updated = onChange.mock.calls[0][0];
  expect(updated.snapshot.inventory).toEqual(s.inventory);
  expect(updated.selection).toEqual(request.selection);
  expect(Object.keys(updated.snapshot.itemEnhancements)).toHaveLength(2);
  expect(
    analyzeItemEnhancementSets(updated.snapshot, updated.selection).validCount,
  ).toBe(1);
});
