import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);
const player = fixture.raid.parties[0].players[0];
const character = JSON.stringify({
  name: "Aldren",
  class: "warrior",
  race: "human",
  level: 80,
  talents: player.talentsString,
  gear: player.equipment,
  professions: [
    { name: "Engineering", level: 408 },
    { name: "Jewelcrafting", level: 440 },
  ],
});

test("corrects a malformed bag export without losing character data and imports the reviewed gear", async ({
  page,
}) => {
  await page.goto("/top-gear");
  await page.getByLabel("Character export", { exact: true }).fill(character);
  await page.getByLabel("Bag export", { exact: true }).fill("{broken");
  await page.getByRole("button", { name: "Review import" }).click();
  await expect(page.getByLabel("Bag export", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toHaveValue(character);
  const bags = {
    items: [
      { id: 40528, enchant: 3817, gems: [41285, 39996] },
      { id: 9999999 },
    ],
  };
  await page
    .getByLabel("Bag export", { exact: true })
    .fill(JSON.stringify(bags));
  await page.getByRole("button", { name: "Review import" }).click();
  await page.getByLabel("DPS preset").selectOption({ label: "Warrior · Fury" });
  await expect(page.getByRole("heading", { name: "Aldren" })).toBeVisible();
  await expect(page.getByText("408 / 450")).toBeVisible();
  await expect(page.getByText("440 / 450")).toBeVisible();
  await expect(page.getByLabel("Bag compatibility")).toContainText(
    "1 supported · 1 unsupported",
  );
  await expect(
    page
      .locator(".import-setting-sources > div")
      .filter({ hasText: "Talents" }),
  ).toContainText("Imported");
  await expect(
    page
      .locator(".import-setting-sources > div")
      .filter({ hasText: "Consumables" }),
  ).toContainText("Preset default");
  await page.getByRole("button", { name: "Back to import" }).click();
  await expect(
    page.getByLabel("Character export", { exact: true }),
  ).toHaveValue(character);
  await expect(page.getByLabel("Bag export", { exact: true })).toHaveValue(
    JSON.stringify(bags),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await page.getByLabel("DPS preset").selectOption({ label: "Warrior · Fury" });
  await page.getByRole("button", { name: "Select gear" }).click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wow-droptimizer.top-gear.v1")!),
  );
  expect(
    stored.snapshot.inventory
      .filter((item: { source: string }) => item.source === "equipped")
      .map((item: { itemId: number; enchantId: number; gemIds: number[] }) => ({
        id: item.itemId,
        enchant: item.enchantId,
        gems: item.gemIds,
      })),
  ).toEqual(
    player.equipment.items.map(
      (item: { id: number; enchant?: number; gems?: number[] }) => ({
        id: item.id,
        enchant: item.enchant ?? 0,
        gems: item.gems ?? [],
      }),
    ),
  );
  expect(
    stored.snapshot.inventory.filter(
      (item: { source: string }) => item.source === "bag",
    ),
  ).toHaveLength(2);
  expect(stored.snapshot.professionLevels).toEqual({ "4": 408, "7": 440 });
  expect(stored.snapshot.settings.player.talentsString).toBe(
    player.talentsString,
  );
  expect(stored.snapshot.itemVersion).toBe("original");
  expect(stored.snapshot.provenance["player.talentsString"]).toBe("imported");
  expect(stored.selection.selectedInstanceIds).toEqual(
    stored.snapshot.inventory
      .filter((item: { source: string }) => item.source === "equipped")
      .map((item: { instanceId: string }) => item.instanceId),
  );
});

test("addon help exposes a copyable command and reports clipboard failure", async ({
  page,
}) => {
  await page.goto("/top-gear");
  await page.getByText("How to get your exports", { exact: true }).click();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await page.getByRole("button", { name: "Copy /wse" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Copy /wse manually" }),
  ).toBeVisible();
});
