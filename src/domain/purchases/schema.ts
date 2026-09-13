import { z } from "zod";
import { getPurchaseCatalog } from "./catalog";
import type { PurchaseInputs, ResourceAmounts, ResourceId } from "./model";
import type { ItemVersion } from "@/domain/top-gear/item-version";
import { AppError } from "@/i18n/error";

export const resourceIds = [
  "frost",
  "triumph",
  "trophy",
  "regalia:vanquisher",
  "regalia:protector",
  "regalia:conqueror",
  "mark:normal:vanquisher",
  "mark:normal:protector",
  "mark:normal:conqueror",
  "mark:heroic:vanquisher",
  "mark:heroic:protector",
  "mark:heroic:conqueror",
] as const satisfies readonly ResourceId[];

const resourceIdSchema = z.enum(resourceIds);
const profileSchema = z.enum(["original", "classic"]);
const quantitySchema = z.number().int().min(0).max(1_000_000);
const itemIdSchema = z.number().int().positive().max(10_000_000);
const decimalItemIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => Number(value) <= 10_000_000);

const itemEnhancementSchema = z
  .object({
    gemIds: z
      .array(z.number().int().nonnegative().max(10_000_000).nullable())
      .max(4)
      .optional(),
    enchantId: z.number().int().nonnegative().max(10_000_000).optional(),
  })
  .strict();

const exclusionsSchema = z
  .array(itemIdSchema)
  .superRefine((values, context) => {
    if (new Set(values).size > 1_000)
      context.addIssue({
        code: "too_big",
        origin: "array",
        maximum: 1_000,
        inclusive: true,
        message: "Too many purchase exclusions",
      });
  })
  .transform((values) => [...new Set(values)].sort((a, b) => a - b));

const enhancementsSchema = z
  .record(decimalItemIdSchema, itemEnhancementSchema)
  .superRefine((value, context) => {
    if (Object.keys(value).length > 1_000)
      context.addIssue({
        code: "too_big",
        origin: "object",
        maximum: 1_000,
        inclusive: true,
        message: "Too many purchase enhancement overrides",
      });
  })
  .transform((value) =>
    Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => Number(a) - Number(b)),
    ),
  );

export const purchaseInputsSchema = z
  .object({
    version: z.literal(1),
    recipeRevision: z.string().min(1).max(100),
    balances: z.partialRecord(resourceIdSchema, quantitySchema),
    gearVariant: z.string().min(1).max(60).optional(),
    excludedItemIds: z.partialRecord(profileSchema, exclusionsSchema),
    itemEnhancements: z.partialRecord(profileSchema, enhancementsSchema),
  })
  .strict();

export function canonicalizePurchaseInputs(
  inputs: PurchaseInputs,
): PurchaseInputs | undefined {
  if (!Object.keys(inputs.balances).length) return undefined;
  const balances = Object.fromEntries(
    Object.entries(inputs.balances).sort(([a], [b]) => a.localeCompare(b)),
  ) as ResourceAmounts;
  const excludedItemIds = Object.fromEntries(
    Object.entries(inputs.excludedItemIds)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([profile, values]) => [
        profile,
        [...new Set(values)].sort((a, b) => a - b),
      ]),
  );
  const itemEnhancements = Object.fromEntries(
    Object.entries(inputs.itemEnhancements)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([profile, values]) => [
        profile,
        Object.fromEntries(
          Object.entries(values).sort(([a], [b]) => Number(a) - Number(b)),
        ),
      ]),
  );
  return {
    ...inputs,
    balances,
    excludedItemIds,
    itemEnhancements,
  };
}

export function validatePurchaseInputs(
  inputs: PurchaseInputs,
  currentProfile: ItemVersion,
) {
  if (inputs.recipeRevision !== getPurchaseCatalog(currentProfile).revision)
    throw new AppError(
      "purchaseCatalogChanged",
      "Purchase catalog changed. Review your purchase inputs before submitting.",
    );
  for (const [profile, itemIds] of Object.entries(inputs.excludedItemIds)) {
    const catalog = getPurchaseCatalog(profile as ItemVersion);
    for (const itemId of itemIds)
      if (!catalog.byItemId.has(itemId))
        throw new Error(`Unknown purchase item ${itemId}`);
  }
  for (const [profile, overrides] of Object.entries(inputs.itemEnhancements)) {
    const catalog = getPurchaseCatalog(profile as ItemVersion);
    for (const itemId of Object.keys(overrides).map(Number))
      if (!catalog.byItemId.has(itemId))
        throw new Error(`Unknown purchase item ${itemId}`);
  }
}

const purchaseInstancePrefix = "purchase-";

export function purchaseInstanceId(profile: ItemVersion, itemId: number) {
  return `${purchaseInstancePrefix}${profile}-${itemId}`;
}

export function isGeneratedPurchaseId(value: string) {
  return value.startsWith(purchaseInstancePrefix);
}
