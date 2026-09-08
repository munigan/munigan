import { Unzlib } from "fflate";
import type { JsonObject } from "@protobuf-ts/runtime";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
export function decodeProfileLink(text: string) {
  const url = new URL(text);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "poli93.github.io" ||
    !url.pathname.startsWith("/wotlk/") ||
    url.username ||
    url.password
  )
    throw new Error("Use a Poli93 WotLK profile link");
  const bytes = Uint8Array.from(atob(url.hash.slice(1)), (c) =>
    c.charCodeAt(0),
  );
  if (bytes.length > 262144) throw new Error("Profile too large");
  let length = 0;
  const chunks: Uint8Array[] = [];
  const inflater = new Unzlib((chunk) => {
    length += chunk.length;
    if (length > 1048576) throw new Error("Decompressed profile too large");
    chunks.push(chunk);
  });
  inflater.push(bytes, true);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    joined.set(c, offset);
    offset += c.length;
  }
  const settings = IndividualSimSettings.fromBinary(joined);
  if (url.searchParams.has("i") && !url.searchParams.get("i")!.includes("g"))
    throw new Error("This profile link does not include equipment");
  const categories = url.searchParams.get("i") ?? "gtrcmxe";
  const json = IndividualSimSettings.toJson(settings, {
      emitDefaultValues: true,
    }) as JsonObject,
    player = json.player as JsonObject;
  if (!player) throw new Error("Profile is missing a player");
  const selected: JsonObject = { class: player.class };
  const groups: Record<string, string[]> = {
    g: ["equipment", "bonusStats", "enableItemSwap", "itemSwap"],
    t: ["talentsString", "glyphs"],
    r: ["rotation", "cooldowns"],
    c: ["consumes"],
    m: [
      "name",
      "race",
      "profession1",
      "profession2",
      "reactionTimeMs",
      "channelClipDelayMs",
      "inFrontOfTarget",
      "distanceFromTarget",
      "healingModel",
      "nibelungAverageCasts",
      "nibelungAverageCastsSet",
      ...(settings.player?.spec.oneofKind
        ? [settings.player.spec.oneofKind]
        : []),
    ],
    x: ["buffs"],
  };
  for (const [category, fields] of Object.entries(groups))
    if (categories.includes(category))
      for (const field of fields)
        if (Object.hasOwn(player, field)) selected[field] = player[field];
  const output: JsonObject = { player: selected };
  if (categories.includes("e")) output.encounter = json.encounter;
  if (categories.includes("x"))
    for (const field of ["raidBuffs", "partyBuffs", "debuffs", "tanks"])
      output[field] = json[field];
  return output;
}
