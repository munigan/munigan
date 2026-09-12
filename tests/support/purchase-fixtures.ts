import versions from "../../data/wotlk/versions.json";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import { emptyLoadout } from "@/domain/top-gear/slots";
import { itemVersions } from "@/domain/top-gear/item-version";
import { Race } from "@/generated/wotlk/common";
import { getPurchaseCatalog } from "@/domain/purchases/catalog";
import type { ResourceAmounts } from "@/domain/purchases/model";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";

export const purchasePolicy: WorkPolicy = {
  version: "purchase-test",
  unitsPerSet: 20,
  maxUnits: 20000,
  iterationsPerSet: 20,
  maxSearchNodes: 100000,
  maxJobSeconds: 60,
  maxAttempts: 1,
};
export function purchaseFixture(
  balances: ResourceAmounts = {},
): TopGearRequest {
  const spec = listSpecs().find(
    (s) => s.module === "deathknight" && /frost/i.test(s.name),
  )!;
  const settings = defaultSettings(spec.id);
  settings.player!.race = Race.RaceOrc;
  return {
    tool: "top-gear",
    precision: "standard",
    snapshot: {
      id: "purchase-test",
      specId: spec.id,
      versions: { ...versions },
      itemVersion: "original",
      itemDataRevision: itemVersions.original.revision,
      settings,
      provenance: {},
      inventory: [
        {
          instanceId: "owned-legs",
          itemId: 48504,
          source: "equipped",
          equippedSlot: "legs",
          gemIds: [],
          enchantId: 0,
        },
      ],
      equipped: { ...emptyLoadout(), legs: "owned-legs" },
    },
    selection: {
      selectedInstanceIds: ["owned-legs"],
      lockedSlots: {},
      acknowledgedExclusions: [],
    },
    purchases: {
      version: 1,
      recipeRevision: getPurchaseCatalog("original").revision,
      balances: { ...balances },
      excludedItemIds: {},
      itemEnhancements: {},
    },
  };
}
