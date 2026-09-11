import { z } from "zod";

export const TooltipVersionSchema = z.enum(["classic", "original"]);
export type TooltipVersion = z.infer<typeof TooltipVersionSchema>;
export const TooltipLineSchema = z.object({
  kind: z.enum([
    "binding",
    "slot",
    "weapon",
    "stat",
    "effect",
    "requirement",
    "durability",
    "flavor",
    "set",
    "description",
  ]),
  text: z.string().min(1).max(8000),
  rightText: z.string().max(1000).optional(),
});
export type TooltipLine = z.infer<typeof TooltipLineSchema>;
export const ItemTooltipSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.number().int().min(1).max(1_000_000),
    version: TooltipVersionSchema,
    source: z.object({
      provider: z.enum(["wowhead", "cavernoftime"]),
      url: z.string().url(),
    }),
    name: z.string().min(1).max(300),
    quality: z.number().int().min(0).max(7),
    icon: z
      .string()
      .regex(/^[a-z0-9_-]{1,150}$/)
      .nullable(),
    itemLevel: z.number().int().min(1).max(9999).nullable(),
    heroic: z.boolean(),
    lines: z.array(TooltipLineSchema).min(1).max(160),
    sockets: z
      .array(z.enum(["red", "yellow", "blue", "meta", "prismatic"]))
      .max(10),
    socketBonus: z.string().max(1000).nullable(),
  })
  .superRefine((item, ctx) => {
    const provider = item.version === "classic" ? "wowhead" : "cavernoftime";
    if (
      item.source.provider !== provider ||
      item.source.url !== tooltipSourceUrl(item.version, item.id)
    )
      ctx.addIssue({
        code: "custom",
        message: "Tooltip source does not match item version and ID",
      });
  });
export type ItemTooltip = z.infer<typeof ItemTooltipSchema>;
export const ItemTooltipResponseSchema = z.object({
  item: ItemTooltipSchema,
  meta: z.object({
    fetchedAt: z.iso.datetime(),
    cache: z.enum(["fresh", "stale"]),
  }),
});
export type ItemTooltipResponse = z.infer<typeof ItemTooltipResponseSchema>;
export function tooltipSourceUrl(version: TooltipVersion, id: number) {
  return version === "classic"
    ? `https://www.wowhead.com/wotlk/item=${id}`
    : `https://wotlk.cavernoftime.com/item=${id}`;
}
