import type { ItemEnhancementOverride } from "@/domain/top-gear/model";

/** Preview resetting one field while retaining the other pending manual choices. */
export function automaticFieldOverride(
  override: ItemEnhancementOverride,
  field: number | "enchant",
): ItemEnhancementOverride {
  if (field === "enchant") {
    const next = { ...override };
    delete next.enchantId;
    return next;
  }
  const gemIds = [...(override.gemIds ?? [])];
  if (field < gemIds.length) gemIds[field] = null;
  return { ...override, gemIds };
}
