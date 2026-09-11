import type { Slot } from "@/domain/top-gear/model";
export type InventoryTranslation = (
  key: string,
  values?: Record<string, string | number>,
) => string;
export function slotGroupLabel(slot: Slot, t: InventoryTranslation) {
  return slot.startsWith("finger")
    ? t("slotGroups.rings")
    : slot.startsWith("trinket")
      ? t("slotGroups.trinkets")
      : slot === "mainHand" || slot === "offHand"
        ? t("slotGroups.weapons")
        : t(`slots.${slot}`);
}
