import { it, expect } from "vitest";
import { rankResults, compareMetrics, changedSlots } from "./report";
import { emptyLoadout } from "./slots";
import type { Snapshot, SimulationResult, Loadout } from "./model";
const equipped = { ...emptyLoadout(), head: "a", chest: "b" };
const snapshot = {
  equipped,
  inventory: [
    { instanceId: "a", itemId: 1, enchantId: 0, gemIds: [] },
    { instanceId: "b", itemId: 2, enchantId: 0, gemIds: [] },
    { instanceId: "x", itemId: 3, enchantId: 0, gemIds: [] },
    { instanceId: "y", itemId: 4, enchantId: 0, gemIds: [] },
  ],
} as unknown as Snapshot;
const row = (
  loadout: Loadout,
  mean: number,
  stdev: number | null = 100,
): SimulationResult => ({
  loadout,
  metric: { mean, stdev, iterations: 5000 },
  inputHash: String(mean),
  stats: [],
});
it("retains interacting combinations and negative gains against the equipped reference", () => {
  const values = [
    row(equipped, 10000),
    row({ ...equipped, head: "x" }, 9990),
    row({ ...equipped, chest: "y" }, 9980),
    row({ ...equipped, head: "x", chest: "y" }, 10200),
  ];
  const r = rankResults(
    snapshot,
    values,
    values.slice(1).map((v) => v.loadout),
  );
  expect(r.rows.map((x) => x.dps)).toEqual([10200, 10000, 9990, 9980]);
  expect(r.rows[0].gain).toBe(200);
  expect(r.rows[1].eligible).toBe(false);
  expect(r.rows[3].gain).toBe(-20);
  expect(r.highestId).toBe(r.rows[0].id);
});
it("does not recommend unverified caps or change numeric ordering for fewer swaps", () => {
  const values = [
    row(equipped, 10000),
    row({ ...equipped, head: "x", chest: "y" }, 10200, 200),
    row({ ...equipped, head: "x" }, 10196, 200),
  ];
  const r = rankResults(
    snapshot,
    values,
    values.map((v) => v.loadout),
  );
  expect(r.highestId).toBe(r.rows[0].id);
  expect(r.recommendedId).toBeNull();
  expect(r.rows[0].swaps).toBe(2);
});
it("does not invent uncertainty or percentages for a zero baseline", () => {
  expect(
    compareMetrics(
      { mean: 1, stdev: null, iterations: 5 },
      { mean: 0, stdev: 0, iterations: 5 },
    ),
  ).toEqual({ gain: 1, percent: null, tied: null });
});
it("ignores pair permutations in changes and counts a single ring replacement once", () => {
  const base = {
    ...emptyLoadout(),
    finger1: "a",
    finger2: "b",
    trinket1: "x",
    trinket2: "y",
  };
  expect(
    changedSlots(snapshot, base, {
      ...base,
      finger1: "b",
      finger2: "a",
      trinket1: "y",
      trinket2: "x",
    }),
  ).toEqual([]);
  expect(
    changedSlots(snapshot, base, { ...base, finger1: "b", finger2: "x" }),
  ).toEqual(["finger1"]);
});
it("collapses legacy permutations without picking their lucky higher DPS over the equipped baseline", () => {
  const base = { ...emptyLoadout(), finger1: "a", finger2: "b" };
  const s = { ...snapshot, equipped: base };
  const swapped = { ...base, finger1: "b", finger2: "a" };
  const replaced = { ...base, finger1: "x" };
  const r = rankResults(
    s,
    [row(swapped, 10100), row(replaced, 9900), row(base, 10000)],
    [base, swapped, replaced],
  );
  expect(r.rows).toHaveLength(2);
  expect(r.rows[0]).toMatchObject({
    isEquipped: true,
    dps: 10000,
    gain: 0,
    swaps: 0,
    loadout: base,
  });
  expect(r.rows[1]).toMatchObject({ gain: -100, swaps: 1 });
  expect(r.highestId).toBe(r.equippedId);
});
