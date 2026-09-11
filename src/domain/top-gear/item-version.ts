export type ItemVersion = "original" | "classic";
export const itemVersions = {
  original: {
    label: "Original WotLK 3.3.5a",
    description: "Original Ulduar item levels · Mjolnir Runestone: iLvl 226",
    revision: "original-335-v1",
  },
  classic: {
    label: "Blizzard Wrath Classic",
    description: "Buffed Ulduar item levels · Mjolnir Runestone: iLvl 239",
    revision: "classic-563e4a08",
  },
} as const;
// Missing profiles are pre-selector snapshots, which used Classic data.
export function itemVersionOf(snapshot: {
  itemVersion?: ItemVersion;
}): ItemVersion {
  return snapshot.itemVersion ?? "classic";
}
