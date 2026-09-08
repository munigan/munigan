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
export function loadoutKey(snapshot: Snapshot, loadout: Loadout) {
  const map = new Map(snapshot.inventory.map((i) => [i.instanceId, i]));
  const profile = itemVersionOf(snapshot);
  return (
    `${profile}:${snapshot.itemDataRevision ?? itemVersions[profile].revision}:` +
    JSON.stringify(
      slots.map((s) => {
        const i = map.get(loadout[s] ?? "");
        return i ? [i.itemId, i.enchantId, i.gemIds] : null;
      }),
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
      if (validateLoadout(snapshot, loadout, catalog).length === 0) {
        const key = loadoutKey(snapshot, loadout);
        if (!seen.has(key)) {
          seen.add(key);
          yield { ...loadout };
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
  // Respect physical copies and preserve ordered mechanical inputs.
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
        if (validateLoadout(snapshot, loadout, catalog).length === 0)
          pairs.add(loadoutKey(snapshot, loadout));
      }
    count *= pairs.size;
    if (!Number.isSafeInteger(count)) count = Number.MAX_SAFE_INTEGER;
  }
  const includesEquipped = domains.every((values, i) =>
    values.includes(snapshot.equipped[slots[i]]),
  );
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
  for (const l of candidateLoadouts) keyed.set(loadoutKey(snapshot, l), l);
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
