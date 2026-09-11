import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";
async function setup(page: Page) {
  const fixture = JSON.parse(
    readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const p = fixture.raid.parties[0].players[0];
  p.equipment.items[12] = { id: 45931 };
  await page.goto("/top-gear");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Paper review",
      class: "warrior",
      race: "human",
      level: 80,
      talents: p.talentsString,
      gear: p.equipment,
      professions: [
        { name: "Engineering", level: 450 },
        { name: "Jewelcrafting", level: 450 },
      ],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
}
test("item title hit areas exclude trailing whitespace for both tooltip providers", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByRole("checkbox", { name: "Selected only", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".slot-group")).toHaveCount(14);
  for (const id of [44006, 45931]) {
    const link = page.locator(`.item-row-copy a[href$="item=${id}"]`).first();
    await link.scrollIntoViewIfNeeded();
    const space = await link.evaluate((el) => {
      const text = el.querySelector(".item-name")!.getBoundingClientRect();
      const row = el.closest(".item-row-copy")!.getBoundingClientRect();
      return {
        x: row.right - 8,
        y: text.y + text.height / 2,
        right: text.right,
      };
    });
    expect(space.x).toBeGreaterThan(space.right + 20);
    await page.mouse.move(space.x, space.y);
    expect(
      await page.evaluate(
        ({ x, y }) =>
          Boolean(
            document
              .elementFromPoint(x, y)
              ?.closest("a[data-item-version], .original-item-trigger"),
          ),
        space,
      ),
    ).toBe(false);
    await expect(
      page.locator(".original-item-tooltip:popover-open"),
    ).toHaveCount(0);
  }
});
test("settings draft applies atomically, supports compact controls and cancels safely", async ({
  page,
}) => {
  await setup(page);
  const trigger = page.getByRole("button", {
    name: "Buffs & settings",
    exact: true,
  });
  await trigger.click();
  const duration = page.getByRole("spinbutton", {
    name: "Fight length (seconds)",
    exact: true,
  });
  const initial = await duration.inputValue();
  await duration.fill("222");
  await page.getByRole("tab", { name: "Buffs", exact: true }).click();
  await page
    .getByRole("tab", { name: "Personal & party", exact: true })
    .click();
  const infusion = page.getByRole("spinbutton", {
    name: "Power Infusion",
    exact: true,
  });
  await infusion.fill("0");
  await expect(
    page.getByRole("button", { name: "Decrease Power Infusion", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Increase Power Infusion", exact: true })
    .click();
  await expect(infusion).toHaveValue("1");
  await page.getByRole("tab", { name: "Encounter", exact: true }).click();
  await expect(duration).toHaveValue("222");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await trigger.click();
  await expect(duration).toHaveValue(initial);
  await duration.fill("222");
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await trigger.click();
  await expect(duration).toHaveValue("222");
  await page.setViewportSize({ width: 390, height: 844 });
  await selectOption(
    page.getByRole("combobox", { name: "Settings categories", exact: true }),
    { label: "Talents & glyphs" },
  );
  await expect(
    page.getByRole("combobox", { name: "Major glyph 1", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".simulation-dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeInViewport();
});

test("all settings sections render, validate JSON, and fit desktop and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page
    .getByRole("button", { name: "Buffs & settings", exact: true })
    .click();
  const labels = [
    "Encounter",
    "Talents & glyphs",
    "Rotation",
    "Buffs",
    "Consumes",
    "Professions",
    "Advanced",
  ];
  for (const [index, label] of labels.entries()) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.locator(".settings-content-heading h3")).toContainText(
      label,
    );
    expect(
      await page
        .locator(".simulation-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: `/tmp/munigan-settings-${index}.png` });
  }
  const json = page.getByLabel("Advanced JSON", { exact: true });
  const original = await json.inputValue();
  await json.fill("{invalid");
  await page
    .getByRole("button", { name: "Validate configuration", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Encounter", exact: true }).click();
  await expect(json).toBeVisible();
  const outOfRange = JSON.parse(original);
  outOfRange.encounter.duration = 700;
  await json.fill(JSON.stringify(outOfRange));
  await page
    .getByRole("button", { name: "Validate configuration", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("10–600");
  await json.fill(original);
  await page
    .getByRole("button", { name: "Validate configuration", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Configuration validated");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [index, label] of labels.entries()) {
    await selectOption(
      page.getByRole("combobox", { name: "Settings categories", exact: true }),
      { label },
    );
    expect(
      await page
        .locator(".simulation-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Apply changes", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: `/tmp/munigan-settings-mobile-${index}.png`,
    });
  }
});

test("Portuguese settings navigation retains values across all sections", async ({
  page,
}) => {
  await setup(page);
  await selectOption(
    page.getByRole("combobox", { name: "Language", exact: true }),
    "pt-BR",
  );
  await page
    .getByRole("button", { name: "Buffs e configurações", exact: true })
    .click();
  const tabs = [
    "Combate",
    "Talentos e glifos",
    "Rotação",
    "Buffs",
    "Consumíveis",
    "Profissões",
    "Avançado",
  ];
  for (const label of tabs) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.locator(".settings-content-heading h3")).toContainText(
      label,
    );
  }
  await page.getByRole("tab", { name: "Combate", exact: true }).click();
  await page.getByRole("spinbutton").first().fill("210");
  await page
    .getByRole("button", { name: "Aplicar alterações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buffs e configurações", exact: true })
    .click();
  await expect(page.getByRole("spinbutton").first()).toHaveValue("210");
  await page.setViewportSize({ width: 320, height: 650 });
  for (const label of tabs) {
    await selectOption(
      page.getByRole("combobox", {
        name: "Categorias de configurações",
        exact: true,
      }),
      { label },
    );
    await page.screenshot({ path: `/tmp/munigan-pt-${label}.png` });
    expect(
      await page
        .locator(".simulation-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Aplicar alterações", exact: true }),
    ).toBeInViewport();
  }
});
