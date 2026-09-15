import type { ResourceId, TokenFamily } from "@/domain/purchases/model";

export type ResourceTier = 7 | 8 | 9 | 10;
export type ResourceQuality = "base" | "normal" | "heroic";

type ResourceOption = {
  tier: ResourceTier;
  quality: ResourceQuality;
  itemLevel: 200 | 213 | 219 | 225 | 226 | 232 | 245 | 258 | 251 | 264 | 277;
  id: (family: TokenFamily) => ResourceId;
  labelKey: string;
  descriptionKey: string;
  walletDescriptionKey: string;
  prerequisiteTitleKey: string;
  prerequisiteKey: string;
};

export const resourceOptions: readonly ResourceOption[] = [
  {
    tier: 10,
    quality: "base",
    itemLevel: 251,
    id: () => "frost",
    labelKey: "resources.frost",
    descriptionKey: "descriptions.frost",
    walletDescriptionKey: "walletDescriptions.frost",
    prerequisiteTitleKey: "prerequisites.noneTitle",
    prerequisiteKey: "prerequisites.frost",
  },
  {
    tier: 10,
    quality: "normal",
    itemLevel: 264,
    id: (family) => `mark:normal:${family}`,
    labelKey: "resources.markNormal",
    descriptionKey: "descriptions.markNormal",
    walletDescriptionKey: "walletDescriptions.markNormal",
    prerequisiteTitleKey: "prerequisites.baseIncludedTitle",
    prerequisiteKey: "prerequisites.markNormal",
  },
  {
    tier: 10,
    quality: "heroic",
    itemLevel: 277,
    id: (family) => `mark:heroic:${family}`,
    labelKey: "resources.markHeroic",
    descriptionKey: "descriptions.markHeroic",
    walletDescriptionKey: "walletDescriptions.markHeroic",
    prerequisiteTitleKey: "prerequisites.normalIncludedTitle",
    prerequisiteKey: "prerequisites.markHeroic",
  },
  {
    tier: 9,
    quality: "base",
    itemLevel: 232,
    id: () => "triumph",
    labelKey: "resources.triumph",
    descriptionKey: "descriptions.triumph",
    walletDescriptionKey: "walletDescriptions.triumph",
    prerequisiteTitleKey: "prerequisites.noneTitle",
    prerequisiteKey: "prerequisites.triumph",
  },
  {
    tier: 9,
    quality: "normal",
    itemLevel: 245,
    id: () => "trophy",
    labelKey: "resources.trophy",
    descriptionKey: "descriptions.trophy",
    walletDescriptionKey: "walletDescriptions.trophy",
    prerequisiteTitleKey: "prerequisites.triumphIncludedTitle",
    prerequisiteKey: "prerequisites.trophy",
  },
  {
    tier: 9,
    quality: "heroic",
    itemLevel: 258,
    id: (family) => `regalia:${family}`,
    labelKey: "resources.regalia",
    descriptionKey: "descriptions.regalia",
    walletDescriptionKey: "walletDescriptions.regalia",
    prerequisiteTitleKey: "prerequisites.directTitle",
    prerequisiteKey: "prerequisites.regalia",
  },
  ...earlyOptions(),
] as const;

function earlyOptions(): ResourceOption[] {
  const options: ResourceOption[] = [
    {
      tier: 7,
      quality: "base",
      itemLevel: 200,
      id: () => "heroism",
      labelKey: "resources.heroism",
      descriptionKey: "descriptions.heroism",
      walletDescriptionKey: "descriptions.heroism",
      prerequisiteTitleKey: "prerequisites.noneTitle",
      prerequisiteKey: "descriptions.heroism",
    },
    {
      tier: 7,
      quality: "normal",
      itemLevel: 213,
      id: () => "valor",
      labelKey: "resources.valor",
      descriptionKey: "descriptions.valor",
      walletDescriptionKey: "descriptions.valor",
      prerequisiteTitleKey: "prerequisites.noneTitle",
      prerequisiteKey: "descriptions.valor",
    },
    {
      tier: 8,
      quality: "normal",
      itemLevel: 226,
      id: () => "conquest",
      labelKey: "resources.conquest",
      descriptionKey: "descriptions.conquest",
      walletDescriptionKey: "descriptions.conquest",
      prerequisiteTitleKey: "prerequisites.noneTitle",
      prerequisiteKey: "descriptions.conquest",
    },
  ];
  for (const tier of [7, 8] as const)
    for (const raidSize of [10, 25] as const)
      for (const slot of [
        "head",
        "shoulder",
        "chest",
        "hands",
        "legs",
      ] as const)
        options.push({
          tier,
          quality: raidSize === 10 ? "base" : "normal",
          itemLevel:
            tier === 7
              ? raidSize === 10
                ? 200
                : 213
              : raidSize === 10
                ? 219
                : 226,
          id: (family) => `tier:${tier}:${raidSize}:${slot}:${family}`,
          labelKey: `resources.t${tier}_${raidSize}_${slot}`,
          descriptionKey: `descriptions.token_${slot}`,
          walletDescriptionKey: `descriptions.token_${slot}`,
          prerequisiteTitleKey: "prerequisites.noneTitle",
          prerequisiteKey: "earlyTokenHelp",
        });
  return options;
}

export function optionsForTier(
  tier: ResourceTier,
  family: TokenFamily,
  profile: "original" | "classic" = "original",
) {
  return resourceOptions
    .filter((option) => option.tier === tier)
    .map((option) => ({
      ...option,
      itemLevel:
        option.tier === 8 && profile === "classic"
          ? option.itemLevel + 6
          : option.itemLevel,
      resourceId: option.id(family),
    }));
}

export function optionForResource(id: ResourceId, family: TokenFamily) {
  return resourceOptions.find((option) => option.id(family) === id);
}

export function isResourceForFamily(id: ResourceId, family: TokenFamily) {
  return resourceOptions.some((option) => option.id(family) === id);
}
