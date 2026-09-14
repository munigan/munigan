import type { PurchaseRecipe } from "@/domain/purchases/model";
import { listSpecs } from "@/features/settings/registry";

// Exact catalog counterparts for the supported DPS modules. Smite has no
// corresponding tier variant; it and unregistered specs retain source order.
import { variantByModule } from "@/domain/purchases/variants";

/** Presentation only: stable priority within slot/quality, preserving other rows. */
export function orderPurchaseVariants<T>(
  items: readonly T[],
  recipeFor: (item: T) => PurchaseRecipe | undefined,
  specId: string,
  classId: number,
): T[] {
  const spec = listSpecs().find(
    (s) => s.id === specId && s.classId === classId,
  );
  const preferred = spec && variantByModule[spec.module];
  if (!preferred) return [...items];
  const groups = new Map<string, { positions: number[]; items: T[] }>();
  items.forEach((item, index) => {
    const recipe = recipeFor(item);
    if (!recipe || recipe.classId !== classId) return;
    const key = `${recipe.tier}:${recipe.itemLevel}:${recipe.slot}`;
    const group = groups.get(key) ?? { positions: [], items: [] };
    group.positions.push(index);
    group.items.push(item);
    groups.set(key, group);
  });
  const result = [...items];
  for (const group of groups.values()) {
    group.items.sort(
      (a, b) =>
        Number(recipeFor(b)!.setVariant === preferred) -
        Number(recipeFor(a)!.setVariant === preferred),
    );
    group.positions.forEach((position, index) => {
      result[position] = group.items[index];
    });
  }
  return result;
}
