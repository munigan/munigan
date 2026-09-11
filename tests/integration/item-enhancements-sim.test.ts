import { it, expect } from "vitest";
import { fixtureRequest } from "../support/fixtures";
import { evaluate, simulationInput } from "@/server/simulator/evaluate";
import { rankResults } from "@/domain/top-gear/report";
import { planRun } from "@/domain/equipment/enumerate";
import { workPolicy } from "@/server/jobs/policy";

it("simulates distinct fixed enhancements on equipped physical items and preserves the native imported reference", async () => {
  const request = fixtureRequest(),
    s = request.snapshot;
  s.gemming = undefined;
  s.autoEnchant = false;
  const legs = s.inventory.find((item) => item.equippedSlot === "legs")!;
  const inputBefore = simulationInput(s, s.equipped, 20, "1001");
  const imported = await evaluate(
    s,
    s.equipped,
    20,
    "1001",
    new AbortController().signal,
    true,
  );
  s.itemEnhancements = {
    [legs.instanceId]: { gemIds: [40112, 0], enchantId: 0 },
  };
  const plan = planRun(s, request.selection, workPolicy());
  expect(plan.simulations).toHaveLength(2);
  expect(simulationInput(s, s.equipped, 20, "1001", true)).toEqual(inputBefore);
  const reference = await evaluate(
    s,
    s.equipped,
    20,
    "1001",
    new AbortController().signal,
    true,
  );
  const candidate = await evaluate(
    s,
    s.equipped,
    20,
    "1001",
    new AbortController().signal,
    false,
  );
  expect(reference).toEqual(imported);
  expect(candidate.inputHash).not.toBe(reference.inputHash);
  expect(candidate.gemOverrides?.[legs.instanceId]).toEqual([40112, 0]);
  expect(candidate.enchantOverrides?.[legs.instanceId]).toBe(0);
  expect(candidate.metric.mean).toBeGreaterThan(1000);
  expect(candidate.stats).not.toEqual(reference.stats);
  const report = rankResults(s, [reference, candidate], plan.candidateLoadouts);
  expect(report.rows).toHaveLength(2);
  expect(report.equippedId).toBe(reference.inputHash);
  expect(
    report.rows.find((row) => row.id === candidate.inputHash),
  ).toMatchObject({ isEquipped: false, eligible: true });
});

it("stores inactive-meta warnings for an enchant-only edit with automatic gemming disabled", async () => {
  const { snapshot: s } = fixtureRequest();
  s.gemming = undefined;
  s.autoEnchant = false;
  for (const item of s.inventory)
    item.gemIds = item.gemIds.map((id, index) =>
      item.equippedSlot === "head" && index === 0 ? 41285 : id ? 40111 : 0,
    );
  const legs = s.inventory.find((item) => item.equippedSlot === "legs")!;
  s.itemEnhancements = { [legs.instanceId]: { enchantId: 0 } };
  const result = await evaluate(
    s,
    s.equipped,
    20,
    "1001",
    new AbortController().signal,
  );
  expect(
    result.gemWarnings?.some((warning) => warning.includes("inactive")),
  ).toBe(true);
});
