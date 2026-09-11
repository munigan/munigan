import { test, expect, type Page } from "@playwright/test";
const account = { id: "account-a", name: "Discord Library Owner", image: null };
const item = {
  id: "library-one",
  tool: "top-gear",
  kind: "report",
  title: "Fire mage raid comparison",
  summary: {
    characterName: "Aelyria",
    classKey: "mage",
    specKey: "mage:FireTalents",
    level: 80,
    dps: 12756.2,
    gainDps: 526.8,
  },
  savedAt: "2026-09-10T15:00:00Z",
  createdAt: "2026-09-10T14:00:00Z",
};
async function library(page: Page) {
  await page.route("**/api/account/session", (route) =>
    route.fulfill({
      json: { account, savingEnabled: true, enrollmentEnabled: true },
    }),
  );
  await page.route("**/api/library", (route) =>
    route.fulfill({
      json: { items: [item], nextCursor: null, tools: ["top-gear"] },
    }),
  );
}
test("private desktop library uses real character/spec assets and private page headers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await library(page);
  const response = await page.goto("/library");
  await expect(
    page.getByRole("button", { name: "Open Aelyria" }),
  ).toBeVisible();
  expect(response!.headers()["x-robots-tag"]).toContain("noindex");
  if (process.env.AUTH_CONTROLS_PRODUCTION === "1")
    expect(response!.headers()["cache-control"]).toContain("no-store");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex, nofollow/,
  );
  await expect(page.locator(".character-spec-image")).toHaveAttribute(
    "src",
    /spell_fire_firebolt02/,
  );
  await expect(page.locator(".library-view").getByRole("combobox")).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".superpowers/sdd/2026-09-10-discord-authentication/task-11-library-desktop.png",
    fullPage: true,
  });
});
test("Portuguese mobile library and report confirmation fit and restore focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await library(page);
  await page
    .context()
    .addCookies([
      { name: "munigan.locale", value: "pt-BR", url: "http://127.0.0.1:3100" },
    ]);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Minha Biblioteca" }),
  ).toBeVisible();
  const trigger = page.getByRole("button", { name: "Excluir Aelyria" });
  expect(
    (await page
      .getByRole("heading", { name: "Minha Biblioteca" })
      .boundingBox())!.x,
  ).toBe(20);
  expect((await trigger.locator("svg").boundingBox())!.width).toBe(18);
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("link compartilhado deixará de funcionar");
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(358);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".superpowers/sdd/2026-09-10-discord-authentication/task-11-delete-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.screenshot({
    path: ".superpowers/sdd/2026-09-10-discord-authentication/task-11-library-mobile.png",
    fullPage: true,
  });
});
test("Discord return requires a second account deletion confirmation and clears local drafts only on success", async ({
  page,
}) => {
  await library(page);
  let deletions = 0;
  await page.route("**/api/account/delete", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      expectedUserId: "account-a",
    });
    deletions++;
    return deletions === 1
      ? route.fulfill({ status: 409, json: { code: "FRESH_LOGIN_REQUIRED" } })
      : route.fulfill({ status: 202, json: { status: "deleting" } });
  });
  await page.route("**/api/auth/sign-in/social", (route) => {
    const body = route.request().postDataJSON();
    expect(body.provider).toBe("discord");
    expect(body.errorCallbackURL).toBe(body.callbackURL);
    return route.fulfill({
      json: {
        url: new URL(body.callbackURL, "http://127.0.0.1:3100").href,
        redirect: true,
      },
    });
  });
  await page.goto("/library");
  await page.evaluate(() => {
    localStorage.setItem("wow-droptimizer.top-gear.v1", "local draft");
    localStorage.setItem("unrelated", "keep");
  });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Delete account" }).click();
  await expect(page.getByRole("dialog")).toContainText("Discord Library Owner");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Verify with Discord" }).click();
  await expect(page.getByRole("dialog")).toContainText("Confirm again");
  expect(deletions).toBe(1);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("wow-droptimizer.top-gear.v1"),
    ),
  ).toBe("local draft");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("status")).toContainText("cleanup is processing");
  await expect(page.getByRole("button", { name: "Open Aelyria" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("wow-droptimizer.top-gear.v1"),
    ),
  ).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("unrelated"))).toBe(
    "keep",
  );
});
test("mobile account deletion opens from navigation and fits the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await library(page);
  await page.goto("/library");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Discord Library Owner");
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(358);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".superpowers/sdd/2026-09-10-discord-authentication/task-11-account-delete-mobile.png",
    fullPage: true,
  });
});

test("deleting a report invalidates another open library tab", async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  let deleted = false;
  for (const tab of [page, second]) {
    await library(tab);
    await tab.route("**/api/library", (route) =>
      route.fulfill({
        json: {
          items: deleted ? [] : [item],
          nextCursor: null,
          tools: ["top-gear"],
        },
      }),
    );
    await tab.goto("/library");
    await expect(
      tab.getByRole("button", { name: "Open Aelyria" }),
    ).toBeVisible();
  }
  await page.route("**/api/library/library-one", (route) => {
    deleted = true;
    return route.fulfill({ status: 204 });
  });
  await page.getByRole("button", { name: "Delete Aelyria" }).click();
  await page.getByRole("button", { name: "Delete report" }).click();
  await expect(
    second.getByText("Your next discovery belongs here."),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Open Aelyria" }),
  ).toHaveCount(0);
});
