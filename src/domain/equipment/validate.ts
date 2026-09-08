import {
  ItemType,
  HandType,
  WeaponType,
  Class,
  Profession,
  GemColor,
  EnchantType,
  RangedWeaponType,
} from "@/generated/wotlk/common";
import type { UIItem, UIEnchant } from "@/generated/wotlk/ui";
import type {
  Snapshot,
  Slot,
  Loadout,
  Diagnostic,
  ItemInstance,
} from "@/domain/top-gear/model";
import { slots } from "@/domain/top-gear/slots";
import rules from "../../../data/wotlk/equipment-rules.json";
import { getCatalog, type Catalog } from "./catalog";
import { readTalents } from "@/features/settings/talents";
export function eligibleSlots(item: UIItem): Slot[] {
  if (item.type === ItemType.ItemTypeFinger) return ["finger1", "finger2"];
  if (item.type === ItemType.ItemTypeTrinket) return ["trinket1", "trinket2"];
  if (item.type === ItemType.ItemTypeRanged) return ["ranged"];
  if (item.type === ItemType.ItemTypeWeapon)
    return item.handType === HandType.HandTypeMainHand
      ? ["mainHand"]
      : item.handType === HandType.HandTypeOffHand
        ? ["offHand"]
        : ["mainHand", "offHand"];
  return item.type >= 1 && item.type <= 10 ? [slots[item.type - 1]] : [];
}
export function canEquip(
  snapshot: Snapshot,
  item: UIItem,
  slot: Slot,
): boolean {
  const player = snapshot.settings.player!,
    classId = player.class;
  const professions = [player.profession1, player.profession2];
  if (
    !eligibleSlots(item).includes(slot) ||
    (item.classAllowlist.length && !item.classAllowlist.includes(classId)) ||
    (item.requiredProfession && !professions.includes(item.requiredProfession))
  )
    return false;
  if (item.type === ItemType.ItemTypeWeapon) {
    const types =
      (
        rules.classToEligibleWeaponTypes as Record<
          string,
          Array<{ weaponType: number; canUseTwoHand?: boolean }>
        >
      )[classId] ?? [];
    const type = types.find((t) => t.weaponType === item.weaponType);
    if (!type) return false;
    if (item.handType === HandType.HandTypeTwoHand && !type.canUseTwoHand)
      return false;
    if (
      slot === "offHand" &&
      ![WeaponType.WeaponTypeShield, WeaponType.WeaponTypeOffHand].includes(
        item.weaponType,
      )
    ) {
      if (
        ![
          Class.ClassWarrior,
          Class.ClassRogue,
          Class.ClassHunter,
          Class.ClassDeathknight,
        ].includes(classId) &&
        !(classId === Class.ClassShaman && readTalents(snapshot).dualWield)
      )
        return false;
      if (
        item.handType === HandType.HandTypeTwoHand &&
        !readTalents(snapshot).titansGrip
      )
        return false;
    }
  } else if (item.type === ItemType.ItemTypeRanged) {
    if (
      !(
        (rules.classToEligibleRangedWeaponTypes as Record<string, number[]>)[
          classId
        ] ?? []
      ).includes(item.rangedWeaponType)
    )
      return false;
  } else if (
    item.armorType >
    ((rules.classToMaxArmorType as Record<string, number>)[classId] ?? 0)
  )
    return false;
  return true;
}
function enchantApplies(enchant: UIEnchant, item: UIItem, snapshot: Snapshot) {
  const p = snapshot.settings.player!;
  if (
    enchant.classAllowlist.length &&
    !enchant.classAllowlist.includes(p.class)
  )
    return false;
  if (
    enchant.requiredProfession &&
    ![p.profession1, p.profession2].includes(enchant.requiredProfession)
  )
    return false;
  if (![enchant.type, ...enchant.extraTypes].includes(item.type)) return false;
  if (
    enchant.enchantType === EnchantType.EnchantTypeTwoHand &&
    item.handType !== HandType.HandTypeTwoHand
  )
    return false;
  if (
    (enchant.enchantType === EnchantType.EnchantTypeShield) !==
    (item.weaponType === WeaponType.WeaponTypeShield)
  )
    return false;
  if (
    enchant.enchantType === EnchantType.EnchantTypeStaff &&
    item.weaponType !== WeaponType.WeaponTypeStaff
  )
    return false;
  if (item.weaponType === WeaponType.WeaponTypeOffHand) return false;
  if (
    item.type === ItemType.ItemTypeRanged &&
    ![
      RangedWeaponType.RangedWeaponTypeBow,
      RangedWeaponType.RangedWeaponTypeCrossbow,
      RangedWeaponType.RangedWeaponTypeGun,
    ].includes(item.rangedWeaponType)
  )
    return false;
  return true;
}
export function validateItem(
  snapshot: Snapshot,
  instance: ItemInstance,
  catalog: Catalog = getCatalog(),
): Diagnostic[] {
  const errors: Diagnostic[] = [];
  const error = (code: string, message: string) =>
    errors.push({
      code,
      message,
      path: instance.instanceId,
      severity: "error",
    });
  const item = catalog.items.get(instance.itemId);
  if (!item) {
    error(
      "unknown-item",
      `Item ${instance.itemId} is not in the pinned simulator catalog`,
    );
    return errors;
  }
  if (catalog.restrictions && !catalog.restrictions.items[instance.itemId])
    error(
      "unverified-item",
      `${item.name} has no verified 3.3.5 equipment rules`,
    );
  const p = snapshot.settings.player!,
    professions = [p.profession1, p.profession2];
  if (!eligibleSlots(item).some((slot) => canEquip(snapshot, item, slot)))
    error("ineligible", `${item.name} is not eligible for this character`);
  if (
    instance.enchantId &&
    !(catalog.enchants.get(instance.enchantId) ?? []).some((e) =>
      enchantApplies(e, item, snapshot),
    )
  )
    error(
      "enchant",
      `Enchant ${instance.enchantId} is not legal on ${item.name}`,
    );
  const sockets = [...item.gemSockets];
  if (
    item.type === ItemType.ItemTypeWaist ||
    (professions.includes(Profession.Blacksmithing) &&
      [ItemType.ItemTypeWrist, ItemType.ItemTypeHands].includes(item.type))
  )
    sockets.push(GemColor.GemColorPrismatic);
  instance.gemIds.forEach((id, i) => {
    if (!id) return;
    const gem = catalog.gems.get(id);
    if (!gem) {
      error("unknown-gem", `Unknown gem ${id}`);
      return;
    }
    if (
      i >= sockets.length ||
      (sockets[i] === GemColor.GemColorMeta) !==
        (gem.color === GemColor.GemColorMeta)
    )
      error("socket", `Gem ${id} does not fit its socket`);
    if (gem.requiredProfession && !professions.includes(gem.requiredProfession))
      error("profession-gem", `Gem ${id} requires its profession`);
  });
  return errors;
}
export function validateLoadout(
  snapshot: Snapshot,
  loadout: Loadout,
  catalog: Catalog = getCatalog(),
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const physical = new Set<string>(),
    unique = new Set<number>(),
    uniqueGems = new Set<number>();
  let jc = 0;
  const instances = new Map(snapshot.inventory.map((i) => [i.instanceId, i]));
  const categoryCounts = new Map<number, number>();
  const addCategory = (itemId: number, path: string) => {
    const restriction = catalog.restrictions?.items[itemId];
    if (!restriction?.category) return;
    const category = catalog.restrictions?.categories[restriction.category];
    if (!category) return;
    const count = (categoryCounts.get(restriction.category) ?? 0) + 1;
    categoryCounts.set(restriction.category, count);
    if (count > category.quantity)
      diagnostics.push({
        code: "equip-category",
        path,
        severity: "error",
        message: `${category.name}: at most ${category.quantity} equipped`,
      });
  };
  const error = (path: string, message: string) =>
    diagnostics.push({
      code: "invalid-loadout",
      path,
      message,
      severity: "error",
    });
  for (const slot of slots) {
    const id = loadout[slot];
    if (id === null) continue;
    const instance = instances.get(id);
    if (!instance) {
      error(slot, "Unknown item instance");
      continue;
    }
    if (physical.has(id))
      error(slot, "One physical item cannot occupy two slots");
    physical.add(id);
    const item = catalog.items.get(instance.itemId);
    diagnostics.push(...validateItem(snapshot, instance, catalog));
    if (!item) continue;
    if (!canEquip(snapshot, item, slot))
      error(slot, `${item.name} cannot occupy ${slot}`);
    addCategory(item.id, slot);
    if (
      (item.unique ||
        catalog.restrictions?.items[item.id]?.uniqueEquipped ||
        catalog.restrictions?.items[item.id]?.maxOwned === 1) &&
      unique.has(item.id)
    )
      error(slot, "Unique-equipped item conflict");
    unique.add(item.id);
    for (const gemId of instance.gemIds) {
      const gem = catalog.gems.get(gemId);
      if (!gem) continue;
      addCategory(gemId, slot);
      if (gem.unique && uniqueGems.has(gemId))
        error(slot, "Unique gem conflict");
      if (gem.unique) uniqueGems.add(gemId);
      if (gem.requiredProfession === Profession.Jewelcrafting) jc++;
    }
  }
  if (jc > 3) error("gems", "At most three Jewelcrafting gems may be equipped");
  const main = instances.get(loadout.mainHand ?? ""),
    off = instances.get(loadout.offHand ?? "");
  if (main && off) {
    const mh = catalog.items.get(main.itemId),
      oh = catalog.items.get(off.itemId);
    const titan = !!readTalents(snapshot).titansGrip;
    if (
      [mh, oh].some(
        (i) =>
          i?.handType === HandType.HandTypeTwoHand &&
          (!titan ||
            [WeaponType.WeaponTypePolearm, WeaponType.WeaponTypeStaff].includes(
              i.weaponType,
            )),
      )
    )
      error("offHand", "This weapon pair cannot be equipped together");
  }
  return diagnostics;
}
