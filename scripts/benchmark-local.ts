import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import {
  listSpecs,
  modules,
  defaultSettings,
} from "../src/features/settings/registry";
import { IndividualSimSettings } from "../src/generated/wotlk/ui";
import {
  parseExport,
  resolveSnapshot,
} from "../src/features/import/parse-export";
import { evaluate } from "../src/server/simulator/evaluate";
const selected = [...new Map(listSpecs().map((s) => [s.module, s])).values()],
  results = [];
for (const spec of selected) {
  const settings = defaultSettings(spec.id),
    points = spec.talents.talentsString
      .split("-")
      .map((t) => [...t].reduce((n, v) => n + Number(v), 0)),
    tree = points.indexOf(Math.max(...points));
  settings.player!.equipment = Object.values(modules[spec.module].presets).find(
    (p) =>
      p.gear &&
      (p.conditions?.talentTree === undefined ||
        p.conditions.talentTree === tree) &&
      (!p.conditions?.talentTrees || p.conditions.talentTrees.includes(tree)),
  )!.gear as NonNullable<typeof settings.player>["equipment"];
  settings.player!.profession1 = 4;
  settings.player!.profession2 = 7;
  const { snapshot } = resolveSnapshot(
    parseExport(IndividualSimSettings.toJsonString(settings), "profile"),
    spec.id,
  );
  const start = performance.now();
  const result = await evaluate(
    snapshot,
    snapshot.equipped,
    500,
    "81001",
    new AbortController().signal,
  );
  results.push({
    module: spec.module,
    preset: spec.name,
    duration: settings.encounter!.duration,
    iterations: 500,
    seconds: Number(((performance.now() - start) / 1000).toFixed(3)),
    dps: result.metric.mean,
  });
}
const evidence = {
  measuredAt: new Date().toISOString(),
  platform: process.platform,
  architecture: process.arch,
  node: process.version,
  concurrency: 1,
  results,
};
await writeFile(
  "docs/engineering/top-gear-local-benchmark.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(results);
console.log(
  "Local measurements only; Trigger production capacity is not established.",
);
