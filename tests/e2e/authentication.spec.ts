import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { spawnSync } from "node:child_process";
async function seedOAuthReport(
  ownerKey: string,
): Promise<{ jobId: string; token: string }> {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "tests/support/oauth-report.ts"],
    { input: JSON.stringify({ ownerKey }), encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error("Isolated report seed failed");
  return JSON.parse(result.stdout);
}
import { startDiscordHarness } from "../support/discord-oauth";
let db: pg.Pool;
let events: string;
test.beforeAll(async () => {
  const runtime = JSON.parse(
    readFileSync(
      ".superpowers/sdd/2026-09-10-discord-authentication/oauth-runtime.json",
      "utf8",
    ),
  );
  expect(runtime.schema).toMatch(/^tg_oauth_e2e_[a-f0-9]{16}$/);
  db = new pg.Pool({ connectionString: runtime.databaseURL });
  events = runtime.events;
  expect((await db.query("SELECT current_schema() name")).rows[0].name).toBe(
    runtime.schema,
  );
});
test.beforeEach(async () => {
  await db.query(
    "TRUNCATE tg_jobs,tg_budgets,auth_user,auth_verification,auth_rate_limit CASCADE",
  );
  writeFileSync(events, "");
});
test.afterAll(async () => {
  await db.end();
});
async function signin(page: Page, profile = "account_a") {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startDiscordHarness(page, profile);
  await page.goto("/en-us");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Continue with Discord" }).click();
  await expect(
    page.getByRole("button", { name: "Allow", exact: true }),
  ).toBeVisible();
}
async function expectSigninComplete(page: Page) {
  // The shared header can show the session before AuthReturn finishes routing.
  // Wait for the original destination before navigating or opening its menu.
  await expect(page).toHaveURL(/\/en-us$/);
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
}
function calls() {
  return readFileSync(events, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line).kind);
}
test("real provider handler creates a phone-only account and encrypts tokens", async ({
  page,
}) => {
  await signin(page, "phone_only");
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expectSigninComplete(page);
  const user = (
    await db.query("SELECT name,email,email_verified FROM auth_user")
  ).rows[0];
  expect(user).toEqual({
    name: "phone-only",
    email: "100000000000000003@discord.placeholder.invalid",
    email_verified: false,
  });
  const account = (
    await db.query(
      "SELECT provider_id,account_id,access_token,refresh_token FROM auth_account",
    )
  ).rows[0];
  expect(account.provider_id).toBe("discord");
  expect(account.account_id).toBe("100000000000000003");
  expect(
    Boolean(account.access_token) && !account.access_token.includes("access:"),
  ).toBe(true);
  expect(
    Boolean(account.refresh_token) &&
      !account.refresh_token.includes("refresh:"),
  ).toBe(true);
  expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(1);
  expect((await db.query("SELECT id FROM auth_verification")).rowCount).toBe(0);
  expect(calls()).toEqual(["token", "userinfo"]);
});
test("mismatched state never calls the provider or creates a session", async ({
  page,
}) => {
  await signin(page);
  const url = new URL(page.url());
  url.searchParams.set("state", "invalid-state");
  await page.goto(url.href);
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/return$/);
  await expect(page.locator(".auth-return [role=alert]")).toBeVisible();
  expect(calls()).toEqual([]);
  expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(0);
});
test("denial permits a new attempt and callback replay creates no second session", async ({
  page,
}) => {
  await signin(page);
  await page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(page).toHaveURL(/auth\/return/);
  expect(calls()).toEqual([]);
  expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(0);
  await page.goto("/en-us");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Continue with Discord" }).click();
  let callback = "";
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/auth/callback/discord")
      callback = req.url();
  });
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expectSigninComplete(page);
  await page.goto(callback);
  await expect(page).toHaveURL(/\/auth\/return$/);
  await expect(page.locator(".auth-return [role=alert]")).toBeVisible();
  expect(calls()).toEqual(["token", "userinfo"]);
  expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(1);
});

