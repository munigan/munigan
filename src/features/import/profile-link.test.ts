import { it, expect } from "vitest";
import { zlibSync } from "fflate";
import { IndividualSimSettings } from "@/generated/wotlk/ui";
import { defaultSettings, listSpecs } from "@/features/settings/registry";
import { parseExport, resolveSnapshot } from "./parse-export";
function link(s: ReturnType<typeof defaultSettings>, categories: string) {
  return (
    "https://poli93.github.io/wotlk/warrior/?i=" +
    categories +
    "#" +
    btoa(String.fromCharCode(...zlibSync(IndividualSimSettings.toBinary(s))))
  );
}
it("preserves explicit binary defaults and respects exported categories", () => {
  const spec = listSpecs().find((s) => s.name === "Fury")!,
    s = defaultSettings(spec.id);
  s.player!.equipment = { items: [{ id: 44006, enchant: 0, gems: [] }] };
  s.player!.inFrontOfTarget = false;
  s.player!.profession1 = 0;
  s.encounter!.duration = 120;
  const { snapshot } = resolveSnapshot(
    parseExport(link(s, "gm"), "profile"),
    spec.id,
  );
  expect(snapshot.settings.player!.inFrontOfTarget).toBe(false);
  expect(snapshot.settings.player!.profession1).toBe(0);
  expect(snapshot.settings.encounter!.duration).toBe(180);
  expect(snapshot.settings.player!.talentsString).toBe(
    spec.talents.talentsString,
  );
});

it("preserves disabled raid buffs in a full binary profile", () => {
  const spec = listSpecs().find((s) => s.name === "Fury")!,
    s = defaultSettings(spec.id);
  s.player!.equipment = { items: [{ id: 44006, enchant: 0, gems: [] }] };
  s.raidBuffs!.arcaneBrilliance = false;
  const { snapshot } = resolveSnapshot(
    parseExport(link(s, "gtrcmxe"), "profile"),
    spec.id,
  );
  expect(snapshot.settings.raidBuffs!.arcaneBrilliance).toBe(false);
});
