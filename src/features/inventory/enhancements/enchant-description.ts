import type { UIEnchant } from "@/generated/wotlk/ui";
import type { InventoryTranslation } from "../item-labels";
import { statLines } from "../stat-labels";

// Verified against .cache/wotlk/sim/common/wotlk/enchant_effects.go in the pinned simulator.
const effectKeys: Record<number, string> = {
  3604: "hyperspeed",
  3789: "berserking",
  3790: "blackMagic",
  3722: "lightweave",
  3730: "swordguard",
};

export function enchantDescription(
  enchant: UIEnchant,
  t: InventoryTranslation,
  locale: string,
) {
  const effect = effectKeys[enchant.effectId];
  return (
    [
      ...statLines(enchant.stats, t, locale),
      ...(effect ? [t(`editor.enchantEffects.${effect}`)] : []),
    ].join(" · ") || t("editor.enchantEffect")
  );
}
