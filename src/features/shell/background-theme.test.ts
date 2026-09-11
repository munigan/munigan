import { describe, expect, it } from "vitest";
import { listSpecs } from "@/features/settings/registry";
import { characterBackground } from "./background-theme";

describe("character background", () => {
  it("covers every supported specialization preset", () => {
    for (const spec of listSpecs())
      expect(characterBackground(spec.id), spec.id).not.toBe("naxxramas");
  });
  it("shares artwork across phase and rotation variants", () => {
    expect(characterBackground("deathknight:FrostUnholyTalents")).toBe(
      "deathknight-frost",
    );
    expect(characterBackground("deathknight:UnholyDualWieldSSTalents")).toBe(
      "deathknight-unholy",
    );
    expect(characterBackground("mage:Phase3FireTalents")).toBe("mage-fire");
    expect(characterBackground("mage:FrostfireTalents")).toBe("mage-frostfire");
  });
  it("uses the general background without a recognized character", () => {
    for (const value of [
      null,
      undefined,
      "",
      "unknown:ArmsTalents",
      "mage:NewSpec",
    ])
      expect(characterBackground(value)).toBe("naxxramas");
  });
});
