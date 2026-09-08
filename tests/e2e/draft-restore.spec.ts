import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);

test("restores a lower-rank profession draft into the editor for review", async ({
  page,
}) => {
  const player = fixture.raid.parties[0].players[0];
  await page.goto("/top-gear");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Aldren",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      gear: player.equipment,
      professions: [
        { name: "Engineering", level: 425 },
        { name: "Jewelcrafting", level: 450 },
      ],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await page.getByLabel("DPS preset").selectOption({ label: "Warrior · Fury" });
  await page.getByRole("button", { name: "Select gear" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Restore draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "profession below 450" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Find Top Gear" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Buffs & settings" }).click();
  await page.getByRole("tab", { name: "Professions", exact: true }).click();
  await expect(page.getByText("Imported rank: 425 / 450")).toBeVisible();
  await expect(page.getByLabel("Profession 1", { exact: false })).toHaveValue(
    "4",
  );
});
