import { expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { getCatalog } from "@/domain/equipment/catalog";
import en from "../../../messages/en-US/inventory.json";
import { localTooltipLines } from "./local-tooltip-lines";
import type { InventoryTranslation } from "./item-labels";
const t = createTranslator({
  locale: "en-US",
  messages: en,
}) as InventoryTranslation;
it("formats the reported chest into service-compatible slot, base stat, and effect rows", () => {
  const gear = getCatalog().items.get(47425)!;
  const lines = localTooltipLines(gear, undefined, [], t, "en-US");
  expect(lines[0]).toEqual({ kind: "slot", text: "Chest", rightText: "Cloth" });
  expect(lines.find((l) => l.text === "347 Armor")?.kind).toBe("stat");
  expect(lines.find((l) => l.text === "+116 Stamina")?.kind).toBe("stat");
  expect(lines.find((l) => l.text.includes("151"))?.kind).toBe("effect");
  expect(lines.filter((l) => l.text.includes("86"))).toHaveLength(1);
  expect(
    lines.some((l) => l.kind === "binding" || l.kind === "requirement"),
  ).toBe(false);
});
it("uses paired weapon values and keeps gem bonuses out of equipment effects", () => {
  const catalog = getCatalog();
  const lines = localTooltipLines(
    catalog.items.get(47528),
    undefined,
    [],
    t,
    "en-US",
  );
  expect(lines.find((l) => l.kind === "weapon")?.rightText).toContain("Speed");
  const gem = localTooltipLines(
    undefined,
    catalog.gems.get(40112),
    [],
    t,
    "en-US",
  );
  expect(gem).toEqual([{ kind: "stat", text: "+20 Agility" }]);
});
