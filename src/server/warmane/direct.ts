import { AppError } from "@/i18n/error";
import {
  validateWarmaneLookup,
  type ArmoryCharacter,
  type WarmaneLookup,
} from "@/features/import/warmane";
import { parseWarmaneProfile, WarmaneError } from "./profile";
const maxBytes = 512_000;
const invalid = () =>
  new WarmaneError(
    "warmaneInvalidProfile",
    "Could not read this Armory profile completely. Try again or use an addon export.",
  );
const unavailable = () =>
  new WarmaneError(
    "warmaneUnavailable",
    "Warmane Armory is unavailable or limiting requests. Try again shortly, or use an addon export.",
    503,
  );
const notFound = () =>
  new WarmaneError(
    "warmaneNotFound",
    "Character not found. Check the name and realm.",
    404,
  );
export async function fetchDirectWarmaneCharacter(
  input: WarmaneLookup,
): Promise<ArmoryCharacter> {
  const lookup = validateWarmaneLookup(input);
  try {
    const response = await fetch(
      `https://armory.warmane.com/character/${encodeURIComponent(lookup.name)}/${lookup.realm}/profile`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
        headers: { Accept: "text/html" },
      },
    );
    if (response.status === 404) throw notFound();
    if (!response.ok) throw unavailable();
    if (Number(response.headers.get("content-length")) > maxBytes)
      throw invalid();
    const reader = response.body?.getReader();
    if (!reader) throw invalid();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) throw invalid();
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return parseWarmaneProfile(Buffer.concat(chunks).toString("utf8"), lookup);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unavailable();
  }
}
