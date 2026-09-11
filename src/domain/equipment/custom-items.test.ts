import { describe, expect, it } from "vitest";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { getCatalog } from "./catalog";
import {
  addCustomItems,
  removeCustomItem,
  compatibleItems,
  filterItems,
  emptyItemFilters,
  itemSources,
} from "./custom-items";
import {
  decodeDraft,
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import { Race, Profession } from "@/generated/wotlk/common";
import { customInstance } from "./custom-items";
import { validateItem } from "./validate";
import { maxCustomItems } from "./custom-eligibility";
import { prepareEnchants } from "./enhancements";
import { defaultGemming, prepareGems } from "./gemming";

describe("custom candidates", () => {
  it("respects profession ranks, faction and current version restrictions", () => {
    const r = fixtureRequest();
    const catalog = getCatalog(r.snapshot.itemVersion);
    const engineeringHead = [...catalog.items.values()].find(
      (item) =>
        catalog.restrictions?.items[item.id]?.requiredSkill === 202 &&
        item.type === 1 &&
        (!item.classAllowlist.length ||
          item.classAllowlist.includes(r.snapshot.settings.player!.class)) &&
        catalog.restrictions?.items[item.id]?.requiredSkillRank,
    )!;
    expect(engineeringHead).toBeDefined();
    r.snapshot.professionLevels = { [Profession.Engineering]: 1 };
    expect(
      validateItem(
        r.snapshot,
        customInstance(engineeringHead.id),
        catalog,
      ).some((e) => e.code === "custom-ineligible"),
    ).toBe(true);
    r.snapshot.settings.player!.race = Race.RaceHuman;
    expect(
      compatibleItems(r.snapshot, "head", catalog).some((i) => i.id === 47675),
    ).toBe(false);
    const forged = addCustomItems(r, "head", [50712]);
    forged.snapshot.inventory.find((i) => i.source === "custom")!.itemId =
      47675;
    expect(() => validateRequest(encodeRequest(forged))).toThrow(/faction/);
    r.snapshot.professionLevels[Profession.Engineering] = 450;
    expect(
      validateItem(r.snapshot, customInstance(engineeringHead.id), catalog),
    ).toEqual([]);
    const restricted = { ...catalog };
    restricted.unsupportedItemIds = new Set([50712]);
    expect(
      compatibleItems(r.snapshot, "head", restricted).some(
        (i) => i.id === 50712,
      ),
    ).toBe(false);
  });

  it("keeps failed batches atomic and enforces a bounded custom inventory", () => {
    const r = fixtureRequest();
    const before = encodeRequest(r);
    expect(() => addCustomItems(r, "head", [50712, 9999999])).toThrow();
    expect(encodeRequest(r)).toEqual(before);
    const ids = compatibleItems(r.snapshot, "head")
      .filter(
        (i) => !r.snapshot.inventory.some((owned) => owned.itemId === i.id),
      )
      .slice(0, maxCustomItems + 1)
      .map((i) => i.id);
    expect(ids).toHaveLength(maxCustomItems + 1);
    expect(() => addCustomItems(r, "head", ids)).toThrow(/100 custom/);
    const full = addCustomItems(r, "head", ids.slice(0, maxCustomItems));
    expect(
      full.snapshot.inventory.filter((i) => i.source === "custom"),
    ).toHaveLength(maxCustomItems);
    expect(() => addCustomItems(full, "head", ids.slice(-1))).toThrow(
      /100 custom/,
    );
  });
  it("filters the versioned catalog by slot, class, faction and combined query fields", () => {
    const r = fixtureRequest();
    r.snapshot.settings.player!.race = Race.RaceHuman;
    const items = compatibleItems(r.snapshot, "head");
    expect(items.find((i) => i.id === 50712)).toBeDefined();
    expect(items.every((i) => i.type === 1)).toBe(true);
    expect(items.find((i) => i.id === 51312)).toBeUndefined(); // DK-only tier
    expect(items.find((i) => i.id === 48493)).toBeUndefined(); // Horde DK tier
    const found = filterItems(items, {
      ...emptyItemFilters,
      search: "landsoul",
      phase: "4",
      minLevel: "277",
      maxLevel: "277",
      type: "armor:4",
    });
    expect(found.map((i) => i.id)).toEqual([50712]);
    expect(
      filterItems(items, { ...emptyItemFilters, search: "50712" }).map(
        (i) => i.id,
      ),
    ).toEqual([50712]);
    const source = itemSources(found[0], getCatalog(r.snapshot.itemVersion))[0];
    expect(source.label).toContain("Icecrown");
    expect(
      filterItems(found, { ...emptyItemFilters, source: source.key }),
    ).toHaveLength(1);
    expect(
      filterItems(found, {
        ...emptyItemFilters,
        minLevel: "300",
        maxLevel: "200",
      }),
    ).toEqual([]);
  });

  it("adds distinct candidates, selects the batch and retains baseline/settings through serialization", () => {
    const r = fixtureRequest();
    const original = structuredClone(encodeRequest(r));
    const next = addCustomItems(r, "head", [50712, 50072, 50712]);
    const added = next.snapshot.inventory.filter((i) => i.source === "custom");
    expect(added.map((i) => i.itemId)).toEqual([50712, 50072]);
    expect(
      added.every((i) =>
        next.selection.selectedInstanceIds.includes(i.instanceId),
      ),
    ).toBe(true);
    expect(next.snapshot.equipped).toEqual(r.snapshot.equipped);
    expect(encodeRequest(r)).toEqual(original);
    expect(decodeDraft(encodeRequest(next)).snapshot.inventory).toEqual(
      next.snapshot.inventory,
    );
    expect(validateRequest(encodeRequest(next)).snapshot.inventory).toEqual(
      next.snapshot.inventory,
    );
    expect(
      addCustomItems(next, "head", [50712]).snapshot.inventory,
    ).toHaveLength(next.snapshot.inventory.length);
    const removed = removeCustomItem(next, added[0].instanceId);
    expect(removed.snapshot.inventory).not.toContainEqual(added[0]);
    expect(removed.selection.selectedInstanceIds).not.toContain(
      added[0].instanceId,
    );
    expect(removeCustomItem(r, r.snapshot.equipped.head!)).toEqual(r);
  });

  it("uses existing enhancement preparation for new candidates, preserving equipped gear", () => {
    const r = addCustomItems(fixtureRequest(), "head", [50712]);
    r.snapshot.autoEnchant = true;
    r.snapshot.gemming = defaultGemming(r.snapshot);
    const item = r.snapshot.inventory.find((i) => i.source === "custom")!;
    const loadout = { ...r.snapshot.equipped, head: item.instanceId };
    expect(
      prepareEnchants(r.snapshot, loadout).overrides[item.instanceId],
    ).toBeTruthy();
    expect(
      prepareGems(r.snapshot, loadout).overrides[item.instanceId]?.filter(
        Boolean,
      ).length,
    ).toBeGreaterThan(0);
    expect(item.gemIds).toEqual([]);
    expect(item.enchantId).toBe(0);
    expect(prepareEnchants(r.snapshot, r.snapshot.equipped).overrides).toEqual(
      {},
    );
  });

  it("rejects wrong-slot batches and forged custom items at server admission", () => {
    const r = fixtureRequest();
    expect(() => addCustomItems(r, "feet", [50712])).toThrow(/eligible/);
    const next = addCustomItems(r, "head", [50712]);
    const custom = next.snapshot.inventory.find((i) => i.source === "custom")!;
    custom.itemId = 51312;
    expect(() => validateRequest(encodeRequest(next))).toThrow(
      /custom|eligible/i,
    );
    custom.itemId = 9999999;
    expect(() => validateRequest(encodeRequest(next))).toThrow(
      /custom|catalog/i,
    );
    custom.itemId = 50712;
    next.snapshot.equipped.head = custom.instanceId;
    expect(() => validateRequest(encodeRequest(next))).toThrow(/mapping/);
  });
});
