import { test, expect } from "@playwright/test";
const origin = "https://munigan.app";

test("homepage is useful without JavaScript and publishes public sharing metadata", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    locale: "en-US",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your next upgradestarts here.",
  );
  await expect(
    page.getByRole("link", { name: /Open Gear Lab/ }),
  ).toHaveAttribute("href", "/gear-lab");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${origin}/en-us`,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    `${origin}/images/munigan-workbench.png`,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  const image = await request.get("/images/munigan-workbench.png");
  expect(image.ok()).toBeTruthy();
  expect(image.headers()["content-type"]).toContain("image/png");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain(`<loc>${origin}/en-us</loc>`);
  expect(await sitemap.text()).not.toContain("/reports/");
  await context.close();
});
test("report URLs opt out of indexing and referrers", async ({ request }) => {
  const report = await request.get("/reports/seo-verification");
  expect(report.headers()["x-robots-tag"]).toContain("noindex");
  expect(report.headers()["referrer-policy"]).toBe("no-referrer");
  expect(await report.text()).toMatch(
    /name="robots" content="noindex, nofollow"/,
  );
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).not.toContain("Disallow: /reports");
});
for (const width of [390, 768, 1024, 1099, 1100, 1399, 1400, 1440])
  test(`workbench navigation fits and stays consistent at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const openNav = async () => {
      if (width < 1400)
        await page.getByRole("button", { name: "Open navigation" }).click();
      return page.getByRole("navigation", { name: "Tools" });
    };
    let expectedLinks:
      { text: string | null; href: string | null }[] | undefined;
    for (const path of ["/", "/gear-lab", "/reports/header-verification"]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const nav = await openNav();
      await expect(nav).toBeVisible();
      const links = await nav.getByRole("link").evaluateAll((elements) =>
        elements.map((el) => ({
          text: el.textContent,
          href: el.getAttribute("href"),
        })),
      );
      if (expectedLinks) expect(links).toEqual(expectedLinks);
      else expectedLinks = links;
      await nav.getByRole("button", { name: /More tools/ }).click();
      if (width < 1400) {
        await expect(
          nav.locator('.drawer-future-row[aria-disabled="true"]'),
        ).toHaveCount(4);
        await nav.getByRole("button", { name: /More tools/ }).click();
      } else {
        const menu = page.getByRole("menu");
        await expect(menu.getByText("Future", { exact: true })).toHaveCount(4);
        await expect(menu.getByRole("menuitem")).toHaveCount(4);
        await page.keyboard.press("Escape");
      }
      await expect(
        nav.getByRole("link", {
          name: /Raid Upgrades|Gear Balance|Talent Lab|Log Review/,
        }),
      ).toHaveCount(0);
      const active = nav.locator('[aria-current="page"]');
      if (path === "/") await expect(active).toContainText("Home");
      else if (path === "/gear-lab" || width < 1400)
        await expect(active).toContainText("Gear Lab");
      else await expect(active).toHaveCount(0);
      const rows = await nav
        .locator(width < 1400 ? ".drawer-tool-card" : ".workbench-nav-row")
        .evaluateAll((elements) =>
          elements.map((el) => ({
            x: el.getBoundingClientRect().x,
            right: el.getBoundingClientRect().right,
            y: el.getBoundingClientRect().y,
            bottom: el.getBoundingClientRect().bottom,
            width: el.clientWidth,
            scroll: el.scrollWidth,
          })),
        );
      rows.forEach((row, i) => {
        expect(row.scroll).toBeLessThanOrEqual(row.width);
        expect(row.right).toBeLessThanOrEqual(width);
        if (i >= 2 && width < 1400)
          expect(row.y).toBeGreaterThanOrEqual(rows[i - 2].bottom);
      });
      if (width < 1400) {
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("dialog", { name: "Navigation" }),
        ).toBeHidden();
        await expect(
          page.getByRole("button", { name: "Open navigation" }),
        ).toBeFocused();
      }
    }
    await page.goto("/");
    const nav = await openNav();
    await nav.getByRole("link", { name: /^Gear Lab/ }).click();
    await expect(page).toHaveURL(/\/gear-lab$/);
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeHidden();
  });

for (const locale of ["en-us", "pt-br"])
  for (const width of [1399, 1400])
    test(`localized account header boundary ${locale} ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/" + locale);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await expect(page.locator(".workbench-menu-button")).toBeVisible({
        visible: width < 1400,
      });
      if (width === 1400)
        expect(
          (await page.locator(".auth-control").first().boundingBox())!.width,
        ).toBeGreaterThanOrEqual(44);
    });
