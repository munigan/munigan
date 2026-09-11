import { test, expect, type Page } from "@playwright/test";
import { reportFixture } from "../support/report-fixture";
import { readFileSync } from "node:fs";
import { selectOption } from "./select-option";

for (const version of ["original", "classic"] as const) {
  test(`${version} report icons share the horizontal center of their labels and item levels`, async ({
    page,
  }) => {
    const fixture = reportFixture();
    fixture.report.snapshot.itemVersion = version;
    // This item uses the local Original tooltip, exercising its extra wrapper.
    fixture.report.snapshot.inventory.find(
      (item) => item.equippedSlot === "trinket1",
    )!.itemId = 45931;
    await page.route("**/api/reports/alignment?*", (route) =>
      route.fulfill({ json: fixture }),
    );
    await page.goto("/reports/alignment");
    await expect(page.locator(".selected-set .gear-slot")).toHaveCount(17);
    if (version === "original")
      await expect(
        page.locator(".selected-set .item-tooltip-trigger").first(),
      ).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const offsets = await page.locator(".gear-slot").evaluateAll((slots) =>
        slots.flatMap((slot) => {
          const label = slot.querySelector(":scope > span:first-child");
          const icon = slot.querySelector(".item-icon");
          if (!label || !icon) return [];
          const center = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return rect.x + rect.width / 2;
          };
          return [label, slot.querySelector(":scope > small")]
            .filter((element): element is Element => !!element)
            .map((element) => ({
              label: label.textContent,
              offset: Math.abs(center(element) - center(icon)),
            }));
        }),
      );
      expect(offsets.length).toBeGreaterThan(34);
      expect(
        offsets.filter((item) => item.offset > 1),
        `${version}, ${width}px`,
      ).toEqual([]);
    }
  });
}

async function expectSnugIcons(page: Page) {
  const boxes = await page.locator("a[data-item-icon]").evaluateAll((links) =>
    links.flatMap((link) => {
      const image = link.querySelector(".item-icon");
      if (!image) return [];
      const a = link.getBoundingClientRect();
      const b = image.getBoundingClientRect();
      if (!a.width || !a.height) return [];
      return [
        {
          width: Math.abs(a.width - b.width),
          height: Math.abs(a.height - b.height),
        },
      ];
    }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  expect(boxes.filter((box) => box.width > 1 || box.height > 1)).toEqual([]);
}

test("item icons keep snug aligned hit areas on the homepage, import, equipment and editor", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("complementary", { name: "Example Gear Lab result" }),
  ).toBeVisible();
  await expectSnugIcons(page);
  const sim = JSON.parse(
    readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
  );
  const player = sim.raid.parties[0].players[0];
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Alignment check",
      class: "warrior",
      race: "human",
      level: 80,
      talents: player.talentsString,
      gear: player.equipment,
      professions: [{ name: "Engineering" }, { name: "Jewelcrafting" }],
    }),
  );
  await expect(page.locator(".import-equipped-icons .item-icon")).toHaveCount(
    17,
  );
  await expectSnugIcons(page);
  await page.getByRole("button", { name: "Review import" }).click();
  await expectSnugIcons(page);
  await selectOption(page.getByLabel("DPS preset"), {
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  await expect(page.locator(".slot-group")).toHaveCount(14);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSnugIcons(page);
  }
  await page
    .locator(".inventory-row .item-row-copy .item-tooltip-link")
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectSnugIcons(page);
});
