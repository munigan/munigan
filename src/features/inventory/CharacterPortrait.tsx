import Image from "next/image";
import type { Snapshot } from "@/domain/top-gear/model";

// The badge follows the character's dominant talent tree, including custom imports.
const treeIcons: Record<string, string[]> = {
  deathknight: [
    "spell_deathknight_bloodpresence",
    "spell_deathknight_frostpresence",
    "spell_deathknight_unholypresence",
  ],
  druid: [
    "spell_nature_starfall",
    "ability_druid_catform",
    "spell_nature_healingtouch",
  ],
  hunter: [
    "ability_hunter_beasttaming",
    "ability_marksmanship",
    "ability_hunter_swiftstrike",
  ],
  mage: [
    "spell_holy_magicalsentry",
    "spell_fire_firebolt02",
    "spell_frost_frostbolt02",
  ],
  paladin: [
    "spell_holy_holybolt",
    "spell_holy_devotionaura",
    "spell_holy_auraoflight",
  ],
  priest: [
    "spell_holy_wordfortitude",
    "spell_holy_guardianspirit",
    "spell_shadow_shadowwordpain",
  ],
  rogue: ["ability_rogue_eviscerate", "ability_backstab", "ability_stealth"],
  shaman: [
    "spell_nature_lightning",
    "spell_nature_lightningshield",
    "spell_nature_magicimmunity",
  ],
  warlock: [
    "spell_shadow_deathcoil",
    "spell_shadow_metamorphosis",
    "spell_shadow_rainoffire",
  ],
  warrior: [
    "ability_warrior_savageblow",
    "ability_warrior_innerrage",
    "ability_warrior_defensivestance",
  ],
};

export function characterSpecIcon(className: string, talentsString: string) {
  const key = className.toLowerCase().replaceAll(" ", "");
  const points = talentsString
    .split("-")
    .map((tree) => [...tree].reduce((sum, point) => sum + Number(point), 0));
  return Math.max(...points) > 0
    ? treeIcons[key]?.[points.indexOf(Math.max(...points))]
    : undefined;
}

export function CharacterPortrait({
  className,
  snapshot,
  talentsString = snapshot?.settings.player?.talentsString ?? "",
}: {
  className: string;
  snapshot?: Snapshot;
  talentsString?: string;
}) {
  const key = className.toLowerCase().replaceAll(" ", "");
  const specIcon = characterSpecIcon(className, talentsString);
  const imageUrl = (icon: string) =>
    `https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`;
  return (
    <div className="character-portrait" aria-hidden="true">
      <Image
        unoptimized
        src={imageUrl(`classicon_${key}`)}
        width={48}
        height={48}
        alt=""
        className="character-class-image"
      />
      {specIcon && (
        <Image
          unoptimized
          src={imageUrl(specIcon)}
          width={24}
          height={24}
          alt=""
          className="character-spec-image"
        />
      )}
    </div>
  );
}
