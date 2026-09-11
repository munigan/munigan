import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function capture(page: Page, name: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mkdir(".cache/raid-trainer/scenarios", { recursive: true });
  await page.screenshot({ path: `.cache/raid-trainer/scenarios/${name}.png` });
}

test("Quick Bar starts a focused pull and returns to the selected mechanic", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/raid-trainer");
  await expect(
    page.getByRole("combobox", { name: "Mechanic", exact: true }),
  ).toHaveText("Defile");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(7, 8, 10)",
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  await capture(page, "setup");
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(page.locator(".rt-game")).toBeVisible();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("inert", "");
  await expect(page.getByLabel("Pull in 3", { exact: true })).toBeVisible();
  await page.locator("canvas").press("Space");
  await expect(page.getByRole("button", { name: /Resume pull/ })).toBeVisible();
  await page.getByRole("button", { name: "Exit focus" }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Mechanic", exact: true }),
  ).toHaveText("Defile");
  await expect(page.getByRole("button", { name: /Start game/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".rt-game")).toBeVisible();
  await page.locator("canvas").press("KeyR");
  await expect(
    page.locator(".rt-live-status").getByText(/Pull 02/),
  ).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`navigation and setup fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/raid-trainer");
    await expect(
      page.getByRole("button", { name: /Start game/ }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 1024)
      await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.locator(
      width < 1024 ? ".workbench-drawer" : ".workbench-header",
    );
    await expect(
      navigation.getByRole("link", { name: "Raid Trainer", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await navigation
      .getByRole("link", { name: "Top Gear", exact: true })
      .click();
    await expect(
      page.getByLabel("Character export", { exact: true }),
    ).toBeVisible();
  });
}

test("failed arena loading keeps the selection and lets the player retry", async ({
  page,
}) => {
  await page.route("**/raid-trainer/art/arena-sculpted-ice.png", (route) =>
    route.abort(),
  );
  await page.goto("/raid-trainer");
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(
    page
      .getByRole("region", { name: "Choose a practice mechanic" })
      .getByRole("alert"),
  ).toContainText("The arena could not load");
  await capture(page, "asset-error");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Mechanic", exact: true }),
  ).toHaveText("Defile");
  await page.unroute("**/raid-trainer/art/arena-sculpted-ice.png");
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(page.locator(".rt-game")).toBeVisible();
});

test("an unavailable audio context still starts visual practice", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "AudioContext", { value: undefined }),
  );
  await page.goto("/raid-trainer");
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(page.getByLabel("Pull in 3", { exact: true })).toBeVisible();
  await expect(page.locator(".rt-live-status").getByText(/live/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue without sound", exact: true }),
  ).toBeVisible();
  await capture(page, "audio-unavailable");
});

test("preparing can be cancelled without a late asset starting the encounter", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/raid-trainer/art/classes/warlock.jpg", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/raid-trainer");
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(
    page.getByRole("heading", { name: "Preparing the encounter…" }),
  ).toBeVisible();
  await capture(page, "preparing");
  await page
    .getByRole("button", { name: /Back to mechanic selection/ })
    .click();
  release();
  await expect(page.getByRole("button", { name: /Start game/ })).toBeEnabled();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(page.locator(".rt-game")).toBeVisible();
});
