import {
  ArmorType,
  WeaponType,
  RangedWeaponType,
} from "@/generated/wotlk/common";
import { DungeonDifficulty, type UIItem } from "@/generated/wotlk/ui";
import type {
  ItemInstance,
  Slot,
  Snapshot,
  TopGearRequest,
} from "@/domain/top-gear/model";
import { slotNames } from "@/domain/top-gear/slots";
import { getCatalog, type Catalog } from "./catalog";
import { canEquip, validateItem } from "./validate";
import { maxCustomItems, maxInventoryItems } from "./custom-eligibility";
import { compareSpecItems } from "./item-relevance";

export function slotGroup(slot: Slot): Slot[] {
  if (slot === "finger1" || slot === "finger2") return ["finger1", "finger2"];
  if (slot === "trinket1" || slot === "trinket2")
    return ["trinket1", "trinket2"];
  if (slot === "mainHand" || slot === "offHand") return ["mainHand", "offHand"];
  return [slot];
}
export function slotGroupName(slot: Slot) {
  return slotGroup(slot).length === 1
    ? slotNames[slot]
    : slot.startsWith("finger")
      ? "Rings"
      : slot.startsWith("trinket")
        ? "Trinkets"
        : "Weapons";
}
export function customInstance(itemId: number): ItemInstance {
  return {
    instanceId: `custom-${itemId}`,
    itemId,
    enchantId: 0,
    gemIds: [],
    source: "custom",
  };
}
export function compatibleItems(
  snapshot: Snapshot,
  slot: Slot,
  catalog = getCatalog(snapshot.itemVersion),
) {
  return [...catalog.items.values()].filter(
    (item) =>
      slotGroup(slot).some((s) => canEquip(snapshot, item, s)) &&
      !validateItem(snapshot, customInstance(item.id), catalog).length,
  );
}

