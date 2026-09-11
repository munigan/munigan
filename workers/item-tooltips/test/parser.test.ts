import { describe, expect, it } from "vitest";
import { parseWowhead, parseCavernOfTime } from "../src/parser";
import whWeapon from "./fixtures/tooltip-wowhead-50730.json";
import whTrinket from "./fixtures/tooltip-wowhead-50362.json";
import whGem from "./fixtures/tooltip-wowhead-40111.json";
import whTier from "./fixtures/tooltip-wowhead-51225.json";
import cotWeapon from "./fixtures/tooltip-cot-50730.html?raw";
import cotTrinket from "./fixtures/tooltip-cot-50362.html?raw";
import cotGem from "./fixtures/tooltip-cot-40111.html?raw";
import cotTier from "./fixtures/tooltip-cot-51225.html?raw";

describe.each([
  {
    provider: "Wowhead",
    weapon: () => parseWowhead(whWeapon, 50730),
    trinket: () => parseWowhead(whTrinket, 50362),
    gem: () => parseWowhead(whGem, 40111),
    tier: () => parseWowhead(whTier, 51225),
  },
  {
    provider: "Cavern of Time",
    weapon: () => parseCavernOfTime(cotWeapon, 50730),
    trinket: () => parseCavernOfTime(cotTrinket, 50362),
    gem: () => parseCavernOfTime(cotGem, 40111),
    tier: () => parseCavernOfTime(cotTier, 51225),
  },
])("$provider", ({ weapon, trinket, gem, tier }) => {
  it("extracts weapon identity, stats, columns and positional sockets", () => {
    const item = weapon();
    expect(item.name).toBe("Glorenzelg, High-Blade of the Silver Hand");
    expect(item).toMatchObject({
      id: 50730,
      quality: 4,
      itemLevel: 284,
      heroic: true,
      icon: "inv_sword_153",
      sockets: ["red", "red", "red"],
      socketBonus: "+8 Strength",
    });
    expect(item.lines).toContainEqual({ kind: "stat", text: "+198 Strength" });
    expect(item.lines.find((l) => l.kind === "slot")).toMatchObject({
      rightText: "Sword",
    });
    expect(
      item.lines.find((l) => l.rightText?.startsWith("Speed"))?.text,
    ).toMatch(/991.*1487|991.*1,487/);
    expect(item.lines.filter((l) => l.kind === "effect")).toHaveLength(2);
    expect(
      item.lines.some(
        (l) =>
          l.text === item.name ||
          /Sell Price|Drop Chance|Phase 4|javascript:|<span/.test(l.text),
      ),
    ).toBe(false);
  });
  it("preserves the full proc description rather than only static stats", () => {
    expect(trinket().lines).toContainEqual({ kind: "slot", text: "Trinket" });
    expect(
      trinket()
        .lines.filter((l) => l.kind === "effect")
        .map((l) => l.text)
        .join(" "),
    ).toMatch(/races of Northrend.*30 sec/);
  });
  it("keeps gem effects and socket matching rules", () => {
    expect(
      gem()
        .lines.map((l) => l.text)
        .join(" "),
    ).toMatch(/20 Strength.*red socket/i);
  });
  it("retains tier set bonuses and requirements", () => {
    const lines = tier().lines;
    expect(lines.some((l) => l.kind === "set" && /\(2\)/.test(l.text))).toBe(
      true,
    );
    expect(lines.some((l) => l.kind === "set" && /\(4\)/.test(l.text))).toBe(
      true,
    );
    expect(
      lines.some((l) => l.kind === "requirement" && /80/.test(l.text)),
    ).toBe(true);
  });
});
it("rejects challenge, empty and mismatched item content", () => {
  expect(() => parseCavernOfTime("<h1>Just a moment...</h1>", 50730)).toThrow();
  expect(() => parseCavernOfTime(cotWeapon, 40111)).toThrow();
  expect(() =>
    parseWowhead({ ...whWeapon, tooltip: "<html>Access denied</html>" }, 50730),
  ).toThrow();
  expect(() => parseWowhead(whWeapon, 40111)).toThrow();
});
it("rejects truncated documents even when the title and a binding line survived", () => {
  expect(() =>
    parseWowhead(
      { ...whWeapon, tooltip: whWeapon.tooltip.split("<!--ue-->")[0] },
      50730,
    ),
  ).toThrow();
  expect(() =>
    parseCavernOfTime(
      cotWeapon.slice(
        0,
        cotWeapon.indexOf("Binds when picked up") +
          "Binds when picked up".length,
      ),
      50730,
    ),
  ).toThrow();
});
it("rejects a Wowhead prefix ending at the boundary before requirements/effects", () => {
  expect(() =>
    parseWowhead(
      {
        ...whWeapon,
        tooltip: whWeapon.tooltip.slice(
          0,
          whWeapon.tooltip.indexOf("<table><tr><td>Requires Level"),
        ),
      },
      50730,
    ),
  ).toThrow();
});
it("drops executable markup and hidden content without allowing untrusted icon URLs", () => {
  const result = parseWowhead(
    {
      ...whWeapon,
      tooltip: whWeapon.tooltip.replace(
        "+198 Strength",
        '+198 Strength<script>steal()</script><style>secret</style><img src=x onerror="evil()">',
      ),
    },
    50730,
  );
  expect(JSON.stringify(result)).not.toMatch(/steal|secret|onerror|<script/);
  expect(() =>
    parseWowhead({ ...whWeapon, icon: "https://evil.example/x" }, 50730),
  ).toThrow();
});
