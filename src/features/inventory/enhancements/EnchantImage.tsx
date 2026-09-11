import Image from "next/image";
import type { UIEnchant } from "@/generated/wotlk/ui";
import { getCatalog } from "@/domain/equipment/catalog";
import { useItemVersion } from "../ItemVersionContext";

export function EnchantImage({
  enchant,
  size = 32,
}: {
  enchant?: UIEnchant;
  size?: number;
}) {
  const catalog = getCatalog(useItemVersion());
  const icon =
    (enchant && catalog.icons?.get(enchant.itemId)?.icon) ||
    enchant?.icon ||
    "inv_enchant_formulagood_01";
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
