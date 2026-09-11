import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
);
test("visual settings survive category changes and export through Advanced without losing other fields", async ({
  page,
}) => {
  await page.goto("/top-gear");
  const p = fixture.raid.parties[0].players[0];
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Settings audit",
      class: "warrior",
      race: "human",
      level: 80,
      talents: p.talentsString,
      gear: p.equipment,
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Warrior · Fury",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Buffs & settings" });
  await trigger.click();
  await page.getByRole("tab", { name: "Buffs", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Bloodlust", exact: true })
    .uncheck();
  await page
    .getByRole("spinbutton", { name: "Demonic Pact spell power", exact: true })
    .fill("321");
  await page.getByRole("tab", { name: "Consumes", exact: true }).click();
  await selectOption(
    page.getByRole("combobox", { name: "Flask", exact: true }),
    "2",
  );
  await page.getByRole("tab", { name: "Advanced", exact: true }).click();
  const json = JSON.parse(await page.getByLabel("Advanced JSON").inputValue());
  expect(json.player.name).toBe("Settings audit");
  expect(json.raidBuffs.bloodlust ?? false).toBe(false);
  expect(json.raidBuffs.demonicPactSp).toBe(321);
  expect(json.player.consumes.flask).toBe("FlaskOfEndlessRage");
  await page.getByRole("tab", { name: "Encounter", exact: true }).click();
  await page
    .getByRole("button", { name: "Cleave · 3 targets", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Targets", exact: true }),
  ).toHaveAttribute("data-select-value", "3");
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("tab", { name: "Buffs", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Bloodlust", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Simulator default", exact: true })
    .click();
  await expect(page.locator(".settings-source")).toHaveText("Default");
  await page.getByRole("button", { name: "Clear buffs", exact: true }).click();
  await page
    .getByRole("alert")
    .getByRole("button", { name: "Clear buffs", exact: true })
    .click();
  await expect(page.locator(".settings-source")).toHaveText("Edited");
  await page
    .getByRole("tab", { name: "Talents & glyphs", exact: true })
    .click();
  await selectOption(
    page.getByRole("combobox", { name: "Major glyph 1", exact: true }),
    "0",
  );
  await expect(page.locator(".settings-source")).toHaveText("Edited");
  await page
    .getByRole("button", { name: "Simulator default", exact: true })
    .click();
  await expect(page.locator(".settings-source")).toHaveText("Default");
  await page.setViewportSize({ width: 320, height: 568 });
  await selectOption(
    page.getByRole("combobox", { name: "Settings categories", exact: true }),
    { label: "Consumes" },
  );
  await expect(
    page.getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await selectOption(
    page.getByRole("combobox", { name: "Settings categories", exact: true }),
    { label: "Buffs" },
  );
  await expect(
    page.getByRole("combobox", { name: "Buff categories", exact: true }),
  ).toBeVisible();
});
