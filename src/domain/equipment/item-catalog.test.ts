import { expect, it } from "vitest";
import { getCatalog } from "./catalog";
import { Stat } from "@/generated/wotlk/common";
import { itemVersions } from "@/domain/top-gear/item-version";
import original from "../../../data/wotlk/original-items.json";

it("uses independent original and Classic Mjolnir stats", () => {
  const classic = getCatalog("classic").items.get(45931)!;
  const originalItem = getCatalog("original").items.get(45931)!;
  expect(originalItem.ilvl).toBe(226);
  expect(originalItem.stats[Stat.StatMeleeCrit]).toBe(102);
  expect(classic.ilvl).toBe(239);
  expect(classic.stats[Stat.StatMeleeCrit]).toBe(115);
  expect(getCatalog().items.get(45931)?.ilvl).toBe(239);
  expect(original.revision).toBe(itemVersions.original.revision);
});
