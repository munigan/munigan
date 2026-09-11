import { GemColor, ItemType, Profession } from "@/generated/wotlk/common";
import type { UIItem } from "@/generated/wotlk/ui";
import type { Snapshot } from "@/domain/top-gear/model";

export function itemSockets(snapshot: Snapshot, item: UIItem) {
  const sockets = [...item.gemSockets];
  const p = snapshot.settings.player!;
  // Same extra-socket assumptions as the pinned simulator: buckle on belts and
  // profession sockets on blacksmith wrists/gloves.
  if (
    item.type === ItemType.ItemTypeWaist ||
    ([p.profession1, p.profession2].includes(Profession.Blacksmithing) &&
      (snapshot.professionLevels?.[Profession.Blacksmithing] ?? 450) >= 400 &&
      [ItemType.ItemTypeWrist, ItemType.ItemTypeHands].includes(item.type))
  )
    sockets.push(GemColor.GemColorPrismatic);
  return sockets;
}

export function extraSocketLabel(item: UIItem | undefined, gemCount: number) {
  if (!item || gemCount <= item.gemSockets.length) return null;
  if (item.type === ItemType.ItemTypeWaist) return "Eternal Belt Buckle";
  if ([ItemType.ItemTypeWrist, ItemType.ItemTypeHands].includes(item.type))
    return "Blacksmith socket";
  return null;
}

export const colorParts: Partial<Record<GemColor, number>> = {
  [GemColor.GemColorRed]: 1,
  [GemColor.GemColorYellow]: 2,
  [GemColor.GemColorBlue]: 4,
  [GemColor.GemColorOrange]: 3,
  [GemColor.GemColorPurple]: 5,
  [GemColor.GemColorGreen]: 6,
  [GemColor.GemColorPrismatic]: 7,
};
export function matchesSocket(gem: GemColor | undefined, socket: GemColor) {
  if (socket === GemColor.GemColorMeta) return gem === socket;
  return !!((colorParts[gem ?? 0] ?? 0) & (colorParts[socket] ?? 0));
}
