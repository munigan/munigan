import type { Snapshot } from "@/domain/top-gear/model";
import { getPurchaseCatalog } from "./catalog";
import { itemVersionOf } from "@/domain/top-gear/item-version";
export const variantByModule: Readonly<Record<string, string>> = {
  balance_druid: "druid-balance",
  feral_druid: "druid-feral",
  elemental_shaman: "shaman-elemental",
  enhancement_shaman: "shaman-enhancement",
  hunter: "hunter-dps",
  mage: "mage-dps",
  rogue: "rogue-dps",
  retribution_paladin: "paladin-retribution",
  shadow_priest: "priest-shadow",
  warlock: "warlock-dps",
  warrior: "warrior-dps",
  deathknight: "dk-dps",
};

export function purchaseVariants(snapshot: Snapshot): string[] {
  return [
    ...new Set(
      getPurchaseCatalog(itemVersionOf(snapshot))
        .recipes.filter((r) => r.classId === snapshot.settings.player!.class)
        .map((r) => r.setVariant),
    ),
  ];
}
export function defaultPurchaseVariant(snapshot: Snapshot): string | undefined {
  const variant = variantByModule[snapshot.specId.split(":")[0]];
  return purchaseVariants(snapshot).includes(variant) ? variant : undefined;
}
