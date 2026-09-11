import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";
const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];
const character = {
  name: "Armorytester",
  class: "Warrior",
  race: "Human",
  level: 80,
  gear: player.equipment,
  professions: [
    { name: "Engineering", level: 408 },
    { name: "Jewelcrafting", level: 400 },
  ],
};

test("Warmane imports by name and realm into review, preserving optional bags and preset provenance", async ({
  page,
}) => {
  let lookups = 0;
  await page.route("**/api/import/warmane?*", (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("name")).toBe("Armorytester");
    expect(url.searchParams.get("realm")).toBe("Lordaeron");
    lookups++;
    return route.fulfill({ json: { character } });
  });
  await page.goto("/top-gear");
  await page
    .getByRole("button", { name: "Warmane Armory", exact: true })
    .click();
  await page.getByLabel("Character name", { exact: true }).fill("armorytester");
  await selectOption(page.getByLabel("Realm", { exact: true }), "Lordaeron");
  const bag = { items: [{ id: 40528, enchant: 3817, gems: [41285, 40111] }] };
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify(bag));
  expect(lookups).toBe(0);
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Armorytester", exact: true }),
  ).toBeVisible();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await expect(page.getByText("408 / 450")).toBeVisible();
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^Your equipment/ }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
  expect(
    stored.snapshot.inventory.filter(
      (item: { source: string }) => item.source === "bag",
    ),
  ).toHaveLength(1);
  expect(stored.snapshot.professionLevels).toEqual({ "4": 408, "7": 400 });
  expect(stored.snapshot.provenance["player.talentsString"]).toBe("preset");
  expect(stored.snapshot.provenance["player.race"]).toBe("imported");
  expect(lookups).toBe(1);
});

test("a failed Armory lookup preserves input, translates the error and can be retried", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  let lookups = 0;
  await page.route("**/api/import/warmane?*", (route) => {
    lookups++;
    return route.fulfill({
      status: 404,
      json: {
        code: "warmaneNotFound",
        error: "Character not found. Check the name and realm.",
      },
    });
  });
  await page.goto("/top-gear");
  await page
    .getByRole("button", { name: "Warmane Armory", exact: true })
    .click();
  await page.getByLabel("Character name", { exact: true }).fill("Armorytester");
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await expect(
    page.getByText("Character not found. Check the name and realm."),
  ).toBeVisible();
  await expect(page.getByLabel("Character name", { exact: true })).toHaveValue(
    "Armorytester",
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await selectOption(
    page.locator(".workbench-drawer").getByLabel("Language", { exact: true }),
    "pt-BR",
  );
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(
    page.getByLabel("Nome do personagem", { exact: true }),
  ).toHaveValue("Armorytester");
  await expect(
    page.getByText("Personagem não encontrado. Confira o nome e o reino."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Revisar importação", exact: true })
    .click();
  await expect.poll(() => lookups).toBe(2);
});
