import type {
  Diagnostic,
  ItemEnhancementOverride,
  ItemInstance,
  Snapshot,
  TopGearRequest,
} from "@/domain/top-gear/model";
import { GemColor, ItemType, Profession } from "@/generated/wotlk/common";
import type { UIEnchant } from "@/generated/wotlk/ui";
import { getCatalog } from "./catalog";
import { itemSockets } from "./sockets";
import { canEquip, enchantApplies, eligibleSlots } from "./validate";
import { prepareGems } from "./gemming";
import professionRules from "../../../data/wotlk/profession-enhancements.json";
import { prepareEnchants, withEnhancements } from "./enhancements";

/** Profession skill to use the enhancement; ordinary enchants need no profession. */
export function enhancementEnchantRank(enchant: UIEnchant): number | undefined {
  if (!enchant.requiredProfession) return undefined;
  return (
    (professionRules.enchantRanks as Record<string, number>)[
      enchant.effectId
    ] ?? professionRules.defaultProfessionRank
  );
}

/** Validate only explicit fields. Imported values remain the immutable reference. */
export function validateItemEnhancements(
  snapshot: Snapshot,
  item: ItemInstance,
  override: ItemEnhancementOverride,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const catalog = getCatalog(snapshot.itemVersion),
    metadata = catalog.items.get(item.itemId);
  const error = (code: string, field: string, message: string) =>
    diagnostics.push({
      code,
      path: `${item.instanceId}.${field}`,
      severity: "error",
      message,
    });
  if (!metadata) {
    error("unknown-item", "enhancements", `Unknown item ${item.itemId}`);
    return diagnostics;
  }
  const player = snapshot.settings.player!;
  const professions = [player.profession1, player.profession2];
  const requireRank = (profession: Profession, rank: number, field: string) => {
    if (!professions.includes(profession)) {
      error(
        field === "enchantId" ? "profession-enchant" : "profession-gem",
        field,
        `Requires ${Profession[profession]} ${rank}.`,
      );
      return;
    }
    const actual = snapshot.professionLevels?.[profession];
    if (actual === undefined)
      error(
        "profession-rank-unknown",
        field,
        `Verify ${Profession[profession]} rank: this enhancement requires ${rank}.`,
      );
    else if (actual < rank)
      error(
        "profession-rank",
        field,
        `Requires ${Profession[profession]} ${rank}; current rank is ${actual}.`,
      );
  };
  const sockets = itemSockets(snapshot, metadata);
  override.gemIds?.forEach((id, index) => {
    if (id == null) return;
    const field = `gemIds.${index}`;
    if (index >= sockets.length) {
      error(
        "socket",
        field,
        "This socket is unavailable for this item and profession.",
      );
      return;
    }
    if (
      index >= metadata.gemSockets.length &&
      [ItemType.ItemTypeWrist, ItemType.ItemTypeHands].includes(metadata.type)
    )
      requireRank(Profession.Blacksmithing, 400, field);
    if (id === 0) return;
    const gem = catalog.gems.get(id);
    if (!gem) {
      error("unknown-gem", field, `Unknown gem ${id}.`);
      return;
    }
    if (
      (gem.color === GemColor.GemColorMeta) !==
      (sockets[index] === GemColor.GemColorMeta)
    )
      error(
        "socket",
        field,
        "Meta gems require a meta socket; ordinary gems require an ordinary socket.",
      );
    if (gem.requiredProfession)
      requireRank(
        gem.requiredProfession,
        catalog.restrictions?.items[id]?.requiredSkillRank || 1,
        field,
      );
  });
  if (override.enchantId) {
    const enchants = catalog.enchants.get(override.enchantId) ?? [];
    const compatible = enchants.filter((enchant) =>
      enchantApplies(
        { ...enchant, requiredProfession: Profession.ProfessionUnknown },
        metadata,
        snapshot,
      ),
    );
    const enchant =
      compatible.find(
        (enchant) =>
          !enchant.requiredProfession ||
          professions.includes(enchant.requiredProfession),
      ) ?? compatible[0];
    if (!enchant)
      error(
        "enchant",
        "enchantId",
        `Enchant ${override.enchantId} is not legal on ${metadata.name}.`,
      );
    else if (enchant.requiredProfession)
      requireRank(
        enchant.requiredProfession,
        enhancementEnchantRank(enchant)!,
        "enchantId",
      );
  }
  return diagnostics;
}

export function setItemEnhancements(
  request: TopGearRequest,
  instanceId: string,
  override: ItemEnhancementOverride,
): TopGearRequest {
  const item = request.snapshot.inventory.find(
    (item) => item.instanceId === instanceId,
  );
  if (!item) throw new Error("Unknown item instance.");
  const errors = validateItemEnhancements(request.snapshot, item, override);
  if (errors.length) throw new Error(errors[0].message);
  const gemIds = override.gemIds
    ? Array.from(override.gemIds, (gem) => gem ?? null)
    : [];
  while (gemIds.length && gemIds.at(-1) === null) gemIds.pop();
  const normalized: ItemEnhancementOverride = {
    ...(gemIds.length ? { gemIds } : {}),
    ...(override.enchantId !== undefined
      ? { enchantId: override.enchantId }
      : {}),
  };
  const itemEnhancements = { ...request.snapshot.itemEnhancements };
  if (Object.keys(normalized).length) itemEnhancements[instanceId] = normalized;
  else delete itemEnhancements[instanceId];
  return {
    ...request,
    snapshot: {
      ...request.snapshot,
      itemEnhancements: Object.keys(itemEnhancements).length
        ? itemEnhancements
        : undefined,
    },
  };
}

/** A contextual preview: automatic meta/JC choices may adapt in another set. */
export function previewItemEnhancements(
  snapshot: Snapshot,
  item: ItemInstance,
): ItemInstance {
  const metadata = getCatalog(snapshot.itemVersion).items.get(item.itemId);
  if (!metadata) return item;
  const loadout = { ...snapshot.equipped };
  const slot =
    item.equippedSlot ??
    eligibleSlots(metadata).find((slot) => canEquip(snapshot, metadata, slot));
  if (!slot) return item;
  for (const position of eligibleSlots(metadata))
    if (loadout[position] === item.instanceId) loadout[position] = null;
  loadout[slot] = item.instanceId;
  const resolved = withEnhancements(
    snapshot,
    prepareGems(snapshot, loadout, undefined, true).overrides,
    prepareEnchants(snapshot, loadout, undefined, true).overrides,
  );
  return (
    resolved.inventory.find(
      (candidate) => candidate.instanceId === item.instanceId,
    ) ?? item
  );
}
