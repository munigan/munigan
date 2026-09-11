import Image from "next/image";
import type { UIEnchant } from "@/generated/wotlk/ui";

export function EnchantImage({
  enchant,
  size = 32,
}: {
  enchant?: UIEnchant;
  size?: number;
}) {
  const spellIcon = enchant?.icon;
  // Some enchant spells reuse recipe artwork. Give those the enchanting
  // symbol while retaining distinct spell, rune and profession icons.
  const icon =
    !spellIcon || /^inv_(?:enchant_|misc_note_|scroll_)/i.test(spellIcon)
      ? "trade_engraving"
      : spellIcon;
  return (
    <span className="item-icon" style={{ width: size, height: size }}>
      <Image
        unoptimized
        src={`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`}
        alt=""
        width={size}
        height={size}
      />
    </span>
  );
}
