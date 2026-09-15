import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";

test("compact setup preserves equipment rows and updates real settings", async ({
  page,
}, testInfo) => {
  const fixture = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `import {fixtureRequest} from './tests/support/fixtures.ts'; import {encodeRequest} from './src/domain/top-gear/request-schema.ts'; process.stdout.write(JSON.stringify(encodeRequest(fixtureRequest())));`,
    ],
    { encoding: "utf8" },
  );
  expect(fixture.status).toBe(0);
  await page.addInitScript(
    (value) => localStorage.setItem("wow-droptimizer.top-gear.v1", value),
    fixture.stdout,
  );
  await page.goto("/gear-lab");
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  const header = page.locator(".gear-lab-header");
  await expect(header.getByRole("heading", { level: 1 })).toHaveText("Parity");
  await expect(page.locator(".run-summary .run-configuration")).toHaveCount(0);
  await expect(
    page.locator(".inventory-with-wallet > .resource-wallet"),
  ).toBeVisible();
  const rows = await page.locator(".inventory-row").count();
  expect(rows).toBeGreaterThan(0);
  const classic = header.getByRole("button", {
    name: "Wrath Classic",
    exact: true,
  });
  await classic.click();
  await expect(classic).toHaveAttribute("aria-pressed", "true");
  await header
    .getByRole("button", { name: "Original 3.3.5a", exact: true })
    .click();
  await expect(page.locator(".inventory-row")).toHaveCount(rows);
  await header
    .getByRole("button", { name: "Which version should I choose?" })
    .click();
  await expect(page.getByRole("tooltip")).toContainText("Ulduar");
  await page.keyboard.press("Escape");
  await header
    .getByRole("button", { name: "Buffs & settings", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await header
    .getByRole("button", { name: "Gems, enchants & sockets", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  for (const width of [1440, 1280, 1000, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const image of await header.locator(".gear-setup-images img").all()) {
      const box = await image.boundingBox();
      expect(box!.width).toBe(box!.height);
    }
    await page.screenshot({
      path: testInfo.outputPath(`compact-${width}.png`),
    });
  }
});
