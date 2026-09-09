import { expect, it } from "vitest";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import { emptyLoadout } from "@/domain/top-gear/slots";
import type { Snapshot } from "@/domain/top-gear/model";
import { Profession } from "@/generated/wotlk/common";
import { getCatalog } from "./catalog";
import {
  defaultGemming,
  prepareGems,
  withGemOverrides,
  metaDeficit,
} from "./gemming";
import { simulationInput } from "@/server/simulator/evaluate";
import { enumerateLoadouts, loadoutKey } from "./enumerate";
import { validateLoadout } from "./validate";
import { changedResultSlots, rankResults } from "@/domain/top-gear/report";
import {
  encodeRequest,
  decodeDraft,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import versions from "../../../data/wotlk/versions.json";
import { itemVersions } from "@/domain/top-gear/item-version";

function fixture() {
  const spec = listSpecs().find((s) => s.module === "deathknight")!;
  const snapshot: Snapshot = {
    id: "gems",
    specId: spec.id,
    itemVersion: "original",
    versions: {
      engine: "test",
      schema: "test",
      presets: "test",
      catalog: "test",
      optimizer: "test",
    },
    settings: defaultSettings(spec.id),
    equipped: emptyLoadout(),
    provenance: {},
    inventory: [
      {
        instanceId: "head",
        itemId: 48493,
        enchantId: 0,
        gemIds: [41398, 49110],
        source: "equipped",
        equippedSlot: "head",
      },
      {
        instanceId: "chest",
        itemId: 47449,
        enchantId: 0,
        gemIds: [40111, 40111, 40111],
        source: "equipped",
        equippedSlot: "chest",
      },
      {
        instanceId: "legs",
        itemId: 48494,
        enchantId: 0,
        gemIds: [42142, 42142],
        source: "equipped",
        equippedSlot: "legs",
      },
      {
        instanceId: "ring",
        itemId: 45534,
        enchantId: 0,
        gemIds: [42142],
        source: "equipped",
        equippedSlot: "finger1",
      },
      {
        instanceId: "plain-ring",
        itemId: 40370,
        enchantId: 0,
        gemIds: [],
        source: "bag",
      },
      {
        instanceId: "socket-ring",
        itemId: 51001,
        enchantId: 0,
        gemIds: [],
        source: "bag",
      },
      {
        instanceId: "belt",
        itemId: 51000,
        enchantId: 0,
        gemIds: [],
        source: "bag",
      },
    ],
  };
  snapshot.settings.player!.profession1 = Profession.Jewelcrafting;
  snapshot.settings.player!.profession2 = Profession.Engineering;
  snapshot.professionLevels = { [Profession.Jewelcrafting]: 440 };
  for (const i of snapshot.inventory)
    if (i.equippedSlot) snapshot.equipped[i.equippedSlot] = i.instanceId;
  snapshot.gemming = defaultGemming(snapshot);
  return snapshot;
}
const gemsFor = (s: Snapshot, loadout = s.equipped) => {
  const plan = prepareGems(s, loadout);
  const resolved = withGemOverrides(s, plan.overrides);
  return {
    plan,
    resolved,
    gems: Object.values(loadout).flatMap(
      (id) => resolved.inventory.find((i) => i.instanceId === id)?.gemIds ?? [],
    ),
  };
};

it("uses equipped gem defaults and preserves the equipped reference exactly", () => {
  const s = fixture();
  expect(s.gemming).toMatchObject({
    defaultGemId: 40111,
    metaGemId: 41398,
    jcGemId: 42142,
  });
  expect(prepareGems(s, s.equipped).overrides).toEqual({});
  const swapped = { ...s.equipped, finger1: null, finger2: "ring" };
  expect(prepareGems(s, swapped).overrides).toEqual({});
});

it("fills native and buckle sockets, preserves filled gems, and passes them to the CLI", () => {
  const s = fixture(),
    before = structuredClone(s.inventory);
  const loadout = { ...s.equipped, waist: "belt", finger2: "socket-ring" };
  const { plan, resolved } = gemsFor(s, loadout);
  expect(plan.overrides.belt).toEqual([40111, 40111, 40111]);
  expect(plan.overrides["socket-ring"]).toEqual([40111]);
  expect(
    resolved.inventory.find((i) => i.instanceId === "head")?.gemIds,
  ).toEqual([41398, 49110]);
  expect(
    simulationInput(s, loadout, 20, "1001").raid!.parties[0].players[0]
      .equipment!.items[7].gems,
  ).toEqual([40111, 40111, 40111]);
  expect(s.inventory).toEqual(before);
});

it("fills the blacksmith-only wrist socket only when the profession is present", () => {
  const s = fixture();
  s.inventory.push({
    instanceId: "wrist",
    itemId: 48008,
    enchantId: 0,
    gemIds: [],
    source: "bag",
  });
  const loadout = { ...s.equipped, wrist: "wrist" };
  expect(prepareGems(s, loadout).overrides.wrist).toEqual([40111]);
  s.settings.player!.profession2 = Profession.Blacksmithing;
  expect(prepareGems(s, loadout).overrides.wrist).toEqual([40111, 40111]);
});

it("relocates a lost Dragon's Eye into a regular gem when the replacement has no socket", () => {
  const s = fixture(),
    loadout = { ...s.equipped, finger1: "plain-ring" };
  const { plan, gems, resolved } = gemsFor(s, loadout);
  expect(gems.filter((id) => id === 42142)).toHaveLength(3);
  expect(plan.overrides.chest.filter((id) => id === 42142)).toHaveLength(1);
  expect(gems).toContain(49110);
  expect(metaDeficit(41398, gems, getCatalog("original"))).toBe(0);
  expect(validateLoadout(resolved, loadout)).toEqual([]);
});

it("repairs more than three JC gems before enumeration rejects the candidate", () => {
  const s = fixture();
  s.inventory.find((i) => i.instanceId === "socket-ring")!.gemIds = [42142];
  const loadout = { ...s.equipped, finger2: "socket-ring" };
  const { gems, resolved } = gemsFor(s, loadout);
  expect(gems.filter((id) => id === 42142)).toHaveLength(3);
  expect(validateLoadout(resolved, loadout)).toEqual([]);
  expect([
    ...enumerateLoadouts(s, {
      selectedInstanceIds: Object.values(loadout).filter(
        (id): id is string => !!id,
      ),
      lockedSlots: loadout,
      acknowledgedExclusions: [],
    }),
  ]).toContainEqual(loadout);
});

it("honors an edited default and keeps keys separate from old ungemmed runs", () => {
  const s = fixture(),
    loadout = { ...s.equipped, waist: "belt" };
  const key = loadoutKey(s, loadout);
  s.gemming!.defaultGemId = 40112;
  expect(prepareGems(s, loadout).overrides.belt).toEqual([40112, 40112, 40112]);
  expect(loadoutKey(s, loadout)).not.toBe(key);
  delete s.gemming;
  expect(prepareGems(s, loadout).overrides).toEqual({});
  expect(loadoutKey(s, loadout)).not.toBe(key);
});

it("fills an empty meta socket and restores its color requirements when its supporting gem is lost", () => {
  const s = fixture();
  s.inventory.push({
    instanceId: "new-head",
    itemId: 48493,
    enchantId: 0,
    gemIds: [],
    source: "bag",
  });
  const loadout = { ...s.equipped, head: "new-head" };
  const { plan, gems } = gemsFor(s, loadout);
  expect(plan.overrides["new-head"][0]).toBe(41398);
  expect(metaDeficit(41398, gems, getCatalog("original"))).toBe(0);
  expect(gems.filter((id) => id === 42142)).toHaveLength(3);
  expect(plan.warnings).toEqual([]);
});

it("does not add JC gems without the profession, and explains insufficient sockets", () => {
  const s = fixture();
  const loadout = { ...emptyLoadout(), head: "head", finger1: "plain-ring" };
  expect(gemsFor(s, loadout).plan.warnings.join(" ")).toMatch(/three|3/i);
  s.settings.player!.profession1 = Profession.Mining;
  expect(gemsFor(s, loadout).gems).not.toContain(42142);
});

it("keeps an impossible meta inactive in native input instead of granting its bonus", () => {
  const s = fixture();
  s.inventory.find((i) => i.instanceId === "head")!.gemIds = [41398, 40111];
  const loadout = { ...emptyLoadout(), head: "head", finger1: "plain-ring" };
  const input = simulationInput(s, loadout, 20, "1001");
  expect(input.raid!.parties[0].players[0].equipment!.items[0].gems[0]).toBe(0);
  expect(s.inventory.find((i) => i.instanceId === "head")!.gemIds[0]).toBe(
    41398,
  );
});

it("stores the simulated gems in ranked results and highlights relocated gems on unchanged items", () => {
  const s = fixture(),
    loadout = { ...s.equipped, finger1: "plain-ring" };
  const plan = prepareGems(s, loadout);
  const baseline = {
    loadout: s.equipped,
    inputHash: "base",
    metric: { mean: 1000, iterations: 20, stdev: 10 },
    stats: [],
  };
  const candidate = {
    ...baseline,
    loadout,
    inputHash: "new",
    gemOverrides: plan.overrides,
    gemWarnings: plan.warnings,
  };
  const row = rankResults(s, [baseline, candidate], [loadout]).rows.find(
    (r) => r.id === "new",
  )!;
  expect(row.gemOverrides).toEqual(plan.overrides);
  expect(
    changedResultSlots(s, s.equipped, row.loadout, {}, row.gemOverrides),
  ).toEqual(["chest", "finger1"]);
  expect(
    changedResultSlots(
      s,
      row.loadout,
      row.loadout,
      row.gemOverrides,
      row.gemOverrides,
    ),
  ).toEqual([]);
});

it("retains gem settings in draft serialization and rejects unique/profession gems as defaults", () => {
  const s = fixture();
  s.versions = versions;
  s.itemDataRevision = itemVersions.original.revision;
  const request = {
    tool: "top-gear" as const,
    precision: "standard" as const,
    snapshot: s,
    selection: {
      selectedInstanceIds: [],
      acknowledgedExclusions: [],
      lockedSlots: {},
    },
  };
  expect(decodeDraft(encodeRequest(request)).snapshot.gemming).toEqual(
    s.gemming,
  );
  for (const id of [49110, 42142, 41398, 999999]) {
    s.gemming!.defaultGemId = id;
    expect(() => validateRequest(encodeRequest(request))).toThrow(
      /default gem/,
    );
  }
});

it("places the same gems for reordered ring pairs without making a second set identity", () => {
  const s = fixture();
  const a = { ...s.equipped, finger1: "plain-ring", finger2: "socket-ring" };
  const b = { ...a, finger1: a.finger2, finger2: a.finger1 };
  expect(prepareGems(s, a)).toEqual(prepareGems(s, b));
  expect(loadoutKey(s, a)).toBe(loadoutKey(s, b));
});
