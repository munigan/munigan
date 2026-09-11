/** Artwork follows the specialization, not individual phase/rotation presets. */
export function characterBackground(specId?: string | null): string {
  if (!specId) return "naxxramas";
  const [module, preset = ""] = specId.split(":");
  const fixed: Record<string, string> = {
    balance_druid: "druid-balance",
    feral_druid: "druid-feral",
    elemental_shaman: "shaman-elemental",
    enhancement_shaman: "shaman-enhancement",
    retribution_paladin: "paladin-retribution",
    shadow_priest: "priest-shadow",
    smite_priest: "priest-smite",
  };
  if (fixed[module]) return fixed[module];
  const families: Record<string, [RegExp, string][]> = {
    hunter: [
      [/^BeastMastery/, "beast-mastery"],
      [/^Marksman/, "marksmanship"],
      [/^Survival/, "survival"],
    ],
    mage: [
      [/^Arcane/, "arcane"],
      [/^Frostfire/, "frostfire"],
      [/^(Fire|Phase3Fire)/, "fire"],
      [/^Frost/, "frost"],
    ],
    rogue: [
      [/^Assassination/, "assassination"],
      [/^Combat/, "combat"],
      [/^(HemoSubtlety|Subtlety)/, "subtlety"],
    ],
    warlock: [
      [/^Affliction/, "affliction"],
      [/^Demonology/, "demonology"],
      [/^Destruction/, "destruction"],
    ],
    warrior: [
      [/^Arms/, "arms"],
      [/^Fury/, "fury"],
    ],
    deathknight: [
      [/^Blood/, "blood"],
      [/^Frost/, "frost"],
      [/^Unholy/, "unholy"],
    ],
  };
  const family = families[module]?.find(([pattern]) => pattern.test(preset));
  return family ? `${module}-${family[1]}` : "naxxramas";
}
