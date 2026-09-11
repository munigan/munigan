import type { Catalog } from "@/domain/equipment/catalog";
import { DungeonDifficulty, type UIItem } from "@/generated/wotlk/ui";
import type { InventoryTranslation } from "../item-labels";

const difficultyKeys: Partial<Record<DungeonDifficulty, string>> = {
  [DungeonDifficulty.DifficultyNormal]: "normal",
  [DungeonDifficulty.DifficultyHeroic]: "heroic",
  [DungeonDifficulty.DifficultyRaid10]: "raid10",
  [DungeonDifficulty.DifficultyRaid25]: "raid25",
  [DungeonDifficulty.DifficultyRaid10H]: "raid10Heroic",
  [DungeonDifficulty.DifficultyRaid25H]: "raid25Heroic",
};

/** Presentation mirrors source IDs; eligibility and filtering use domain data. */
export function localizedItemSources(
  item: UIItem,
  catalog: Pick<Catalog, "zones" | "npcs">,
  t: InventoryTranslation,
) {
  return item.sources.flatMap(({ source }) => {
    switch (source.oneofKind) {
      case "drop": {
        const difficulty = difficultyKeys[source.drop.difficulty];
        return [
          {
            key: `zone:${source.drop.zoneId}`,
            label:
              catalog.zones?.get(source.drop.zoneId)?.name ??
              t("picker.sourceLabels.drop"),
            detail: [
              difficulty ? t(`picker.difficulties.${difficulty}`) : null,
              source.drop.category,
              source.drop.otherName ||
                catalog.npcs?.get(source.drop.npcId)?.name,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ];
      }
      case "crafted":
        return [
          {
            key: "crafted",
            label: t("picker.sourceLabels.crafted"),
            detail: "",
          },
        ];
      case "quest":
        return [
          {
            key: "quest",
            label: t("picker.sourceLabels.quest"),
            detail: source.quest.name,
          },
        ];
      case "soldBy":
        return [
          {
            key: "vendor",
            label: t("picker.sourceLabels.vendor"),
            detail: source.soldBy.npcName,
          },
        ];
      case "rep":
        return [
          {
            key: "reputation",
            label: t("picker.sourceLabels.reputation"),
            detail: "",
          },
        ];
      default:
        return [];
    }
  });
}
