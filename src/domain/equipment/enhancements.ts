import type {
  Snapshot,
  Loadout,
  GemOverrides,
  EnchantOverrides,
  Slot,
} from "@/domain/top-gear/model";
import { ItemType, Profession } from "@/generated/wotlk/common";
import { slots } from "@/domain/top-gear/slots";
import { getCatalog, type Catalog } from "./catalog";
import { gearIdentity, interchangeablePairs } from "./identity";
import { enchantApplies } from "./validate";
import { withGemOverrides } from "./gemming";

export const enchantRevision = "enchants-v1";

export function withEnhancements(
  snapshot: Snapshot,
  gems: GemOverrides = {},
  enchants: EnchantOverrides = {},
): Snapshot {
  const gemmed = withGemOverrides(snapshot, gems);
  if (!Object.keys(enchants).length) return gemmed;
  return {
    ...gemmed,
    inventory: gemmed.inventory.map((i) =>
      Object.hasOwn(enchants, i.instanceId)
        ? { ...i, enchantId: enchants[i.instanceId] }
        : i,
    ),
  };
}

export function prepareEnchants(
  snapshot: Snapshot,
  loadout: Loadout,
  catalog: Catalog = getCatalog(snapshot.itemVersion),
  forceCandidate = false,
): { overrides: EnchantOverrides; warnings: string[] } {
  const overrides: EnchantOverrides = {},
    warnings: string[] = [];
  const selected = new Set(Object.values(loadout));
  const manual = Object.entries(snapshot.itemEnhancements ?? {}).filter(
    ([id]) => selected.has(id),
  );
  for (const [id, override] of manual)
    if (override.enchantId !== undefined) overrides[id] = override.enchantId;
  if (
    !snapshot.autoEnchant ||
    (!forceCandidate &&
      !manual.length &&
      gearIdentity(snapshot, loadout) ===
        gearIdentity(snapshot, snapshot.equipped))
  )
    return { overrides, warnings };
  const inventory = new Map(snapshot.inventory.map((i) => [i.instanceId, i]));
  const player = snapshot.settings.player!;
  const professions = [player.profession1, player.profession2];
  const caster = [
    "balance_druid",
    "elemental_shaman",
    "mage",
    "shadow_priest",
    "smite_priest",
    "warlock",
  ].includes(snapshot.specId.split(":")[0]);
  const qualified = (profession: Profession, minimum = 400) =>
    professions.includes(profession) &&
    (snapshot.professionLevels?.[profession] ?? 450) >= minimum;
  const defaults: Array<[ItemType, Profession, number, number?]> = [
    [ItemType.ItemTypeFinger, Profession.Enchanting, caster ? 3840 : 3839],
    [ItemType.ItemTypeWrist, Profession.Leatherworking, caster ? 3758 : 3756],
    [ItemType.ItemTypeShoulder, Profession.Inscription, caster ? 3838 : 3835],
    [ItemType.ItemTypeBack, Profession.Tailoring, caster ? 3722 : 3730],
    [ItemType.ItemTypeHands, Profession.Engineering, 3604],
    [ItemType.ItemTypeFeet, Profession.Engineering, 3606, 405],
    [ItemType.ItemTypeBack, Profession.Engineering, caster ? 3859 : 3605],
  ];
  for (const slot of slots) {
    const item = inventory.get(loadout[slot] ?? "");
    if (!item || item.enchantId || Object.hasOwn(overrides, item.instanceId))
      continue;
    const metadata = catalog.items.get(item.itemId);
    if (!metadata) continue;
    const applicable = (id: number) =>
      id > 0 &&
      (catalog.enchants.get(id) ?? []).some((e) =>
        enchantApplies(e, metadata, snapshot),
      );
    const pair = interchangeablePairs.find((p) =>
      (p as readonly Slot[]).includes(slot),
    );
    // Paired accessories have no positional enchant semantics. Using the same
    // reference order for either slot avoids ring-order-only DPS differences.
    const sourceSlots: Slot[] = pair ? [...pair] : [slot];
    // A missing weapon enchant can fall back to the other equipped weapon,
    // only if the catalog permits it on this weapon/shield/staff type.
    if (slot === "mainHand") sourceSlots.push("offHand");
    if (slot === "offHand") sourceSlots.push("mainHand");
    const sourceIds = sourceSlots.map(
      (s) => inventory.get(snapshot.equipped[s] ?? "")?.enchantId ?? 0,
    );
    const copied = sourceIds.find(applicable);
    const fallback = defaults.find(
      ([type, profession, id, rank]) =>
        type === metadata.type && qualified(profession, rank) && applicable(id),
    );
    const enchant = copied ?? fallback?.[2];
    if (enchant) overrides[item.instanceId] = enchant;
    else if (sourceIds.some(Boolean))
      warnings.push(
        `${metadata.name}: no compatible equipped enchant could be copied; simulated without an enchant.`,
      );
  }
  return { overrides, warnings };
}
