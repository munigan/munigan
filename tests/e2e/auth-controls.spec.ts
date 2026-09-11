import { expect, test, type Page } from "@playwright/test";

type AccountSessionFixture = {
  account: { id: string; name: string; image: string | null } | null;
  savingEnabled: boolean;
  enrollmentEnabled: boolean;
};

const anonymous = {
  account: null,
  savingEnabled: true,
  enrollmentEnabled: false,
};
const authenticated = {
  account: {
    id: "account-1",
    name: "A very long Discord display name that must truncate",
    image: null,
  },
  savingEnabled: true,
  enrollmentEnabled: false,
};

async function mockAccountSession(
  page: Page,
  payload: AccountSessionFixture = authenticated,
) {
  await page.route("**/api/account/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    }),
  );
}

test("desktop avatar stays compact and the retry action remains readable", async ({
  page,
}) => {
  let releaseLoading!: () => void;
  const loading = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });
  let mode: "authenticated" | "unavailable" = "authenticated";
  await page.route("**/api/account/session", async (route) => {
    // Better Auth may invalidate the initial request; hold all loading responses.
    await loading;
    if (mode === "unavailable") return route.fulfill({ status: 503 });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticated),
    });
  });
  await page.goto("/en-us");
  await expect(page.locator(".auth-loading")).toBeVisible();
  const loadingWidth = (await page.locator(".auth-control").boundingBox())!
    .width;
  releaseLoading();
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  const authenticatedWidth = (await page
    .locator(".auth-control")
    .boundingBox())!.width;
  mode = "unavailable";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Retry account" }),
  ).toBeVisible();
  const unavailableWidth = (await page.locator(".auth-control").boundingBox())!
    .width;
  expect({ loadingWidth, authenticatedWidth }).toEqual({
    loadingWidth: 44,
    authenticatedWidth: 44,
  });
  expect(unavailableWidth).toBeGreaterThanOrEqual(44);
  expect(unavailableWidth).toBeLessThanOrEqual(184);
});

test("390px mobile navigation exposes account actions without overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await mockAccountSession(page);
  await page.goto("/pt-br");
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await expect(
    page.getByRole("link", { name: "Minha Biblioteca" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Excluir conta" }),
  ).toBeVisible();
  expect(
    (await page.locator(".workbench-drawer").boundingBox())!.width,
  ).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("390px anonymous sign-in dialog stays inside the viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await mockAccountSession(page, anonymous);
  await page.goto("/en-us");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(358);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
