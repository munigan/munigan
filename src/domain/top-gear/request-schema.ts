import { z } from "zod";
import type { JsonObject } from "@protobuf-ts/runtime";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import rules from "../../../data/wotlk/equipment-rules.json";
import { Spec, Profession } from "@/generated/wotlk/common";
import { APLRotation_Type } from "@/generated/wotlk/apl";
import { validateTalents } from "@/features/settings/talents";
import { getSpec } from "@/features/settings/registry";
import { slots } from "./slots";
import type { TopGearRequest, Snapshot } from "./model";
import { validateItem, validateLoadout } from "@/domain/equipment/validate";
import versions from "../../../data/wotlk/versions.json";
import { itemVersions, itemVersionOf } from "./item-version";
import { validateGemming } from "@/domain/equipment/gemming";
const id = z.string().min(1).max(100),
  slot = z.enum(slots),
  numericId = z.number().int().nonnegative().max(10000000);
const shape = z
  .object({
    tool: z.literal("top-gear"),
    precision: z.literal("standard"),
    snapshot: z.object({
      id,
      specId: id,
      itemVersion: z.enum(["original", "classic"]).default("classic"),
      itemDataRevision: id.optional(),
      versions: z.object({
        engine: id,
        schema: id,
        catalog: id,
        presets: id,
        optimizer: id,
      }),
      settings: z.unknown(),
      professionLevels: z
        .record(z.string(), z.number().int().min(1).max(450))
        .optional(),
      gemming: z
        .object({
          enabled: z.boolean(),
          defaultGemId: numericId,
          metaGemId: numericId,
          jcGemId: numericId,
        })
        .strict()
        .optional(),
      autoEnchant: z.boolean().optional(),
      inventory: z
        .array(
          z
            .object({
              instanceId: id,
              itemId: numericId,
              enchantId: numericId,
              gemIds: z.array(numericId).max(4),
              source: z.enum(["equipped", "bag"]),
              equippedSlot: slot.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(217),
      equipped: z.record(slot, id.nullable()),
      provenance: z.record(
        z.string().max(200),
        z.enum(["imported", "preset", "edited"]),
      ),
    }),
    selection: z
      .object({
        selectedInstanceIds: z.array(id).max(217),
        acknowledgedExclusions: z.array(id).max(200),
        lockedSlots: z.partialRecord(slot, id.nullable()),
      })
      .strict(),
  })
  .strict();
export function encodeSnapshot(s: Snapshot) {
  return { ...s, settings: IndividualSimSettings.toJson(s.settings) };
}
export function decodeSnapshot(s: ReturnType<typeof encodeSnapshot>): Snapshot {
  const itemVersion = itemVersionOf(s);
  return {
    ...s,
    itemVersion,
    itemDataRevision: s.itemDataRevision ?? itemVersions[itemVersion].revision,
    settings: IndividualSimSettings.fromJson(s.settings),
  };
}
export function encodeRequest(r: TopGearRequest) {
  return { ...r, snapshot: encodeSnapshot(r.snapshot) };
}
// Drafts must be safe to edit, but need not be ready to simulate yet.
export function decodeDraft(input: unknown): TopGearRequest {
  const parsed = shape.parse(input),
    s = parsed.snapshot;
  const revision = itemVersions[s.itemVersion].revision;
  if (
    (s.itemVersion === "original" && !s.itemDataRevision) ||
    (s.itemDataRevision && s.itemDataRevision !== revision)
  )
    throw new Error(
      "This draft uses older item data. Select the current item version or import again.",
    );
  s.itemDataRevision = revision;
  const settings = IndividualSimSettings.fromJson(s.settings as JsonObject),
    p = settings.player;
  if (!p || !settings.encounter)
    throw new Error("A player and encounter are required");
  if (
    Object.entries(versions).some(
      ([k, v]) => s.versions[k as keyof typeof versions] !== v,
    )
  )
    throw new Error(
      "This draft uses an older simulator version. Import again.",
    );
  getSpec(s.specId);
  const pending: Array<[unknown, number]> = [[settings, 0]];
  let nodes = 0;
  while (pending.length) {
    const [value, depth] = pending.pop()!;
    if (++nodes > 50000 || depth > 64)
      throw new Error("Simulation configuration is too complex");
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("Simulation settings must contain finite numbers");
    if (value && typeof value === "object")
      for (const nested of Object.values(value))
        pending.push([nested, depth + 1]);
  }
  return { ...parsed, snapshot: { ...s, settings } };
}

export function validateRequest(input: unknown): TopGearRequest {
  const parsed = decodeDraft(input),
    s = parsed.snapshot;
  const settings = s.settings,
    p = settings.player!;
  const spec = getSpec(s.specId);
  if (p.class !== spec.classId)
    throw new Error("Class does not match specialization");
  const specKey = spec.module.replace(/_([a-z])/g, (_, c: string) =>
    c.toUpperCase(),
  );
  if (p.spec.oneofKind !== specKey)
    throw new Error("Player options do not match specialization");
  const enumName =
    "Spec" +
    spec.module
      .split("_")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join("");
  const specEnum = Spec[enumName as keyof typeof Spec];
  if (
    !(
      (rules.specToEligibleRaces as Record<string, number[]>)[
        String(specEnum)
      ] ?? []
    ).includes(p.race)
  )
    throw new Error("Race is not eligible for this class in Wrath");
  if (p.database)
    throw new Error("Custom simulator databases are not supported");
  if (p.enableItemSwap)
    throw new Error("In-combat item swapping is not supported");
  if (
    p.rotation?.type === APLRotation_Type.TypeSimple ||
    p.rotation?.type === APLRotation_Type.TypeLegacy
  )
    throw new Error("Choose Automatic or APL rotation before importing");
  if (!/^[0-5]{0,40}(-[0-5]{0,40}){0,2}$/.test(p.talentsString))
    throw new Error("Invalid Wrath talents");
  const encounter = settings.encounter!;
  if (
    !Number.isFinite(encounter.duration) ||
    encounter.duration < 10 ||
    encounter.duration > 600 ||
    encounter.durationVariation < 0 ||
    encounter.durationVariation > encounter.duration / 2 ||
    encounter.useHealth ||
    encounter.targets.length < 1 ||
    encounter.targets.length > 10
  )
    throw new Error("Use a 10–600 second encounter with 1–10 targets");
  if (
    encounter.targets.some(
      (t) =>
        t.level < 80 ||
        t.level > 83 ||
        t.stats.some((v) => !Number.isFinite(v) || Math.abs(v) > 1000000000000),
    )
  )
    throw new Error("Invalid target configuration");
  const snapshot: Snapshot = { ...s, settings };
  validateGemming(snapshot);
  const talentErrors = validateTalents(snapshot);
  if (talentErrors.length) throw new Error(talentErrors[0]);
  // core/professions.go applies these gathering bonuses unconditionally.
  // Crafting benefits come from gear/enchants/gems/consumes, not a blanket rank.
  const gatheringBonuses: Partial<Record<Profession, string>> = {
    [Profession.Mining]: "60 stamina",
    [Profession.Skinning]: "40 critical strike rating",
    [Profession.Herbalism]: "maximum-rank Lifeblood",
  };
  for (const profession of [p.profession1, p.profession2]) {
    const rank = snapshot.professionLevels?.[String(profession)];
    const bonus = gatheringBonuses[profession];
    if (bonus && rank !== undefined && rank < 450)
      throw new Error(
        `${Profession[profession]} ${rank}/450: the simulator applies ${bonus}, which requires 450 skill. Lower-rank gathering bonuses are not supported yet.`,
      );
  }
  const ids = new Set(snapshot.inventory.map((i) => i.instanceId));
  if (ids.size !== snapshot.inventory.length)
    throw new Error("Duplicate item instance IDs");
  for (const collection of [
    parsed.selection.selectedInstanceIds,
    parsed.selection.acknowledgedExclusions,
  ])
    if (
      new Set(collection).size !== collection.length ||
      collection.some((i) => !ids.has(i))
    )
      throw new Error("Selection must contain distinct owned instance IDs");
  for (const [key, value] of Object.entries(parsed.selection.lockedSlots))
    if (
      value !== null &&
      (!ids.has(value) || !parsed.selection.selectedInstanceIds.includes(value))
    )
      throw new Error(`Locked ${key} must be selected and owned`);
  const equippedErrors = validateLoadout(snapshot, snapshot.equipped);
  if (equippedErrors.length)
    throw new Error(`Equipped gear: ${equippedErrors[0].message}`);
  const baselineIds = Object.values(snapshot.equipped).filter(Boolean);
  if (
    snapshot.inventory.some(
      (i) =>
        i.source === "equipped" &&
        (!i.equippedSlot || snapshot.equipped[i.equippedSlot] !== i.instanceId),
    ) ||
    baselineIds.some(
      (i) =>
        snapshot.inventory.find((x) => x.instanceId === i)?.source !==
        "equipped",
    )
  )
    throw new Error("Equipped item mapping is inconsistent");
  for (const item of snapshot.inventory) {
    const errors = validateItem(snapshot, item);
    if (
      errors.length &&
      item.source === "bag" &&
      (!parsed.selection.acknowledgedExclusions.includes(item.instanceId) ||
        parsed.selection.selectedInstanceIds.includes(item.instanceId))
    )
      throw new Error(`Explicitly exclude unsupported bag item ${item.itemId}`);
  }
  if (
    parsed.selection.selectedInstanceIds.some((id) =>
      parsed.selection.acknowledgedExclusions.includes(id),
    )
  )
    throw new Error("Excluded items cannot be selected");
  // No display-only simulator state or arbitrary roster is needed by the worker.
  settings.settings = undefined;
  settings.epWeightsStats = undefined;
  settings.epRatios = [];
  p.name = p.name.slice(0, 80);
  return { ...parsed, snapshot };
}
