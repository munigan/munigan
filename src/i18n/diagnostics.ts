import { describeError, type ErrorParams } from "./error";
import { slots } from "@/domain/top-gear/slots";
export type DiagnosticTranslator = (
  key: string,
  values?: ErrorParams,
) => string;
const legacyMessages: Record<string, string> = {
  "Use a JSON object": "jsonObject",
  "This candidate ID is already in use. Import the character again.":
    "candidateConflict",
  "Reload this page to initialize your anonymous session": "sessionReload",
  "Invalid request origin": "origin",
  "Use application/json": "contentType",
  "Request body required": "bodyRequired",
  "Request exceeds 1.5 MB": "requestSize",
  "Invalid JSON": "invalidJson",
  "Simulation service is unavailable. Your selection has been kept.":
    "serviceUnavailable",
  "Unable to process request": "requestFailed",
  "Public admission is not configured": "admissionUnavailable",
  "The deployment did not supply a trusted client address": "clientAddress",

  "Expected a JSON object": "expectedObject",
  "Item, gem and enchant IDs must be nonnegative integers": "invalidIds",
  "Export must include an items array": "missingItems",
  "Too many exported items": "itemLimit",
  "Invalid gem slots": "invalidSockets",
  "Export exceeds 1 MB": "exportSize",
  "Export nesting limit exceeded": "exportDepth",
  "Invalid export key": "exportKey",
  "This importer supports level 80 Wrath characters": "wrathLevel",
  "Profile is missing a player": "missingPlayer",
  "Profile is missing a supported Wrath class": "missingClass",
  "Disable in-combat item swap before importing Top Gear": "importItemSwap",
  "Invalid Wrath talent string": "invalidTalentString",
  "Invalid professions": "invalidProfessions",
  "Invalid profession skill rank": "invalidProfessionRank",
  "This export is not Wrath": "notWrath",
  "Invalid glyphs": "invalidGlyphs",
  "Invalid key": "invalidKey",
  "Choose a specialization matching the imported class": "matchingSpec",
  "Use a Poli93 WotLK profile link": "profileLink",
  "Profile too large": "profileSize",
  "Decompressed profile too large": "profileDecompressedSize",
  "This profile link does not include equipment": "profileEquipment",
  "Local draft storage is unavailable in this browser.": "storageUnavailable",
  "Could not connect to the simulation service. Reload to try again.":
    "serviceConnection",
  "Your selection is kept on this page, but could not be saved in this browser.":
    "storageSave",
  "Could not clear local storage": "storageClear",
  "Review your simulation settings.": "reviewSettings",
  "This draft uses older item data. Select the current item version or import again.":
    "oldItemData",
  "A player and encounter are required": "requiredSettings",
  "This draft uses an older simulator version. Import again.": "oldSimulator",
  "Simulation configuration is too complex": "complexSettings",
  "Simulation settings must contain finite numbers": "finiteSettings",
  "Class does not match specialization": "classSpec",
  "Player options do not match specialization": "playerSpec",
  "Race is not eligible for this class in Wrath": "raceClass",
  "Custom simulator databases are not supported": "customDatabase",
  "In-combat item swapping is not supported": "itemSwap",
  "Choose Automatic or APL rotation before importing": "rotation",
  "Invalid Wrath talents": "invalidTalents",
  "Use a 10–600 second encounter with 1–10 targets": "encounter",
  "Invalid target configuration": "invalidTarget",
  "Custom items must be distinct additional candidates": "customDistinct",
  "Duplicate item instance IDs": "duplicateInstances",
  "Selection must contain distinct owned instance IDs": "selectionIds",
  "Equipped item mapping is inconsistent": "equippedMapping",
  "Excluded items cannot be selected": "excludedSelected",
  "Unknown item instance": "unknownInstance",
  "One physical item cannot occupy two slots": "physicalConflict",
  "Unique-equipped item conflict": "uniqueItem",
  "Unique gem conflict": "uniqueGem",
  "At most three Jewelcrafting gems may be equipped": "jcLimit",
  "This weapon pair cannot be equipped together": "weaponPair",
  "Choose an unrestricted default gem for normal sockets.": "defaultGem",
  "Choose a supported meta gem.": "metaGem",
  "Choose a Dragon’s Eye for Jewelcrafting sockets.": "jcGem",
  "The meta gem’s color requirements cannot be met with this set’s available regular sockets.":
    "metaRequirements",
  "Talent string has too many entries": "talentEntries",
  "Talent rank exceeds its maximum": "talentRank",
  "Talent tier requirement is not met": "talentTier",
  "Talent prerequisite is not met": "talentPrerequisite",
  "A level 80 character has at most 71 talent points": "talentPoints",
  "Could not refresh this report": "reportRefresh",
  "This report has expired": "reportExpired",
  "Report not found": "reportMissing",
  "Job not found": "jobMissing",
  "This job cannot be canceled": "jobCancel",
  "A valid Idempotency-Key is required": "idempotency",
  "Reduce your item selections to fit the free allowance": "allowance",
  "This submission key belongs to a different selection": "submissionConflict",
  "The simulation queue is full. Try again shortly.": "queueFull",
  "Your free simulation limit has been reached. Try again later.": "ownerLimit",
  "This connection has reached its free simulation limit": "connectionLimit",
  "Today’s free simulation capacity is full. Try again later.": "dailyCapacity",
  "Simulation capacity is temporarily occupied": "capacityOccupied",
  "Invalid Top Gear input": "invalidInput",
  "Simulator rejected this configuration": "simulatorRejected",
};
const patterns = [
  {
    pattern: /^Item (\d+) is not eligible for this slot and character$/,
    code: "customSlot",
    names: ["id"],
  },
  {
    pattern:
      /^You can add up to (\d+) custom items\. Remove a custom item to make room\.$/,
    code: "customCapacity",
    names: ["count"],
  },
  {
    pattern: /^(.+) requires an unsupported skill (\d+)$/,
    code: "unsupportedSkillItem",
    names: ["name", "rank"],
  },
  {
    pattern:
      /^(.+): no compatible equipped enchant could be copied; simulated without an enchant\.$/,
    code: "noCopiedEnchant",
    names: ["name"],
  },
  {
    pattern: new RegExp("^Unknown\\ Class:\\ (.+)$"),
    code: "unknownClass",
    names: ["value"],
  },
  {
    pattern: new RegExp("^Unknown\\ Race:\\ (.+)$"),
    code: "unknownRace",
    names: ["value"],
  },
  {
    pattern: new RegExp("^Unknown\\ Profession:\\ (.+)$"),
    code: "unknownProfession",
    names: ["value"],
  },
  {
    pattern: new RegExp(
      "^Unknown\\ glyph:\\ (.+)\\.\\ Use\\ an\\ English\\ exporter\\ or\\ a\\ simulator\\ profile\\.$",
    ),
    code: "unknownGlyph",
    names: ["name"],
  },
  {
    pattern: new RegExp(
      "^Item\\ (\\d+)\\ is\\ not\\ in\\ the\\ pinned\\ simulator\\ catalog$",
    ),
    code: "unknownItem",
    names: ["id"],
  },
  {
    pattern: new RegExp(
      "^(.+)\\ is\\ not\\ yet\\ supported\\ with\\ Original\\ WotLK\\ item\\ data$",
    ),
    code: "unsupportedItem",
    names: ["name"],
  },
  {
    pattern: new RegExp(
      "^(.+)\\ has\\ no\\ verified\\ 3\\.3\\.5\\ equipment\\ rules$",
    ),
    code: "unverifiedItem",
    names: ["name"],
  },
  {
    pattern: new RegExp(
      "^(.+)\\ is\\ not\\ eligible\\ for\\ this\\ character$",
    ),
    code: "ineligibleItem",
    names: ["name"],
  },
  {
    pattern: new RegExp("^Enchant\\ (\\d+)\\ is\\ not\\ legal\\ on\\ (.+)$"),
    code: "invalidEnchant",
    names: ["id", "name"],
  },
  {
    pattern: new RegExp("^Unknown\\ gem\\ (\\d+)$"),
    code: "unknownGem",
    names: ["id"],
  },
  {
    pattern: new RegExp("^Gem\\ (\\d+)\\ does\\ not\\ fit\\ its\\ socket$"),
    code: "socketGem",
    names: ["id"],
  },
  {
    pattern: new RegExp("^Gem\\ (\\d+)\\ requires\\ its\\ profession$"),
    code: "professionGem",
    names: ["id"],
  },
  {
    pattern: new RegExp("^(.+):\\ at\\ most\\ (\\d+)\\ equipped$"),
    code: "categoryLimit",
    names: ["name", "count"],
  },
  {
    pattern: new RegExp(
      "^(.+)\\ is\\ restricted\\ to\\ the\\ other\\ faction$",
    ),
    code: "factionItem",
    names: ["name"],
  },
  {
    pattern: new RegExp("^(.+)\\ requires\\ (.+)\\ (\\d+)$"),
    code: "skillItem",
    names: ["name", "profession", "rank"],
  },
  {
    pattern: new RegExp(
      "^(.+)\\ requires\\ an\\ unsupported\\ skill\\ (\\d+)$",
    ),
    code: "unsupportedSkillItem",
    names: ["name", "rank"],
  },
  {
    pattern: new RegExp("^(.+)\\ cannot\\ occupy\\ (.+)$"),
    code: "slotItem",
    names: ["name", "slot"],
  },
  {
    pattern: new RegExp("^Locked\\ (.+)\\ must\\ be\\ selected\\ and\\ owned$"),
    code: "lockedSlot",
    names: ["slot"],
  },
  {
    pattern: new RegExp(
      "^Use\\ at\\ most\\ (\\d+)\\ custom\\ items\\ and\\ 217\\ imported\\ items$",
    ),
    code: "customLimit",
    names: ["count"],
  },
  {
    pattern: new RegExp(
      "^Explicitly\\ exclude\\ unsupported\\ bag\\ item\\ (\\d+)$",
    ),
    code: "excludeBag",
    names: ["id"],
  },
  {
    pattern: new RegExp(
      "^The\\ selected\\ Dragon\u2019s\\ Eye\\ requires\\ Jewelcrafting\\ (\\d+)\\.$",
    ),
    code: "jcRank",
    names: ["rank"],
  },
  {
    pattern: new RegExp(
      "^Only\\ (\\d+)\\ of\\ 3\\ Dragon\u2019s\\ Eyes\\ fit\\ in\\ this\\ set\u2019s\\ available\\ sockets\\.$",
    ),
    code: "jcFit",
    names: ["count"],
  },
  {
    pattern: new RegExp(
      "^Mining\\ (\\d+)/450:\\ the\\ simulator\\ applies\\ 60\\ stamina,\\ which\\ requires\\ 450\\ skill\\.\\ Lower\\-rank\\ gathering\\ bonuses\\ are\\ not\\ supported\\ yet\\.$",
    ),
    code: "gatheringMining",
    names: ["rank"],
  },
  {
    pattern: new RegExp(
      "^Skinning\\ (\\d+)/450:\\ the\\ simulator\\ applies\\ 40\\ critical\\ strike\\ rating,\\ which\\ requires\\ 450\\ skill\\.\\ Lower\\-rank\\ gathering\\ bonuses\\ are\\ not\\ supported\\ yet\\.$",
    ),
    code: "gatheringSkinning",
    names: ["rank"],
  },
  {
    pattern: new RegExp(
      "^Herbalism\\ (\\d+)/450:\\ the\\ simulator\\ applies\\ maximum\\-rank\\ Lifeblood,\\ which\\ requires\\ 450\\ skill\\.\\ Lower\\-rank\\ gathering\\ bonuses\\ are\\ not\\ supported\\ yet\\.$",
    ),
    code: "gatheringHerbalism",
    names: ["rank"],
  },
];
const recognizedCodes = new Set([
  ...Object.values(legacyMessages),
  ...patterns.map((entry) => entry.code),
  "invalidExport",
  "warmaneName",
  "warmaneRealm",
  "warmaneNotFound",
  "warmaneUnavailable",
  "warmaneInvalidProfile",
  "warmaneUnknownGem",
]);
/** Only existing message text is retained. Never serialize errors, stacks, or response objects. */
export function safeOriginalDetails(message: string): string {
  return message
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}
function presentationParams(
  params: ErrorParams | undefined,
  t: DiagnosticTranslator,
) {
  if (
    !params ||
    typeof params.slot !== "string" ||
    !slots.some((slot) => slot === params.slot)
  )
    return params;
  return {
    ...params,
    slot: t(`slot${params.slot[0].toUpperCase()}${params.slot.slice(1)}`),
  };
}
/** Additive API identity for known diagnostics; never includes translated text. */
export function diagnosticIdentity(value: unknown): {
  code?: string;
  params?: ErrorParams;
} {
  const error = describeError(value);
  if (error.code && recognizedCodes.has(error.code)) {
    const template = patterns.find((entry) => entry.code === error.code);
    if (
      !template ||
      template.names.every((name) => error.params?.[name] !== undefined)
    )
      return {
        code: error.code,
        ...(error.params ? { params: error.params } : {}),
      };
  }
  const message = error.message;
  if (Object.hasOwn(legacyMessages, message))
    return { code: legacyMessages[message] };
  if (message.startsWith("Enter valid JSON or a supported simulator link."))
    return { code: "invalidExport" };
  for (const { pattern, code, names } of patterns) {
    const match = message.match(pattern);
    if (match)
      return {
        code,
        params: Object.fromEntries(
          names.map((name, index) => [
            name,
            ["id", "count", "rank"].includes(name)
              ? Number(match[index + 1])
              : match[index + 1],
          ]),
        ),
      };
  }
  return {};
}
export function localizeDiagnostic(
  value: unknown,
  t: DiagnosticTranslator,
): string {
  const { code, params } = diagnosticIdentity(value);
  if (code) return t(code, presentationParams(params, t));
  const { message } = describeError(value);
  for (const [prefix, key] of [
    ["Equipped gear: ", "equippedError"],
    ["Custom item: ", "customError"],
  ]) {
    if (message.startsWith(prefix))
      return t(key, {
        details: localizeDiagnostic(message.slice(prefix.length), t),
      });
  }
  const details = safeOriginalDetails(message);
  return details ? t("unknownDetails", { details }) : t("unknown");
}
