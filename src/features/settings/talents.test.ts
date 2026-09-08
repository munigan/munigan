import { it, expect } from "vitest";
import { listSpecs, defaultSettings } from "./registry";
import { validateTalents } from "./talents";
import type { Snapshot } from "@/domain/top-gear/model";
it("validates every pinned talent preset against the pinned tree", () => {
  for (const spec of listSpecs())
    expect(
      validateTalents({ settings: defaultSettings(spec.id) } as Snapshot),
      spec.id,
    ).toEqual([]);
});
it("rejects fabricated ranks and tier skips", () => {
  const settings = defaultSettings(listSpecs()[0].id);
  settings.player!.talentsString = "5555555555555555555555555555555555";
  expect(validateTalents({ settings } as Snapshot).length).toBeGreaterThan(0);
});
