import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";

const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];

test("Free iterations stay expanded and capped with keyboard, pointer and responsive layouts", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("https://wow.zamimg.com/js/tooltips.js", (route) =>
    route.abort(),
  );
  await page.goto("/top-gear");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Aldren",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      gear: player.equipment,
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
    }),
  );
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Warrior · Fury",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();

  const sidebar = page.locator(".run-summary");
  const slider = page.getByRole("slider", { name: "Iterations per set" });
  await expect(slider).toBeVisible();
  await expect(slider).toBeEnabled();
  const draft = await page.evaluate(() =>
    localStorage.getItem("wow-droptimizer.top-gear.v1"),
  );
  await slider.focus();
  for (const key of ["ArrowRight", "ArrowUp", "PageUp", "End"]) {
    await slider.press(key);
    await expect(slider).toHaveValue("500");
    await expect(sidebar.getByRole("status")).toContainText(
      "Free is limited to 500",
    );
  }
  const bounds = (await slider.boundingBox())!;
  await page.mouse.move(bounds.x + 8, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width - 8,
    bounds.y + bounds.height / 2,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(slider).toHaveValue("500");
  await slider.click({
    position: { x: bounds.width - 8, y: bounds.height / 2 },
  });
  await expect(slider).toHaveValue("500");
  await expect(
    page.getByRole("button", { name: "Run Gear Lab" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("wow-droptimizer.top-gear.v1"),
    ),
  ).toBe(draft);

  for (const locale of ["en-US", "pt-BR"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (locale === "pt-BR") {
      await selectOption(page.getByLabel("Language", { exact: true }), "pt-BR");
      await expect(
        page.getByRole("slider", { name: "Iterações por conjunto" }),
      ).toBeVisible();
    }
    for (const width of [1440, 1000, 901, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await sidebar.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const labels = await page
        .locator(".run-iterations-labels span")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right };
          }),
        );
      for (let i = 1; i < labels.length; i++) {
        expect(labels[i].left).toBeGreaterThanOrEqual(labels[i - 1].right + 2);
      }
      if (width === 1440 || width === 390) {
        await sidebar.screenshot({
          path: testInfo.outputPath(`iterations-${locale}-${width}.png`),
        });
      }
    }
  }
});
