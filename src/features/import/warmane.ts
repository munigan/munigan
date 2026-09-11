import { AppError } from "@/i18n/error";

export const warmaneRealms = [
  "Icecrown",
  "Lordaeron",
  "Blackrock",
  "Onyxia",
] as const;
export type WarmaneLookup = { name: string; realm: string };
export type ArmoryCharacter = {
  name: string;
  class: string;
  race: string;
  level: number;
  gear: { items: Array<{ id: number; enchant: number; gems: number[] }> };
  professions: Array<{ name: string; level: number }>;
};

export function validateWarmaneLookup(input: WarmaneLookup): WarmaneLookup {
  const name =
    typeof input.name === "string" ? input.name.trim().normalize("NFC") : "";
  if (!/^\p{L}{2,12}$/u.test(name))
    throw new AppError(
      "warmaneName",
      "Enter a character name using 2–12 letters.",
    );
  if (!warmaneRealms.some((realm) => realm === input.realm))
    throw new AppError("warmaneRealm", "Choose a supported Warmane realm.");
  return {
    name: name[0].toUpperCase() + name.slice(1).toLowerCase(),
    realm: input.realm,
  };
}
