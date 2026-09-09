import type {
  Snapshot,
  Selection,
  Loadout,
  WorkPolicy,
  Allowance,
  RunPlan,
} from "@/domain/top-gear/model";
import { slots, emptyLoadout } from "@/domain/top-gear/slots";
import { getCatalog, type Catalog } from "./catalog";
import { HandType, WeaponType } from "@/generated/wotlk/common";
import { readTalents } from "@/features/settings/talents";
import { canEquip, validateLoadout } from "./validate";
import { itemVersionOf, itemVersions } from "@/domain/top-gear/item-version";
import { gearIdentity, interchangeablePairs } from "./identity";
import { prepareGems, gemmingRevision } from "./gemming";
import {
  prepareEnchants,
  withEnhancements,
  enchantRevision,
} from "./enhancements";
export function itemKey(snapshot: Snapshot, id: string | null) {
  const item = snapshot.inventory.find((i) => i.instanceId === id);
  return JSON.stringify(
    item ? [item.itemId, item.enchantId, item.gemIds] : null,
  );
}
// Keep shared items in their reference slots; a replacement should be one swap.
// Slot locks constrain placement, but do not create a second gear identity.
export function alignPairedSlots(
  snapshot: Snapshot,
  loadout: Loadout,
  reference = snapshot.equipped,
  locks: Selection["lockedSlots"] = {},
): Loadout {
  const aligned = { ...loadout };
  for (const [a, b] of interchangeablePairs) {
    if (Object.hasOwn(locks, a) || Object.hasOwn(locks, b)) continue;
    const matches = (x: string | null, y: string | null) =>
      Number(itemKey(snapshot, x) === itemKey(snapshot, reference[a])) +
      Number(itemKey(snapshot, y) === itemKey(snapshot, reference[b]));
    if (matches(aligned[b], aligned[a]) > matches(aligned[a], aligned[b]))
      [aligned[a], aligned[b]] = [aligned[b], aligned[a]];
  }
  return aligned;
}
export function loadoutKey(snapshot: Snapshot, loadout: Loadout) {
  const profile = itemVersionOf(snapshot);
  const gemming = snapshot.gemming?.enabled
    ? `${gemmingRevision}-${snapshot.gemming.defaultGemId}-${snapshot.gemming.metaGemId}-${snapshot.gemming.jcGemId}:`
    : "";
  return (
    `${profile}:${snapshot.itemDataRevision ?? itemVersions[profile].revision}:pairs-v2:${gemming}${snapshot.autoEnchant ? `${enchantRevision}:` : ""}` +
    gearIdentity(
      withEnhancements(
        snapshot,
        prepareGems(snapshot, loadout).overrides,
        prepareEnchants(snapshot, loadout).overrides,
      ),
      loadout,
    )
  );
}
function choices(snapshot: Snapshot, selection: Selection, catalog: Catalog) {
  return slots.map((slot) => {
    if (Object.hasOwn(selection.lockedSlots, slot))
      return [selection.lockedSlots[slot] ?? null];
    const values = snapshot.inventory
      .filter(
        (i) =>
          selection.selectedInstanceIds.includes(i.instanceId) &&
          catalog.items.has(i.itemId) &&
          canEquip(snapshot, catalog.items.get(i.itemId)!, slot),
      )
      .map((i) => i.instanceId) as (string | null)[];
    if (
      snapshot.equipped[slot] === null ||
      (slot === "offHand" &&
        snapshot.inventory.some(
          (i) =>
            selection.selectedInstanceIds.includes(i.instanceId) &&
            catalog.items.has(i.itemId) &&
            canEquip(snapshot, catalog.items.get(i.itemId)!, "mainHand") &&
            catalog.items.get(i.itemId)?.handType ===
              HandType.HandTypeTwoHand &&
            (!readTalents(snapshot).titansGrip ||
              [
                WeaponType.WeaponTypePolearm,
                WeaponType.WeaponTypeStaff,
              ].includes(catalog.items.get(i.itemId)!.weaponType)),
        ))
    )
      values.push(null);
    return values;
  });
}
export function* enumerateLoadouts(
  snapshot: Snapshot,
  selection: Selection,
  catalog: Catalog = getCatalog(snapshot.itemVersion),
  maxNodes = 100000,
): Generator<Loadout> {
  const domains = choices(snapshot, selection, catalog),
    loadout = emptyLoadout(),
    used = new Set<string>(),
    seen = new Set<string>();
  let visited = 0;
  function* visit(index: number): Generator<Loadout> {
    if (++visited > maxNodes) throw new Error("Search limit reached");
    if (index === slots.length) {
      const gemmed = withEnhancements(
        snapshot,
        prepareGems(snapshot, loadout, catalog).overrides,
        prepareEnchants(snapshot, loadout, catalog).overrides,
      );
      if (validateLoadout(gemmed, loadout, catalog).length === 0) {
        const key = loadoutKey(snapshot, loadout);
        if (!seen.has(key)) {
          seen.add(key);
          yield alignPairedSlots(
            snapshot,
            loadout,
            snapshot.equipped,
            selection.lockedSlots,
          );
        }
      }
      return;
    }
    for (const id of domains[index]) {
      if (id !== null && used.has(id)) continue;
      loadout[slots[index]] = id;
      if (id !== null) used.add(id);
      yield* visit(index + 1);
      if (id !== null) used.delete(id);
    }
    loadout[slots[index]] = null;
  }
  yield* visit(0);
}
export function allowanceForCount(
  count: number,
  policy: WorkPolicy,
  countKind: Allowance["countKind"] = "exact",
): Allowance {
  const units = count * policy.unitsPerSet;
  return {
    count,
    countKind,
    units: Number.isSafeInteger(units) ? units : Number.MAX_SAFE_INTEGER,
    allowed:
      Number.isSafeInteger(units) && units <= policy.maxUnits && count > 0,
    policyVersion: policy.version,
  };
}
export function estimateAllowance(
  snapshot: Snapshot,
  selection: Selection,
  policy: WorkPolicy,
  catalog: Catalog = getCatalog(snapshot.itemVersion),
): Allowance {
  const domains = choices(snapshot, selection, catalog);
  let count = 1;
  const paired = new Set([10, 11, 12, 13, 14, 15]);
  for (let i = 0; i < slots.length; i++)
    if (!paired.has(i)) {
      count *= domains[i].length;
      if (!Number.isSafeInteger(count)) count = Number.MAX_SAFE_INTEGER;
    }
  // Paired slots are a bounded local calculation, not a Cartesian gear search.
  // Respect physical copies; only weapon hands retain ordered identity.
  let includesEquipped = domains.every(
    (values, i) =>
      paired.has(i) ||
      values.some(
        (id) =>
          itemKey(snapshot, id) ===
          itemKey(snapshot, snapshot.equipped[slots[i]]),
      ),
  );
  for (const [a, b] of [
    [10, 11],
    [12, 13],
    [14, 15],
  ]) {
    const pairs = new Set<string>();
    for (const x of domains[a])
      for (const y of domains[b]) {
        if (x !== null && x === y) continue;
        const loadout = emptyLoadout();
        loadout[slots[a]] = x;
        loadout[slots[b]] = y;
        // Gem repair depends on the whole set. Count raw pair identities here
        // and leave gem-limit filtering to full-set enumeration.
        const diagnostics = validateLoadout(snapshot, loadout, catalog);
        if (
          diagnostics.every(
            (d) => snapshot.gemming?.enabled && d.path === "gems",
          )
        )
          pairs.add(gearIdentity(snapshot, loadout));
      }
    count *= pairs.size;
    if (!Number.isSafeInteger(count)) count = Number.MAX_SAFE_INTEGER;
    const reference = emptyLoadout();
    reference[slots[a]] = snapshot.equipped[slots[a]];
    reference[slots[b]] = snapshot.equipped[slots[b]];
    includesEquipped &&= pairs.has(gearIdentity(snapshot, reference));
  }
  if (!includesEquipped) count = Math.min(Number.MAX_SAFE_INTEGER, count + 1);
  return allowanceForCount(count, policy, "upper-bound");
}
export function planRun(
  snapshot: Snapshot,
  selection: Selection,
  policy: WorkPolicy,
  catalog: Catalog = getCatalog(snapshot.itemVersion),
): RunPlan {
  const estimate = estimateAllowance(snapshot, selection, policy, catalog);
  if (!estimate.allowed)
    throw new Error("Selection exceeds the free allowance");
  const candidateLoadouts = [
    ...enumerateLoadouts(snapshot, selection, catalog, policy.maxSearchNodes),
  ];
  if (!candidateLoadouts.length)
    throw new Error("No legal selected gear combinations");
  const keyed = new Map<string, Loadout>();
  keyed.set(loadoutKey(snapshot, snapshot.equipped), snapshot.equipped);
  for (const l of candidateLoadouts) {
    const key = loadoutKey(snapshot, l);
    if (!keyed.has(key)) keyed.set(key, l);
  }
  const simulations = [...keyed].map(([key, loadout], index) => ({
    key,
    loadout,
    seed: String(100000 + index * (policy.iterationsPerSet + 1)),
    iterations: policy.iterationsPerSet,
  }));
  return {
    candidateLoadouts,
    reference: snapshot.equipped,
    simulations,
    allowance: allowanceForCount(simulations.length, policy),
  };
}
