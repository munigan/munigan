import { it, expect } from "vitest";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { validateLoadout, validateItem } from "./validate";
it("rejects normal and heroic copies from the same equip-limit category", () => {
  const { snapshot } = fixtureRequest();
  snapshot.inventory.push(
    {
      instanceId: "normal",
      itemId: 50362,
      enchantId: 0,
      gemIds: [],
      source: "bag",
    },
    {
      instanceId: "heroic",
      itemId: 50363,
      enchantId: 0,
      gemIds: [],
      source: "bag",
    },
  );
  const result = validateLoadout(snapshot, {
    ...snapshot.equipped,
    trinket1: "normal",
    trinket2: "heroic",
  });
  expect(result.some((e) => e.code === "equip-category")).toBe(true);
});
it("rejects Classic-only IDs that have no verified 3.3.5 restrictions", () => {
  const { snapshot } = fixtureRequest();
  expect(
    validateItem(snapshot, {
      instanceId: "classic",
      itemId: 211817,
      enchantId: 0,
      gemIds: [],
      source: "bag",
    }).some((e) => e.code === "unverified-item"),
  ).toBe(true);
});