for (const locale of ["en-us", "pt-br"])
  for (const width of [1440, 390]) {
    test(`Strict owner cookie and report restoration ${locale} ${width}`, async ({
      page,
      context,
    }) => {
      const pt = locale === "pt-br";
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await context.addCookies([
        {
          name: "munigan.locale",
          value: pt ? "pt-BR" : "en-US",
          url: "http://127.0.0.1:3100",
          sameSite: "Lax",
        },
      ]);
      await page.goto("/" + locale);
      await page.request.get("/api/top-gear/config");
      const owner = (await context.cookies()).find(
        (cookie) => cookie.name === "tg_owner",
      )!;
      expect(owner.sameSite).toBe("Strict");
      expect(owner.domain).toBe("127.0.0.1");
      expect(owner.httpOnly).toBe(true);
      expect(owner.path).toBe("/");
      const job = await seedOAuthReport(owner.value);
      await page.goto("/reports/" + job.token);
      const save = page.getByRole("button", {
        name: pt ? "Salvar relatório" : "Save report",
        exact: true,
      });
      await expect(save).toBeVisible();
      await page.getByRole("button", { name: pt ? "Próxima" : "Next" }).click();
      const selected = page
        .locator(".combination-table button[aria-pressed]")
        .nth(1);
      await selected.click();
      const selectionName = await selected.getAttribute("aria-label");
      const mode = page.locator('input[name="difference"]').nth(1);
      await mode.check();
      await save.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => scrollY);
      await save.click();
      await page.keyboard.press("Escape");
      await expect(save).toBeFocused();
      await save.click();
      await page.screenshot({
        path: `.superpowers/sdd/2026-09-10-discord-authentication/task-13-dialog-${locale}-${width}.png`,
      });
      await startDiscordHarness(page);
      let savedView:
        { cursor: number; selectedId: string; difference: string } | undefined;
      await page.route("**/api/auth/sign-in/social", async (route) => {
        savedView = await page.evaluate(() => {
          const key = Object.keys(sessionStorage).find((key) =>
            key.startsWith("munigan.auth.report."),
          )!;
          return JSON.parse(sessionStorage.getItem(key)!).value;
        });
        await route.continue();
      });
      let callbackStrict = false,
        callbackState = false,
        completeStrict = false,
        completeSession = false;
      await page.route("**/api/auth/callback/discord?*", async (route) => {
        const cookies = (await route.request().allHeaders()).cookie || "";
        callbackStrict = cookies.includes("tg_owner=");
        callbackState = cookies.includes("better-auth.state=");
        await route.continue();
      });
      await page.route(
        "**/api/library/save-intents/complete",
        async (route) => {
          const cookies = (await route.request().allHeaders()).cookie || "";
          completeStrict = cookies.includes("tg_owner=");
          completeSession = cookies.includes("better-auth.session_token=");
          await route.continue();
        },
      );
      await page
        .getByRole("button", {
          name: pt ? "Continuar com Discord" : "Continue with Discord",
        })
        .click();
      await page.getByRole("button", { name: "Allow", exact: true }).click();
      await expect(
        page.getByText(pt ? "Relatório salvo" : "Report saved", {
          exact: true,
        }),
      ).toBeVisible();
      expect(savedView).toMatchObject({
        cursor: 20,
        selectedId: "harness-row-21",
        difference: "highest",
      });
      expect(callbackStrict).toBe(false);
      expect(callbackState).toBe(true);
      expect(completeStrict).toBe(true);
      expect(completeSession).toBe(true);
      await expect(
        page.getByText(pt ? "Relatório salvo" : "Report saved", {
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: selectionName!, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(mode).toBeChecked();
      expect(
        Math.abs((await page.evaluate(() => scrollY)) - before),
      ).toBeLessThan(8);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await db.query("SELECT id FROM library_items WHERE job_id=$1", [
            job.jobId,
          ])
        ).rowCount,
      ).toBe(1);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `.superpowers/sdd/2026-09-10-discord-authentication/task-13-saved-${locale}-${width}.png`,
        fullPage: true,
      });
    });
  }
