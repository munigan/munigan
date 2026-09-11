import { test, expect } from "@playwright/test";
test("localized homepage renders Portuguese without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/pt-br");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.locator("h1")).toContainText("Seu próximo upgrade");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://munigan.app/pt-br",
  );
  await context.close();
});

test("root negotiates language and explicit homepages override preferences", async ({
  request,
  browser,
}) => {
  for (const [headers, expected] of [
    [{ "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" }, "/pt-br"],
    [{ "accept-language": "pt-BR", cookie: "munigan.locale=en-US" }, "/en-us"],
    [{ "accept-language": "fr-FR" }, "/en-us"],
  ] as const) {
    const response = await request.get("/", { headers, maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(expected);
  }
  const context = await browser.newContext({ locale: "pt-BR" });
  await context.addCookies([
    { name: "munigan.locale", value: "pt-BR", url: "http://127.0.0.1:3000" },
  ]);
  const page = await context.newPage();
  await page.goto("/en-us");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("h1")).toContainText("Your next upgrade");
  await context.close();
});

test("both homepages publish language alternatives and locale-specific social images", async ({
  page,
  request,
}) => {
  for (const [slug, locale, image] of [
    ["en-us", "en-US", "munigan-workbench.png"],
    ["pt-br", "pt-BR", "munigan-workbench-pt-br.png"],
  ]) {
    await page.goto("/" + slug);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    for (const language of ["en-US", "pt-BR", "x-default"])
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${language}"]`),
      ).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      `https://munigan.app/images/${image}`,
    );
    const asset = await request.get("/images/" + image);
    expect(asset.ok()).toBe(true);
    expect(asset.headers()["content-type"]).toContain("image/png");
  }
  const report = await request.get("/reports/i18n-missing", {
    headers: { "accept-language": "pt-BR" },
  });
  expect(report.headers()["x-robots-tag"]).toContain("noindex");
  expect(report.headers()["referrer-policy"]).toBe("no-referrer");
  expect((await request.get("/fr")).status()).toBe(404);
});

import { selectOption } from "./select-option";
import { readFileSync } from "node:fs";
import { reportFixture } from "../support/report-fixture";
const player = JSON.parse(
  readFileSync("tests/fixtures/sim/warrior.request.json", "utf8"),
).raid.parties[0].players[0];
const draftKey = "wow-droptimizer.top-gear.v1";

test("changing language keeps unsaved imports and translates an existing error", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  const raw = '{"invalid":';
  const bags = '{"items":[{"id":41584}]}';
  await page.getByLabel("Character export", { exact: true }).fill(raw);
  await page.getByLabel("Bag export", { exact: true }).fill(bags);
  await page.getByRole("button", { name: "Review import" }).click();
  await selectOption(page.getByLabel("Language", { exact: true }), "pt-BR");
  await expect(page).toHaveURL(/\/gear-lab$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.locator("#character")).toHaveValue(raw);
  await expect(page.locator("#bags")).toHaveValue(bags);
  await expect(page.locator("#character-error")).toContainText("JSON");
  expect(await page.locator("#character-error").textContent()).not.toContain(
    "Enter valid",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});

test("switching a restored selection preserves exact request and scroll", async ({
  page,
}) => {
  await page.goto("/gear-lab");
  await page.getByLabel("Character export", { exact: true }).fill(
    JSON.stringify({
      name: "Locale check",
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
    label: "Fury (19/52/0)",
  });
  await page.getByRole("button", { name: "Select gear", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(page.locator(".slot-group").first()).toBeVisible();
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    draftKey,
  );
  await page.evaluate(() => window.scrollTo(0, 300));
  const scroll = await page.evaluate(() => window.scrollY);
  let jobs = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/jobs")) jobs++;
  });
  await selectOption(page.getByLabel("Language", { exact: true }), "pt-BR");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBe(before);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  expect(jobs).toBe(0);
});

test("a report keeps its current page, selected set and scroll when language changes", async ({
  page,
}) => {
  const fixture = reportFixture();
  const rows = Array.from({ length: 40 }, (_, index) => ({
    ...fixture.report.rows[0],
    id: `set-${index}`,
    dps: 10050 - index,
  }));
  let reads = 0;
  let mutations = 0;
  await page.route("**/api/reports/i18n-state?*", (route) => {
    reads++;
    const cursor = Number(
      new URL(route.request().url()).searchParams.get("cursor") || 0,
    );
    return route.fulfill({
      json: {
        ...fixture,
        totalRows: 40,
        nextCursor: cursor === 0 ? 20 : null,
        report: { ...fixture.report, rows: rows.slice(cursor, cursor + 20) },
      },
    });
  });
  page.on("request", (request) => {
    if (request.method() === "POST") mutations++;
  });
  await page.goto("/reports/i18n-state");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: /View set 21,/ }).click();
  await page.evaluate(() => window.scrollTo(0, 500));
  const scroll = await page.evaluate(() => scrollY);
  const dps = await page.locator(".dps-heading > strong").textContent();
  const selected = await page
    .locator(".combination-row.selected")
    .elementHandle();
  const before = reads;
  await selectOption(page.getByLabel("Language", { exact: true }), "pt-BR");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(
    page.getByRole("navigation", { name: /Pagination|Paginação/ }),
  ).toContainText("21–40 de 40");
  expect(await selected?.evaluate((el) => el.isConnected)).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  expect(reads).toBe(before);
  expect(mutations).toBe(0);
  await expect(page.locator(".dps-heading > strong")).toHaveText(
    dps!.replaceAll(",", "."),
  );
  await expect(page).toHaveURL(/\/reports\/i18n-state$/);
});

for (const width of [390, 1440])
  test(`Portuguese navigation and import fit at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      locale: "pt-BR",
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/pt-br");
    await expect(page.locator("h1")).toContainText("Seu próximo upgrade");
    await page.getByRole("link", { name: "Abrir Gear Lab" }).click();
    await page.waitForURL("**/gear-lab");
    await page.locator("#character").waitFor();
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    if (width < 1024)
      await page.getByRole("button", { name: "Abrir navegação" }).click();
    const navigation = page.getByRole("navigation", { name: "Ferramentas" });
    await expect(navigation).toBeVisible();
    expect(
      await navigation.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await context.close();
  });
