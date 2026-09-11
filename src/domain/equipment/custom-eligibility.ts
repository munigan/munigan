import { Profession, Race } from "@/generated/wotlk/common";
import type { UIItem } from "@/generated/wotlk/ui";
import type { Snapshot } from "@/domain/top-gear/model";
import type { Catalog } from "./catalog";

export const maxCustomItems = 100;
export const maxInventoryItems = 217 + maxCustomItems;
const alliance = new Set([
  Race.RaceHuman,
  Race.RaceDwarf,
  Race.RaceGnome,
  Race.RaceNightElf,
  Race.RaceDraenei,
]);
const skillProfessions: Record<number, Profession> = {
  164: Profession.Blacksmithing,
  165: Profession.Leatherworking,
  171: Profession.Alchemy,
  197: Profession.Tailoring,
  202: Profession.Engineering,
  755: Profession.Jewelcrafting,
};

/** Additional acquisition constraints for hypothetical candidates; imported gear is unchanged. */
export function customEligibilityError(
  snapshot: Snapshot,
  item: UIItem,
  catalog: Catalog,
): string | undefined {
  const player = snapshot.settings.player!;
  if (
    item.factionRestriction &&
    item.factionRestriction !== (alliance.has(player.race) ? 1 : 2)
  )
    return `${item.name} is restricted to the other faction`;
  const rule = catalog.restrictions?.items[item.id];
  if (rule?.requiredSkill) {
    const profession = skillProfessions[rule.requiredSkill];
    if (
      !profession ||
      ![player.profession1, player.profession2].includes(profession) ||
      (snapshot.professionLevels?.[profession] ?? 450) < rule.requiredSkillRank
    )
      return `${item.name} requires ${profession ? Profession[profession] : "an unsupported skill"} ${rule.requiredSkillRank}`;
  }
}
