import type { Snapshot } from "@/domain/top-gear/model";
import type { UIItem } from "@/generated/wotlk/ui";
import { Profession } from "@/generated/wotlk/common";
import { getCatalog } from "@/domain/equipment/catalog";
import { enchantApplies } from "@/domain/equipment/validate";

/** Slot/type options include unavailable professions so requirements remain discoverable. */
export function itemEnchantOptions(snapshot: Snapshot, item: UIItem) {
  return [...getCatalog(snapshot.itemVersion).enchants.values()].flatMap(
    (entries) => {
      const enchant = entries.find((entry) =>
        enchantApplies(
          {
            ...entry,
            requiredProfession: Profession.ProfessionUnknown,
            classAllowlist: [],
          },
          item,
          snapshot,
        ),
      );
      return enchant ? [enchant] : [];
    },
  );
}
