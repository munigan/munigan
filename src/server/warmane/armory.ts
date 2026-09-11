import { randomUUID } from "node:crypto";
import { AppError } from "@/i18n/error";
import {
  validateWarmaneLookup,
  type WarmaneLookup,
  type WarmaneImportMode,
  type WarmaneImportResult,
} from "@/features/import/warmane";
import { fetchDirectWarmaneCharacter } from "./direct";
import { fetchWarmaneRelay, relayUnavailable } from "./relay";
import { WarmaneError } from "./profile";
export { parseWarmaneProfile, WarmaneError } from "./profile";
export { WarmaneRelayError } from "./relay";

export async function lookupWarmaneCharacter(
  input: WarmaneLookup,
  mode: WarmaneImportMode = "auto",
): Promise<WarmaneImportResult> {
  const lookup = validateWarmaneLookup(input);
  if (!["auto", "refresh", "saved"].includes(mode))
    throw new AppError("invalidInput", "Choose a valid Armory import mode.");
  if (process.env.WARMANE_RELAY_URL || process.env.WARMANE_RELAY_SECRET)
    return fetchWarmaneRelay(lookup, mode);
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw relayUnavailable();
  if (mode === "saved")
    throw new WarmaneError(
      "warmaneNoSavedProfile",
      "No recent saved Armory profile is available. Refresh from Armory or use an addon export.",
      404,
    );
  const character = await fetchDirectWarmaneCharacter(lookup);
  return {
    character,
    meta: {
      retrievedAt: new Date().toISOString(),
      source: "live",
      requestId: randomUUID(),
    },
  };
}

export async function importWarmaneCharacter(input: WarmaneLookup) {
  return (await lookupWarmaneCharacter(input)).character;
}