export type ItemFilters = {
  search: string;
  phase: string;
  minLevel: string;
  maxLevel: string;
  source: string;
  type: string;
  sort: string;
};
export const emptyItemFilters: ItemFilters = {
  search: "",
  phase: "all",
  minLevel: "",
  maxLevel: "",
  source: "all",
  type: "all",
  sort: "relevance",
};
export function itemType(item: UIItem) {
  if (item.weaponType)
    return {
      key: `weapon:${item.weaponType}`,
      label: WeaponType[item.weaponType]
        .replace("WeaponType", "")
        .replace("OffHand", "Off-hand"),
    };
  if (item.rangedWeaponType)
    return {
      key: `ranged:${item.rangedWeaponType}`,
      label: RangedWeaponType[item.rangedWeaponType].replace(
        "RangedWeaponType",
        "",
      ),
    };
  return {
    key: `armor:${item.armorType}`,
    label: ArmorType[item.armorType].replace("ArmorType", ""),
  };
}
const difficulties: Partial<Record<DungeonDifficulty, string>> = {
  [DungeonDifficulty.DifficultyNormal]: "Normal",
  [DungeonDifficulty.DifficultyHeroic]: "Heroic",
  [DungeonDifficulty.DifficultyRaid10]: "10-player",
  [DungeonDifficulty.DifficultyRaid25]: "25-player",
  [DungeonDifficulty.DifficultyRaid10H]: "10-player Heroic",
  [DungeonDifficulty.DifficultyRaid25H]: "25-player Heroic",
};
export function itemSources(
  item: UIItem,
  catalog: Pick<Catalog, "zones" | "npcs">,
) {
  return item.sources.flatMap(({ source }) => {
    switch (source.oneofKind) {
      case "drop":
        return [
          {
            key: `zone:${source.drop.zoneId}`,
            label:
              catalog.zones?.get(source.drop.zoneId)?.name ??
              "Dungeon / raid drop",
            detail: [
              difficulties[source.drop.difficulty],
              source.drop.category,
              source.drop.otherName ||
                catalog.npcs?.get(source.drop.npcId)?.name,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ];
      case "crafted":
        return [{ key: "crafted", label: "Crafted", detail: "" }];
      case "quest":
        return [{ key: "quest", label: "Quest", detail: source.quest.name }];
      case "soldBy":
        return [
          { key: "vendor", label: "Vendor", detail: source.soldBy.npcName },
        ];
      case "rep":
        return [{ key: "reputation", label: "Reputation", detail: "" }];
      default:
        return [];
    }
  });
}
export function filterItems(
  items: UIItem[],
  filters: ItemFilters,
  specModule?: string,
) {
  const terms = filters.search
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return items
    .filter(
      (item) =>
        terms.every(
          (term) =>
            item.name.toLocaleLowerCase().includes(term) ||
            String(item.id).includes(term),
        ) &&
        (filters.phase === "all" || item.phase === Number(filters.phase)) &&
        (!filters.minLevel || item.ilvl >= Number(filters.minLevel)) &&
        (!filters.maxLevel || item.ilvl <= Number(filters.maxLevel)) &&
        (filters.type === "all" || itemType(item).key === filters.type) &&
        (filters.source === "all" ||
          itemSources(item, {}).some(
            (source) => source.key === filters.source,
          )),
    )
    .sort(
      (a, b) =>
        (filters.sort === "relevance" && specModule
          ? compareSpecItems(a, b, specModule)
          : filters.sort === "name"
            ? a.name.localeCompare(b.name)
            : filters.sort === "level-asc"
              ? a.ilvl - b.ilvl
              : b.ilvl - a.ilvl) ||
        a.name.localeCompare(b.name) ||
        a.id - b.id,
    );
}

export function addCustomItems(
  request: TopGearRequest,
  slot: Slot,
  itemIds: number[],
): TopGearRequest {
  const { snapshot, selection } = request;
  const catalog = getCatalog(snapshot.itemVersion);
  const owned = new Set(snapshot.inventory.map((i) => i.itemId));
  const additions = [...new Set(itemIds)]
    .filter((id) => !owned.has(id))
    .map((id) => {
      const item = catalog.items.get(id),
        instance = customInstance(id);
      if (
        !item ||
        !slotGroup(slot).some((s) => canEquip(snapshot, item, s)) ||
        validateItem(snapshot, instance, catalog).length
      )
        throw new Error(
          `Item ${id} is not eligible for this slot and character`,
        );
      if (snapshot.inventory.some((i) => i.instanceId === instance.instanceId))
        throw new Error(
          "This candidate ID is already in use. Import the character again.",
        );
      return instance;
    });
  if (
    snapshot.inventory.filter((i) => i.source === "custom").length +
      additions.length >
      maxCustomItems ||
    snapshot.inventory.length + additions.length > maxInventoryItems
  )
    throw new Error(
      `You can add up to ${maxCustomItems} custom items. Remove a custom item to make room.`,
    );
  return {
    ...request,
    snapshot: { ...snapshot, inventory: [...snapshot.inventory, ...additions] },
    selection: {
      ...selection,
      selectedInstanceIds: [
        ...selection.selectedInstanceIds,
        ...additions.map((i) => i.instanceId),
      ],
    },
  };
}
export function removeCustomItem(
  request: TopGearRequest,
  instanceId: string,
): TopGearRequest {
  if (
    !request.snapshot.inventory.some(
      (i) => i.instanceId === instanceId && i.source === "custom",
    ) ||
    Object.values(request.snapshot.equipped).includes(instanceId)
  )
    return request;
  return {
    ...request,
    snapshot: {
      ...request.snapshot,
      itemEnhancements: request.snapshot.itemEnhancements
        ? Object.fromEntries(
            Object.entries(request.snapshot.itemEnhancements).filter(
              ([id]) => id !== instanceId,
            ),
          )
        : undefined,
      inventory: request.snapshot.inventory.filter(
        (i) => i.instanceId !== instanceId,
      ),
    },
    selection: {
      ...request.selection,
      selectedInstanceIds: request.selection.selectedInstanceIds.filter(
        (id) => id !== instanceId,
      ),
      acknowledgedExclusions: request.selection.acknowledgedExclusions.filter(
        (id) => id !== instanceId,
      ),
      lockedSlots: Object.fromEntries(
        Object.entries(request.selection.lockedSlots).filter(
          ([, id]) => id !== instanceId,
        ),
      ),
    },
  };
}
