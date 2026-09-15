import type { ResourceId } from "@/domain/purchases/model";

/** In-game resource icons shared by all class-token families. */
export function resourceIcon(id: ResourceId): string {
  if (id === "heroism") return "spell_holy_proclaimchampion";
  if (id === "valor") return "spell_holy_proclaimchampion_02";
  if (id === "conquest") return "spell_holy_championsgrace";
  if (id.startsWith("tier:"))
    return (
      {
        head: "inv_helmet_24",
        shoulder: "inv_shoulder_22",
        chest: "inv_chest_chain_03",
        hands: "inv_gauntlets_27",
        legs: "inv_pants_plate_17",
      } as Record<string, string>
    )[id.split(":")[3]];
  if (id === "frost") return "inv_misc_frostemblem_01";
  if (id === "triumph") return "spell_holy_summonchampion";
  if (id === "trophy") return "inv_misc_trophy_argent";
  if (id.startsWith("mark:heroic:"))
    return "ability_paladin_judgementsofthejust";
  if (id.startsWith("mark:normal:"))
    return "ability_paladin_shieldofthetemplar";
  return "inv_chest_chain_03";
}
