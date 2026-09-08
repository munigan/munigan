import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseExport, resolveSnapshot } from "@/features/import/parse-export";
import { listSpecs } from "@/features/settings/registry";
import { evaluate } from "@/server/simulator/evaluate";
it("evaluates an imported owned set with automatic rotation and deterministic native DPS", async () => {
  const request = JSON.parse(
    await readFile("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const player = request.raid.parties[0].players[0];
  delete player.rotation;
  const { snapshot } = resolveSnapshot(
    parseExport(
      JSON.stringify({ player, encounter: request.encounter }),
      "profile",
    ),
    listSpecs().find((s) => s.module === "warrior" && s.name.includes("Fury"))!
      .id,
  );
  const a = await evaluate(
    snapshot,
    snapshot.equipped,
    20,
    "1001",
    new AbortController().signal,
  );
  const b = await evaluate(
    snapshot,
    snapshot.equipped,
    20,
    "1001",
    new AbortController().signal,
  );
  expect(a.metric.mean).toBeGreaterThan(1000);
  expect(a).toEqual(b);
  expect(a.stats.length).toBeGreaterThan(30);
});
