import { Class, Race, Profession } from "@/generated/wotlk/common";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import type { JsonObject, JsonValue } from "@protobuf-ts/runtime";
import type {
  Diagnostic,
  ItemInstance,
  Snapshot,
} from "@/domain/top-gear/model";
import { slots, emptyLoadout } from "@/domain/top-gear/slots";
import { defaultSettings, getSpec } from "@/features/settings/registry";
import versions from "../../../data/wotlk/versions.json";
import glyphIds from "../../../data/wotlk/glyph-names.json";
import { decodeProfileLink } from "./profile-link";
export type ImportDraft = {
  settingsJson: JsonObject;
  inventory: ItemInstance[];
  providedPaths: string[];
  diagnostics: Diagnostic[];
  classId?: Class;
  professionLevels?: Record<string, number>;
};
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function enumValue(values: object, prefix: string, value: unknown) {
  if (typeof value === "number" && Object.values(values).includes(value))
    return value;
  const found = Object.entries(values).find(
    ([k, v]) =>
      typeof v === "number" &&
      key(k.replace(prefix, "")) === key(String(value)),
  );
  if (!found) throw new Error(`Unknown ${prefix}: ${String(value)}`);
  return found[1] as number;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}
function number(value: unknown) {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Item, gem and enchant IDs must be nonnegative integers");
  return value;
}
function inventory(value: unknown, source: "bag" | "equipped"): ItemInstance[] {
  if (!Array.isArray(value))
    throw new Error("Export must include an items array");
  if (value.length > sourceMax(source))
    throw new Error("Too many exported items");
  return value.flatMap((entry, i) => {
    if (entry === null) return [];
    const item = object(entry);
    const id = number(item.id);
    if (id === 0) return [];
    const gems = item.gems ?? [];
    if (!Array.isArray(gems) || gems.length > 4)
      throw new Error("Invalid gem slots");
    return [
      {
        instanceId: `${source}-${i}-${id}`,
        itemId: id,
        enchantId: number(item.enchant),
        gemIds: gems.map(number),
        source,
        ...(source === "equipped" ? { equippedSlot: slots[i] } : {}),
      },
    ];
  });
}
function sourceMax(source: string) {
  return source === "bag" ? 200 : 17;
}
function paths(value: JsonObject, prefix = ""): string[] {
  return Object.entries(value).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? paths(v as JsonObject, `${prefix}${k}.`)
      : [prefix + k],
  );
}
export function parseExport(
  text: string,
  kind: "character" | "bags" | "profile",
): ImportDraft {
  if (text.length > 1024 * 1024) throw new Error("Export exceeds 1 MB");
  let data: Record<string, unknown>;
  try {
    data = object(
      kind === "profile" && text.trim().startsWith("https://")
        ? decodeProfileLink(text.trim())
        : JSON.parse(text),
    );
  } catch (error) {
    throw new Error(
      `Enter valid JSON or a supported simulator link. ${error instanceof Error ? error.message : ""}`,
    );
  }
  // Reject hostile nested keys and excessively deep input before merging.
  const check = (v: unknown, depth = 0) => {
    if (depth > 64) throw new Error("Export nesting limit exceeded");
    if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw new Error("Invalid export key");
        check(x, depth + 1);
      }
  };
  check(data);
  if (kind === "bags")
    return {
      settingsJson: {},
      inventory: inventory(data.items, "bag"),
      providedPaths: [],
      diagnostics: [],
    };
  if (data.level !== undefined && data.level !== 80)
    throw new Error("This importer supports level 80 Wrath characters");
  let settingsJson: JsonObject, items: ItemInstance[], classId: Class;
  const professionLevels: Record<string, number> = {};
  if (kind === "profile") {
    const parsed = IndividualSimSettings.fromJson(data as JsonObject);
    if (!parsed.player) throw new Error("Profile is missing a player");
    if (parsed.player.class < 1 || parsed.player.class > 10)
      throw new Error("Profile is missing a supported Wrath class");
    if (parsed.player.enableItemSwap)
      throw new Error("Disable in-combat item swap before importing Top Gear");
    // Present protobuf message categories are authoritative, including omitted
    // proto3 scalar defaults. Absent categories still use the chosen preset.
    const expanded = IndividualSimSettings.toJson(parsed, {
      emitDefaultValues: true,
    }) as JsonObject;
    settingsJson = { ...data } as JsonObject;
    for (const field of ["raidBuffs", "partyBuffs", "debuffs", "encounter"])
      if (Object.hasOwn(data, field)) settingsJson[field] = expanded[field];
    const originalPlayer = object(data.player),
      expandedPlayer = expanded.player as JsonObject;
    const playerJson = { ...originalPlayer } as JsonObject;
    for (const field of [
      "buffs",
      "consumes",
      "glyphs",
      "rotation",
      "bonusStats",
      ...(parsed.player.spec.oneofKind ? [parsed.player.spec.oneofKind] : []),
    ])
      if (Object.hasOwn(originalPlayer, field))
        playerJson[field] = expandedPlayer[field];
    settingsJson.player = playerJson;
    classId = parsed.player.class;
    items = inventory(object(object(data.player).equipment).items, "equipped");
  } else {
    classId = enumValue(Class, "Class", data.class);
    const race = enumValue(Race, "Race", data.race);
    items = inventory(object(data.gear).items, "equipped");
    const player: JsonObject = {
      name: String(data.name ?? "Character").slice(0, 80),
      class: classId,
      race,
      equipment: { items: [] },
    };
    if (data.talents !== undefined) {
      if (
        typeof data.talents !== "string" ||
        !/^[0-5]*(-[0-5]*){0,2}$/.test(data.talents)
      )
        throw new Error("Invalid Wrath talent string");
      player.talentsString = data.talents;
    }
    if (data.professions !== undefined) {
      if (!Array.isArray(data.professions) || data.professions.length > 2)
        throw new Error("Invalid professions");
      const values = data.professions.map((p) => {
        const entry = object(p),
          id = enumValue(Profession, "Profession", entry.name);
        if (entry.level !== undefined) {
          if (
            typeof entry.level !== "number" ||
            !Number.isInteger(entry.level) ||
            entry.level < 1 ||
            entry.level > 450
          )
            throw new Error("Invalid profession skill rank");
          professionLevels[id] = entry.level;
        }
        return id;
      });
      player.profession1 = values[0] ?? 0;
      player.profession2 = values[1] ?? 0;
    }
    if (data.glyphs !== undefined) {
      const input = object(data.glyphs);
      if (input.prime) throw new Error("This export is not Wrath");
      const glyphs: JsonObject = {};
      for (const group of ["major", "minor"]) {
        const list = input[group];
        if (!Array.isArray(list) || list.length > 3)
          throw new Error("Invalid glyphs");
        for (let i = 0; i < 3; i++) {
          const name = list[i];
          const id =
            name === undefined
              ? 0
              : (glyphIds as Record<string, Record<string, number>>)[
                  String(classId)
                ]?.[key(String(name))];
          if (id === undefined)
            throw new Error(
              `Unknown glyph: ${String(name)}. Use an English exporter or a simulator profile.`,
            );
          glyphs[`${group}${i + 1}`] = id;
        }
      }
      player.glyphs = glyphs;
    }
    settingsJson = { player };
  }
  return {
    settingsJson,
    inventory: items,
    providedPaths: paths(settingsJson),
    diagnostics: [],
    classId,
    professionLevels,
  };
}
export function mergeJson(base: JsonObject, patch: JsonObject): JsonObject {
  const result = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (["__proto__", "prototype", "constructor"].includes(k))
      throw new Error("Invalid key");
    result[k] =
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      base[k] &&
      typeof base[k] === "object" &&
      !Array.isArray(base[k])
        ? mergeJson(base[k] as JsonObject, v as JsonObject)
        : v;
  }
  return result;
}
export function resolveSnapshot(
  draft: ImportDraft,
  presetId: string,
): { snapshot: Snapshot; diagnostics: Diagnostic[] } {
  const spec = getSpec(presetId);
  if (draft.classId !== undefined && draft.classId !== spec.classId)
    throw new Error("Choose a specialization matching the imported class");
  const base = defaultSettings(presetId);
  const settings = IndividualSimSettings.fromJson(
    mergeJson(
      IndividualSimSettings.toJson(base) as JsonObject,
      draft.settingsJson,
    ),
  );
  const equipped = emptyLoadout();
  for (const item of draft.inventory) {
    if (item.source === "equipped" && item.equippedSlot)
      equipped[item.equippedSlot] = item.instanceId;
  }
  if (settings.player)
    settings.player.equipment = {
      items: slots.map((slot) => {
        const item = draft.inventory.find(
          (i) => i.instanceId === equipped[slot],
        );
        return {
          id: item?.itemId ?? 0,
          enchant: item?.enchantId ?? 0,
          gems: item?.gemIds ?? [],
        };
      }),
    };
  return {
    snapshot: {
      id: crypto.randomUUID(),
      specId: presetId,
      versions,
      professionLevels: draft.professionLevels,
      settings,
      inventory: draft.inventory,
      equipped,
      provenance: Object.fromEntries([
        ...paths(IndividualSimSettings.toJson(base) as JsonObject).map((p) => [
          p,
          "preset",
        ]),
        ...draft.providedPaths.map((p) => [p, "imported"]),
      ]),
    },
    diagnostics: draft.diagnostics,
  };
}
export function applyBagImport(
  snapshot: Snapshot,
  items: ItemInstance[],
): Snapshot {
  return {
    ...snapshot,
    inventory: [
      ...snapshot.inventory.filter((i) => i.source === "equipped"),
      ...items,
    ],
  };
}
export function applySettingsPatch(
  snapshot: Snapshot,
  patch: JsonObject,
): Snapshot {
  const settings = IndividualSimSettings.fromJson(
    mergeJson(
      IndividualSimSettings.toJson(snapshot.settings) as JsonObject,
      patch,
    ),
  );
  return {
    ...snapshot,
    settings,
    provenance: {
      ...snapshot.provenance,
      ...Object.fromEntries(paths(patch).map((p) => [p, "edited"])),
    },
  };
}
export type { JsonValue };
