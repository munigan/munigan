import type { Snapshot, Loadout } from "@/domain/top-gear/model";
import { slots } from "@/domain/top-gear/slots";

export const interchangeablePairs = [
  ["finger1", "finger2"],
  ["trinket1", "trinket2"],
] as const;

export function gearIdentity(snapshot: Snapshot, loadout: Loadout) {
  const inventory = new Map(snapshot.inventory.map((i) => [i.instanceId, i]));
  const gear = slots.map((slot) => {
    const i = inventory.get(loadout[slot] ?? "");
    return i ? [i.itemId, i.enchantId, i.gemIds] : null;
  });
  for (const [a, b] of interchangeablePairs) {
    const x = slots.indexOf(a),
      y = slots.indexOf(b);
    [gear[x], gear[y]] = [gear[x], gear[y]].sort((i, j) =>
      JSON.stringify(i).localeCompare(JSON.stringify(j)),
    );
  }
  return JSON.stringify(gear);
}