async function prepareSave(page: Page) {
  await page.goto("/en-us");
  await page.request.get("/api/top-gear/config");
  const owner = (await page.context().cookies()).find(
    (cookie) => cookie.name === "tg_owner",
  )!;
  const job = await seedOAuthReport(owner.value);
  await page.goto("/reports/" + job.token);
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  await startDiscordHarness(page);
  await page.getByRole("button", { name: "Continue with Discord" }).click();
  return job;
}
test("authentication survives save failure and retries the same intent exactly once", async ({
  page,
}) => {
  const job = await prepareSave(page);
  await db.query(
    "CREATE FUNCTION fail_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled save failure'; END $$",
  );
  await db.query(
    "CREATE TRIGGER fail_save BEFORE INSERT ON library_items FOR EACH ROW EXECUTE FUNCTION fail_save()",
  );
  try {
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(page.locator(".auth-return [role=alert]")).toContainText(
      "We couldn't check your session",
    );
    expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(1);
    expect((await db.query("SELECT id FROM library_items")).rowCount).toBe(0);
  } finally {
    await db.query("DROP TRIGGER fail_save ON library_items");
    await db.query("DROP FUNCTION fail_save()");
  }
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Report saved", { exact: true })).toBeVisible();
  expect(
    (
      await db.query("SELECT id FROM library_items WHERE job_id=$1", [
        job.jobId,
      ])
    ).rowCount,
  ).toBe(1);
  expect(calls()).toEqual(["token", "userinfo"]);
});
test("replayed callback invalidates a pending save across clean return reload", async ({
  page,
}) => {
  await prepareSave(page);
  let callback = "";
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/auth/callback/discord")
      callback = req.url();
  });
  await db.query(
    "CREATE FUNCTION fail_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled save failure'; END $$",
  );
  await db.query(
    "CREATE TRIGGER fail_save BEFORE INSERT ON library_items FOR EACH ROW EXECUTE FUNCTION fail_save()",
  );
  try {
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(page.locator(".auth-return [role=alert]")).toContainText(
      "We couldn't check your session",
    );
  } finally {
    await db.query("DROP TRIGGER fail_save ON library_items");
    await db.query("DROP FUNCTION fail_save()");
  }
  expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(1);
  expect(
    await page.evaluate(() =>
      Boolean(sessionStorage.getItem("munigan.auth.active")),
    ),
  ).toBe(true);
  let completions = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/library/save-intents/complete")
      completions++;
  });
  await page.goto(callback);
  await expect(page).toHaveURL(/\/auth\/return$/);
  await expect(page.locator(".auth-return [role=alert]")).toContainText(
    "missing or expired",
  );
  await page.reload();
  await expect(page.locator(".auth-return [role=alert]")).toContainText(
    "missing or expired",
  );
  await expect(page).toHaveURL(/\/auth\/return$/);
  expect(completions).toBe(0);
  expect((await db.query("SELECT id FROM library_items")).rowCount).toBe(0);
  expect(calls()).toEqual(["token", "userinfo"]);
});

test("missing original browser proof permits login but never saves", async ({
  page,
  context,
}) => {
  await prepareSave(page);
  await page.route("**/api/library/save-intents/complete", async (route) => {
    await context.clearCookies({ name: "tg_owner" });
    await route.continue();
  });
  const completed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/library/save-intents/complete",
  );
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  expect((await (await completed).json()).code).toBe("OWNER_COOKIE_REQUIRED");
  await expect(page.locator(".auth-return [role=alert]")).toContainText(
    "original browser",
  );
  expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(1);
  expect((await db.query("SELECT id FROM library_items")).rowCount).toBe(0);
});
test("fresh account A opens its library cross-device while account B and public viewers cannot manage it", async ({
  page,
  browser,
}) => {
  const job = await prepareSave(page);
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page.getByText("Report saved", { exact: true })).toBeVisible();
  for (const profile of ["account_a", "account_b"]) {
    const context = await browser.newContext();
    try {
      const device = await context.newPage();
      await signin(device, profile);
      await device.getByRole("button", { name: "Allow", exact: true }).click();
      await expectSigninComplete(device);
      const library = await device.request.get("/api/library");
      expect(library.status()).toBe(200);
      expect(library.headers()["cache-control"]).toContain("no-store");
      const body = await library.json();
      expect(body.items.length).toBe(profile === "account_a" ? 1 : 0);
      await device.goto("/library");
      await expect(
        device.getByRole("heading", { name: "My Library" }),
      ).toBeVisible();
      await device.goto("/reports/" + job.token);
      await expect(
        device.getByRole("heading", { name: "GEAR LAB", exact: true }),
      ).toBeVisible();
      const report = await device.request.get("/api/reports/" + job.token);
      expect(report.headers()["cache-control"]).toContain("no-store");
      const data = await report.json();
      expect(data.access.canDelete).toBe(profile === "account_a");
    } finally {
      await context.close();
    }
  }
  const viewer = await browser.newContext();
  try {
    const response = await viewer.request.get(
      "http://127.0.0.1:3100/api/reports/" + job.token,
    );
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.access.canManage).toBe(false);
    expect(data.access.canSave).toBe(false);
  } finally {
    await viewer.close();
  }
});

