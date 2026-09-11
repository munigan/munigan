import { test, expect } from "@playwright/test";
import { reportFixture } from "../support/report-fixture";

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
        page.locator(".selected-set .original-item-trigger").first(),
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
