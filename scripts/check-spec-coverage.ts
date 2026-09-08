import { listSpecs, defaultSettings } from "../src/features/settings/registry";
import { IndividualSimSettings } from "../src/generated/wotlk/ui";
import { Spec } from "../src/generated/wotlk/common";
import rules from "../data/wotlk/equipment-rules.json";
import { autoRotations } from "../src/generated/wotlk/auto-rotations";
const specs = listSpecs();
if (new Set(specs.map((s) => s.module)).size !== 13)
  throw new Error("DPS module coverage changed");
for (const spec of specs) {
  const settings = defaultSettings(spec.id);
  IndividualSimSettings.fromJson(IndividualSimSettings.toJson(settings));
  if (!Object.hasOwn(autoRotations, spec.module))
    throw new Error(`Missing rotation: ${spec.id}`);
  const name =
    "Spec" +
    spec.module
      .split("_")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join("");
  if (
    !(rules.specToEligibleRaces as Record<string, number[]>)[
      String(Spec[name as keyof typeof Spec])
    ].includes(settings.player!.race)
  )
    throw new Error(`Invalid default race: ${spec.id}`);
}
console.log(
  `${specs.length} talent presets across 13 DPS simulator modules, with valid default races and automatic rotations. Run test:sim for native evidence.`,
);
