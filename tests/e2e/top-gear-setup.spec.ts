import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);
test("imports owned bags, exposes exclusions and preserves a free anonymous gear selection", async ({
  page,
}) => {
  await page.goto("/top-gear");
  const player = fixture.raid.parties[0].players[0];
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Aldren",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
      gear: player.equipment,
    }),
  );
  await page.getByLabel("Bag export", { exact: true }).fill(
    JSON.stringify({
      items: [
        { id: 40528, enchant: 3817, gems: [41285, 39996] },
        { id: 9999999 },
      ],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await page.getByLabel("DPS preset").selectOption({ label: "Warrior · Fury" });
  await page.getByRole("button", { name: "Select gear" }).click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Find Top Gear" }),
  ).toBeDisabled();
  await page.getByLabel(/Exclude unsupported bag items/).check();
  await expect(
    page.getByRole("button", { name: "Find Top Gear" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Buffs & settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restore draft" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Your equipment" }),
  ).toBeVisible();
  await page.route("**/api/top-gear/jobs", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The simulation queue is full. Try again shortly.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Find Top Gear" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The simulation queue is full" }),
  ).toContainText("Try again shortly");
  await expect(page.getByLabel(/Exclude unsupported bag items/)).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Find Top Gear" }),
  ).toBeEnabled();
});
