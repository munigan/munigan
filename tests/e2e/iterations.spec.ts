import { expect, test, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { selectOption } from "./select-option";

async function restore(page: Page, overLimit = false) {
  const fixture = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `
    import { fixtureRequest } from "./tests/support/fixtures.ts";
    import { encodeRequest } from "./src/domain/top-gear/request-schema.ts";
    const request = fixtureRequest();
    if (${JSON.stringify(overLimit)}) {
      const additions = request.snapshot.inventory.slice(0, 8).map((item, index) => ({
        ...item, instanceId: "iterations-bag-" + index, enchantId: 0, gemIds: [],
        source: "bag", equippedSlot: undefined,
      }));
      request.snapshot.inventory.push(...additions);
      request.selection.selectedInstanceIds.push(...additions.map(item => item.instanceId));
    }
    process.stdout.write(JSON.stringify(encodeRequest(request)));
  `,
    ],
    { encoding: "utf8" },
  );
  if (fixture.status !== 0) throw new Error(fixture.stderr);
  await page.addInitScript(
    (value) => localStorage.setItem("wow-droptimizer.top-gear.v1", value),
    fixture.stdout,
  );
  await page.route("**/api/tooltips/*/*", (route) => route.abort());
  await page.goto("/gear-lab");
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
}

test("precision select describes all values and preserves the free request", async ({
  page,
}) => {
  await restore(page);
  const select = page.getByRole("combobox", { name: "Iterations per set" });
  await expect(select).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const draft = await page.evaluate(() =>
    localStorage.getItem("wow-droptimizer.top-gear.v1"),
  );
  await select.click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(6);
  for (const value of [500, 1000, 1500, 2000, 2500, 3000]) {
    const item = page.locator(`[role="option"][data-select-value="${value}"]`);
    await expect(item).toHaveAccessibleDescription(/.+/);
  }
  await select.press("Escape");
  await select.focus();
  await select.press("ArrowDown");
  await expect(options).toHaveCount(6);
  await page.keyboard.press("End");
  await expect(page.getByRole("option").last()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(select).toHaveAttribute("data-select-value", "500");
  await expect(page.locator(".run-summary").getByRole("status")).toContainText(
    "Free is limited to 500",
  );
  await selectOption(select, "1000");
  await expect(select).toHaveAttribute("data-select-value", "500");
  await expect(
    page.getByRole("button", { name: "Run Gear Lab", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("wow-droptimizer.top-gear.v1"),
    ),
  ).toBe(draft);
});

for (const locale of ["en-US", "pt-BR"]) {
  test(`sidebar final box remains reachable at short and narrow viewports in ${locale}`, async ({
    page,
  }, testInfo) => {
    await restore(page, true);
    if (locale === "pt-BR")
      await selectOption(page.getByLabel("Language", { exact: true }), "pt-BR");
    await expect(page.locator(".run-action-panel")).toContainText(
      locale === "pt-BR" ? "Adicionar créditos" : "Add credits",
    );
    for (const width of [1440, 1000, 901, 390, 320]) {
      await page.setViewportSize({ width, height: 650 });
      await page.evaluate(() => window.scrollTo(0, 500));
      const sidebar = page.locator(".run-summary");
      if (width > 900) {
        await sidebar.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        const box = await sidebar.boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(76);
        expect(box!.y + box!.height).toBeLessThanOrEqual(626);
      } else {
        await page
          .locator(".run-action-panel")
          .evaluate((node) =>
            window.scrollBy(
              0,
              node.getBoundingClientRect().bottom - innerHeight + 24,
            ),
          );
      }
      const finalBox = await page.locator(".run-action-panel").boundingBox();
      expect(finalBox!.y + finalBox!.height).toBeLessThanOrEqual(650);
      const lastText = page.locator(".run-action-panel > p").last();
      await expect(lastText).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 1440 || width === 320)
        await page.screenshot({
          path: testInfo.outputPath(`sidebar-${locale}-${width}.png`),
        });
      const precision = page.locator(".run-iterations").getByRole("combobox");
      await precision.click();
      const popup = page.getByRole("listbox");
      await expect(popup).toBeVisible();
      const popupBox = await popup.boundingBox();
      expect(popupBox!.x).toBeGreaterThanOrEqual(0);
      expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(width);
      await expect(
        page.getByRole("option").first(),
      ).toHaveAccessibleDescription(/.+/);
      if (width === 1440 || width === 320)
        await page.screenshot({
          path: testInfo.outputPath(`precision-${locale}-${width}.png`),
        });
      await page.keyboard.press("Escape");
    }
  });
}
