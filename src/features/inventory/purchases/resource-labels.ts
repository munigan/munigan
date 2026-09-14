import type { ResourceId, TokenFamily } from "@/domain/purchases/model";

export type ResourceTier = 9 | 10;
export type ResourceQuality = "base" | "normal" | "heroic";

type ResourceOption = {
  tier: ResourceTier;
  quality: ResourceQuality;
  itemLevel: 232 | 245 | 258 | 251 | 264 | 277;
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
] as const;

export function optionsForTier(tier: ResourceTier, family: TokenFamily) {
  return resourceOptions
    .filter((option) => option.tier === tier)
    .map((option) => ({ ...option, resourceId: option.id(family) }));
}

export function optionForResource(id: ResourceId, family: TokenFamily) {
  return resourceOptions.find((option) => option.id(family) === id);
}

export function isResourceForFamily(id: ResourceId, family: TokenFamily) {
  return resourceOptions.some((option) => option.id(family) === id);
}
