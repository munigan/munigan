import { expect, it } from "vitest";
import { fixtureRequest } from "../support/fixtures";
import { addCustomItems } from "@/domain/equipment/custom-items";
import { planRun } from "@/domain/equipment/enumerate";
import { defaultGemming } from "@/domain/equipment/gemming";
import { itemVersions, type ItemVersion } from "@/domain/top-gear/item-version";
import {
  encodeRequest,
  validateRequest,
} from "@/domain/top-gear/request-schema";
import { evaluate, simulationInput } from "@/server/simulator/evaluate";

it.each<ItemVersion>(["original", "classic"])(
  "evaluates a custom candidate through the native %s simulator with enhancement overrides",
  async (version) => {
    const imported = fixtureRequest();
    imported.snapshot.itemVersion = version;
    imported.snapshot.itemDataRevision = itemVersions[version].revision;
    const request = addCustomItems(imported, "head", [50712]);
    request.snapshot.autoEnchant = true;
    request.snapshot.gemming = defaultGemming(request.snapshot);
    const admitted = validateRequest(encodeRequest(request));
    const before = encodeRequest(admitted);
    const plan = planRun(admitted.snapshot, admitted.selection, {
      version: "custom-test",
      unitsPerSet: 20,
      maxUnits: 2400,
      iterationsPerSet: 20,
      maxSearchNodes: 10000,
      maxJobSeconds: 60,
      maxAttempts: 1,
    });
    expect(plan.simulations).toHaveLength(2);
    const candidate = plan.simulations.find(
      (s) => s.loadout.head === "custom-50712",
    )!;
    expect(candidate).toBeDefined();
    const input = simulationInput(
      admitted.snapshot,
      candidate.loadout,
      20,
      "12345",
    );
    const head = input.raid!.parties[0].players[0].equipment!.items[0];
    expect(head.id).toBe(50712);
    expect(head.enchant).toBeGreaterThan(0);
    expect(head.gems.some(Boolean)).toBe(true);
    const result = await evaluate(
      admitted.snapshot,
      candidate.loadout,
      20,
      "12345",
      new AbortController().signal,
    );
    expect(result.metric.mean).toBeGreaterThan(1000);
    expect(result.stats.length).toBeGreaterThan(30);
    expect(result.gemOverrides?.["custom-50712"]).toBeDefined();
    expect(result.enchantOverrides?.["custom-50712"]).toBeGreaterThan(0);
    expect(encodeRequest(admitted)).toEqual(before);
  },
);