test("reauthentication with a different account never authorizes account deletion", async ({
  page,
}) => {
  await signin(page);
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expectSigninComplete(page);
  await db.query(
    "UPDATE auth_session SET created_at=now()-interval '10 minutes'",
  );
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Delete account" }).click();
  await page
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Verify with Discord" }),
  ).toBeVisible();
  await page.unroute("https://discord.com/**");
  await startDiscordHarness(page, "account_b");
  await page.getByRole("button", { name: "Verify with Discord" }).click();
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page.locator(".auth-return [role=alert]")).toContainText(
    "different Discord account",
  );
  expect(
    (
      await db.query(
        "SELECT user_id FROM account_lifecycle WHERE status='deleting'",
      )
    ).rowCount,
  ).toBe(0);
});

for (const kind of ["save", "signin", "deletion"] as const) {
  test(`provider denial with existing session invalidates ${kind} across clean reload`, async ({
    page,
    context,
    browser,
  }) => {
    if (kind === "save") await prepareSave(page);
    else if (kind === "signin") await signin(page);
    else {
      await signin(page);
      await page.getByRole("button", { name: "Allow", exact: true }).click();
      await expectSigninComplete(page);
      await db.query(
        "UPDATE auth_session SET created_at=now()-interval '10 minutes'",
      );
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Delete account" }).click();
      await page
        .getByRole("button", { name: "Delete my account", exact: true })
        .click();
      await page.getByRole("button", { name: "Verify with Discord" }).click();
    }
    // Introduce a real-handler session while preserving this pending OAuth state.
    if (kind !== "deletion") {
      const authenticated = await browser.newContext();
      const other = await authenticated.newPage();
      await signin(other);
      await other.getByRole("button", { name: "Allow", exact: true }).click();
      await expectSigninComplete(other);
      await context.addCookies(
        (await authenticated.cookies()).filter((cookie) =>
          cookie.name.endsWith(".session_token"),
        ),
      );
      await authenticated.close();
    }
    const prior = await page.request.get("/api/account/session");
    const accountId = (await prior.json()).account.id;
    let completions = 0;
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/library/save-intents/complete")
        completions++;
    });
    const denial = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/callback/discord",
    );
    await page.getByRole("button", { name: "Deny", exact: true }).click();
    expect(
      new URL(
        (await denial).headers().location,
        "http://127.0.0.1:3100",
      ).searchParams.get("error"),
    ).toBe("access_denied");
    await expect(page).toHaveURL(/\/auth\/return$/);
    await expect(page.locator(".auth-return [role=alert]")).toContainText(
      "canceled or could not finish",
    );
    if (kind === "save")
      await expect(
        page.getByRole("button", { name: "Back to report" }),
      ).toBeVisible();
    await page.reload();
    await expect(page.locator(".auth-return [role=alert]")).toContainText(
      "missing or expired",
    );
    expect(completions).toBe(0);
    expect((await db.query("SELECT id FROM library_items")).rowCount).toBe(0);
    expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(1);
    expect(
      (await (await page.request.get("/api/account/session")).json()).account
        .id,
    ).toBe(accountId);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("munigan.auth.account-deletion"),
      ),
    ).toBeNull();
    expect(
      (
        await db.query(
          "SELECT user_id FROM account_lifecycle WHERE status='deleting'",
        )
      ).rowCount,
    ).toBe(0);
  });
}
