import { afterEach, expect, it, vi } from "vitest";
import { parseExport } from "@/features/import/parse-export";
import { parseWarmaneProfile, importWarmaneCharacter } from "./armory";

const lookup = { name: "Barbarius", realm: "Icecrown" };
// Warmane profile markup: every slot has a container, even when it is empty.
const column = (items: Array<string | null>) =>
  items
    .map(
      (rel) =>
        `<div class="item-slot">${rel ? `<a rel="${rel}"><img></a>` : '<a href="#self"></a>'}</div>`,
    )
    .join("");
const profile = `<div id="character-sheet"><div class="name">Barbarius <span class="guild-name">Guild</span></div><div class="level-race-class">Level 80 Orc Warrior, Icecrown</div></div>
<div id="character-profile"><div class="item-model">
<div class="item-left">${column(["item=51227&amp;ench=3817&amp;gems=3628:0:3525", null, null, null, null, "item=45672", "item=45581", "item=51364&amp;ench=3845"])}</div>
<div class="item-right">${column([null, null, null, null, "item=50618", "item=50618", null, null])}</div>
<div class="item-bottom">${column(["item=49623&amp;ench=3789", null, "item=51880"])}</div>
</div><div class="profskills"><div class="stub"><div class="text">Engineering<span class="value">408 / 450</span></div></div><div class="stub"><div class="text">Jewelcrafting<span class="value">400 / 450</span></div></div><div class="stub"><div class="text">Cooking<span class="value">450 / 450</span></div></div></div></div>`;

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["Draenei", "Jewelcrafting", "455 / 455"],
  ["Gnome", "Engineering", "465 / 465"],
])(
  "accepts %s racial profession ranks at the simulator's 450 ceiling",
  (race, profession, rank) => {
    const html = profile
      .replace("Orc Warrior", `${race} Warrior`)
      .replace(profession === "Engineering" ? "408 / 450" : "400 / 450", rank);
    const character = parseWarmaneProfile(html, lookup);
    expect(
      character.professions.find((p) => p.name === profession)?.level,
    ).toBe(450);
    expect(() =>
      parseExport(JSON.stringify(character), "character"),
    ).not.toThrow();
  },
);

it("imports enhancements and exact slots without shifting empty slots or socket gaps", () => {
  const character = parseWarmaneProfile(profile, lookup);
  const draft = parseExport(JSON.stringify(character), "character");
  expect(character.name).toBe("Barbarius");
  expect(character.professions).toEqual([
    { name: "Engineering", level: 408 },
    { name: "Jewelcrafting", level: 400 },
  ]);
  expect(character).not.toHaveProperty("talents");
  expect(character).not.toHaveProperty("glyphs");
  expect(draft.inventory.map((item) => item.equippedSlot)).toEqual([
    "head",
    "wrist",
    "finger1",
    "finger2",
    "mainHand",
    "ranged",
  ]);
  expect(draft.inventory[0]).toMatchObject({
    itemId: 51227,
    enchantId: 3817,
    gemIds: [41398, 0, 40117],
  });
  expect(new Set(draft.inventory.map((item) => item.instanceId)).size).toBe(6);
});

it("rejects unmapped gems instead of silently dropping them", () => {
  expect(() =>
    parseWarmaneProfile(
      profile.replace("3628:0:3525", "999999:0:3525"),
      lookup,
    ),
  ).toThrow(/gem/i);
});
it("rejects non-Wrath levels, unexpected layouts and missing characters", () => {
  expect(() =>
    parseWarmaneProfile(profile.replace("Level 80", "Level 70"), lookup),
  ).toThrow(/80/);
  expect(() =>
    parseWarmaneProfile(
      profile.replace('class="item-left"', 'class="changed-layout"'),
      lookup,
    ),
  ).toThrow();
  expect(() =>
    parseWarmaneProfile("<html>Character does not exist.</html>", lookup),
  ).toThrow(/not found/i);
});
it("validates lookup fields before making requests", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const input of [
    { ...lookup, name: "../admin" },
    { ...lookup, realm: "https://example.com" },
    { ...lookup, name: "" },
  ]) {
    await expect(importWarmaneCharacter(input)).rejects.toThrow();
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it("fetches exactly one profile from the fixed Armory host", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(profile));
  vi.stubGlobal("fetch", fetcher);
  const result = await importWarmaneCharacter({
    ...lookup,
    name: "  barbarius ",
  });
  expect(result.name).toBe("Barbarius");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://armory.warmane.com/character/Barbarius/Icecrown/profile",
  );
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error" });
});
it.each([404, 429, 503])(
  "returns a useful error for upstream status %s",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status })),
    );
    await expect(importWarmaneCharacter(lookup)).rejects.toMatchObject({
      status: status === 404 ? 404 : 503,
    });
  },
);
it("handles network failures and oversized responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("fetch failed")),
  );
  await expect(importWarmaneCharacter(lookup)).rejects.toMatchObject({
    code: "warmaneUnavailable",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("x".repeat(600_000))),
  );
  await expect(importWarmaneCharacter(lookup)).rejects.toMatchObject({
    code: "warmaneInvalidProfile",
  });
});
