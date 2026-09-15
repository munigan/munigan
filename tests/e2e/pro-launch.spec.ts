import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { startDiscordHarness } from "../support/discord-oauth";

let db: pg.Pool;
let events: string;
const evidenceDir = ".superpowers/sdd/2026-09-14-pro-launch-list/qa/task-7";

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
  mkdirSync(evidenceDir, { recursive: true });
  expect((await db.query("SELECT current_schema() name")).rows[0].name).toBe(
    runtime.schema,
  );
});

async function beginProSignIn(
  page: import("@playwright/test").Page,
  profile = "phone_only",
) {
  await startDiscordHarness(page, profile);
  await page.goto("/gear-lab");
  await page.getByRole("button", { name: "Go PRO", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue with Discord", exact: true })
    .click();
}

async function finishProSignIn(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page).toHaveURL(/\/gear-lab$/);
  await expect(
    page.getByRole("button", { name: "Join the PRO list", exact: true }),
  ).toBeVisible();
}

async function join(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Join the PRO list", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("You’re on the list.");
}

async function seedDraft(
  page: import("@playwright/test").Page,
  overLimit = false,
) {
  const script = `import { fixtureRequest } from "./tests/support/fixtures.ts";
import { encodeRequest } from "./src/domain/top-gear/request-schema.ts";
const request = fixtureRequest();
if (${JSON.stringify(overLimit)}) {
  const additions = request.snapshot.inventory.slice(0, 8).map((item, i) => ({
    ...item, instanceId: "pro-e2e-bag-" + i, enchantId: 0, gemIds: [],
    source: "bag", equippedSlot: undefined,
  }));
  request.snapshot.inventory.push(...additions);
  request.selection.selectedInstanceIds.push(...additions.map((item) => item.instanceId));
}
process.stdout.write(JSON.stringify(encodeRequest(request)));`;
  const fixture = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", script],
    {
      encoding: "utf8",
    },
  );
  if (fixture.status !== 0)
    throw new Error(`PRO fixture generation failed: ${fixture.stderr}`);
  await page.addInitScript(
    ({ value }) => localStorage.setItem("wow-droptimizer.top-gear.v1", value),
    { value: fixture.stdout },
  );
}

async function restoreDraft(page: import("@playwright/test").Page) {
  await page.goto("/gear-lab");
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
}

test.beforeEach(async () => {
  await db.query(
    "TRUNCATE pro_launch_memberships,tg_jobs,tg_budgets,auth_user,auth_verification,auth_rate_limit CASCADE",
  );
  writeFileSync(events, "");
});

test.afterAll(async () => {
  await db.end();
});

test("explicit Discord consent returns to an unjoined draft and joining persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedDraft(page);
  await startDiscordHarness(page, "phone_only");
  await restoreDraft(page);
  const draftBefore = await page.evaluate(() =>
    localStorage.getItem("wow-droptimizer.top-gear.v1"),
  );
  await expect(
    page.getByRole("heading", { name: /17 \/ 17 selected/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go PRO", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Gear Lab without limits",
  );
  await page
    .getByRole("button", { name: "Continue with Discord", exact: true })
    .click();
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page).toHaveURL(/\/gear-lab$/);
  await expect(
    page.getByRole("button", { name: "Join the PRO list", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("wow-droptimizer.top-gear.v1"),
    ),
  ).toBe(draftBefore);
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: /17 \/ 17 selected/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go PRO", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Join the PRO list", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Join the PRO list", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("You’re on the list.");
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Go PRO", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("You’re on the list.");
  await page.screenshot({ path: `${evidenceDir}/joined-desktop.png` });
});

test("OAuth cancellation never creates a launch membership", async ({
  page,
}) => {
  await beginProSignIn(page);
  await page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(page.locator(".auth-return [role=alert]")).toBeVisible();
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
});

test("invalid OAuth state never creates a launch membership", async ({
  page,
}) => {
  await beginProSignIn(page);
  await page.route("**/api/auth/callback/discord?*", async (route) => {
    const invalid = new URL(route.request().url());
    invalid.searchParams.set("state", "invalid-state");
    await route.continue({ url: invalid.href });
  });
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page.locator(".auth-return [role=alert]")).toBeVisible();
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
});

test("blocked resume storage preserves the Gear Lab draft and prevents OAuth navigation", async ({
  page,
}) => {
  await seedDraft(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "wow-droptimizer.top-gear.v1")
        throw new DOMException("blocked", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await startDiscordHarness(page, "phone_only");
  await restoreDraft(page);
  await page.getByRole("button", { name: "Go PRO", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue with Discord", exact: true })
    .click();
  await expect(page).toHaveURL(/\/gear-lab$/);
  await expect(page.getByRole("dialog")).toContainText(
    "We couldn’t save your current work",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("wow-droptimizer.top-gear.v1"),
    ),
  ).not.toBeNull();
});

test("a failed join can be retried without creating duplicate memberships", async ({
  page,
}) => {
  await beginProSignIn(page);
  await finishProSignIn(page);
  let interrupted = false;
  await page.route("**/api/pro-launch", async (route) => {
    if (route.request().method() === "POST" && !interrupted) {
      interrupted = true;
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Join the PRO list", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "We couldn’t confirm your signup",
  );
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
  await join(page);
  await page.reload();
  await page.getByRole("button", { name: "Go PRO", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("You’re on the list.");
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(1);
});

test("switching the browser session cannot enroll the account shown before the switch", async ({
  page,
  context,
  browser,
}) => {
  await beginProSignIn(page, "account_a");
  await finishProSignIn(page);

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await startDiscordHarness(other, "account_b");
  await other.goto("/en-us");
  await other.getByRole("button", { name: "Sign in", exact: true }).click();
  await other.getByRole("button", { name: "Continue with Discord" }).click();
  await other.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(other).toHaveURL(/\/en-us$/);
  await context.addCookies(
    (await otherContext.cookies()).filter((cookie) =>
      cookie.name.endsWith(".session_token"),
    ),
  );
  await otherContext.close();
  const rejected = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/pro-launch",
  );
  await page
    .getByRole("button", { name: "Join the PRO list", exact: true })
    .click();
  expect((await rejected).status()).toBe(409);
  await expect(page.getByText("Account B", { exact: true })).toBeVisible();
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
  await join(page);
  const membership = (
    await db.query(
      `SELECT m.user_id,u.name
       FROM pro_launch_memberships m JOIN auth_user u ON u.id=m.user_id`,
    )
  ).rows;
  expect(membership).toEqual([expect.objectContaining({ name: "Account B" })]);
});

test("deleting the authenticated account removes its launch membership", async ({
  page,
}) => {
  await beginProSignIn(page);
  await finishProSignIn(page);
  await join(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Delete account" }).click();
  await page
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Access removed");
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(0);
});

test("an existing Discord account can sign in again and retains its enrollment", async ({
  page,
}) => {
  await beginProSignIn(page);
  await finishProSignIn(page);
  await join(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Continue with Discord" }).click();
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page).toHaveURL(/\/gear-lab$/);
  await page.getByRole("button", { name: "Go PRO", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("You’re on the list.");
  expect(
    (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
  ).toBe(1);
});

for (const locale of ["en-us", "pt-br"] as const) {
  const names =
    locale === "pt-br"
      ? { pro: "Seja PRO", nav: "Abrir navegação", language: "Idioma" }
      : { pro: "Go PRO", nav: "Open navigation", language: "Language" };
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    test(`${locale} launch dialog fits and restores focus at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });
      const navButton = page.getByRole("button", { name: names.nav });
      const desktopTrigger = page.locator(".workbench-pro-button");
      const mobile = viewport.width <= 768;
      let trigger;
      if (mobile) {
        await expect(navButton).toBeVisible();
        await navButton.click();
        const drawer = page.locator(".workbench-drawer");
        await expect(drawer).toBeVisible();
        trigger = page
          .locator(".workbench-drawer")
          .getByRole("button", { name: names.pro, exact: true });
      } else {
        trigger = desktopTrigger;
        await expect(trigger).toBeVisible();
        const language = page.getByRole("combobox", { name: names.language });
        expect((await trigger.boundingBox())!.x).toBeLessThan(
          (await language.boundingBox())!.x,
        );
      }
      await trigger.click();
      await expect(page.locator(".workbench-drawer")).toHaveCount(0);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (locale === "en-us" && viewport.width === 1440) {
        const discord = dialog.getByRole("button", {
          name: "Continue with Discord",
          exact: true,
        });
        expect(
          await discord.evaluate((node) => ({
            first: node.firstElementChild?.tagName,
            last: node.lastElementChild?.tagName,
          })),
        ).toEqual({ first: "SPAN", last: "svg" });
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.locator(":focus")).toHaveCount(1);
        await page.keyboard.press("Tab");
        await expect(dialog.locator(":focus")).toHaveCount(1);
      }
      if (viewport.width === 320) {
        const bottomCta = dialog.getByRole("button", {
          name:
            locale === "pt-br"
              ? "Continuar com Discord"
              : "Continue with Discord",
          exact: true,
        });
        await bottomCta.scrollIntoViewIfNeeded();
        await expect(bottomCta).toBeVisible();
      }
      const box = (await dialog.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.height).toBeLessThanOrEqual(viewport.height);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (locale === "en-us" && viewport.width === 1440)
        await page.screenshot({ path: `${evidenceDir}/anonymous-desktop.png` });
      if (locale === "pt-br" && viewport.width === 320)
        await page.screenshot({
          path: `${evidenceDir}/anonymous-mobile-320.png`,
        });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(mobile ? navButton : desktopTrigger).toBeFocused();
    });
  }
}

test("a locked precision choice leaves the free 500 request runnable", async ({
  page,
}) => {
  await seedDraft(page);
  await restoreDraft(page);
  const select = page.getByRole("combobox", { name: "Iterations per set" });
  await expect(select).toHaveAttribute("data-select-value", "500");
  await select.click();
  await expect(page.getByRole("option")).toHaveCount(6);
  await page.locator('[role="option"][data-select-value="1000"]').click();
  await expect(select).toHaveAttribute("data-select-value", "500");
  await expect(
    page.getByText(
      "Free is limited to 500 iterations. Your simulation will run with 500 per set.",
    ),
  ).toBeVisible();
  let simulationPosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/top-gear/jobs"
    )
      simulationPosts++;
  });
  await page.screenshot({ path: `${evidenceDir}/free-sidebar.png` });
  await page.getByRole("button", { name: "Run Gear Lab", exact: true }).click();
  await expect.poll(() => simulationPosts).toBe(1);
});

for (const touchCase of [
  { width: 320, height: 740, isMobile: true, overLimit: false },
  { width: 320, height: 740, isMobile: true, overLimit: true },
  { width: 390, height: 844, isMobile: false, overLimit: false },
  { width: 390, height: 844, isMobile: false, overLimit: true },
]) {
  test(`touch allowance tooltip toggles at ${touchCase.width}px ${touchCase.isMobile ? "mobile" : "desktop emulation"} ${touchCase.overLimit ? "upper-bound" : "free"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: touchCase.isMobile,
      viewport: { width: touchCase.width, height: touchCase.height },
    });
    const page = await context.newPage();
    await seedDraft(page, touchCase.overLimit);
    await restoreDraft(page);
    const trigger = page.getByRole("button", { name: "About the set limit" });
    await trigger.tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await trigger.tap();
    await expect(page.getByRole("tooltip")).toBeHidden();
    await trigger.tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.getByRole("heading", { name: /^Your equipment/ }).tap();
    await expect(page.getByRole("tooltip")).toBeHidden();
    await trigger.tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    await context.close();
  });
}

for (const locale of ["en-us", "pt-br"] as const) {
  test(`joined ${locale} confirmation exposes the optional PRO role invitation without rejoining`, async ({
    page,
    context,
  }) => {
    const pt = locale === "pt-br";
    const names = pt
      ? {
          pro: "Seja PRO",
          continue: "Continuar com Discord",
          join: "Entrar na lista PRO",
          joined: "Você está na lista.",
          invite: "Ativar avisos no Discord",
          optional:
            "Opcional: entre no servidor para receber o cargo PRO Launch e menções no canal.",
          removal:
            "Para pedir a remoção do cargo PRO Launch depois, fale no canal de suporte.",
        }
      : {
          pro: "Go PRO",
          continue: "Continue with Discord",
          join: "Join the PRO list",
          joined: "You’re on the list.",
          invite: "Enable Discord notifications",
          optional:
            "Optional: join the server to receive the PRO Launch role and channel mentions.",
          removal:
            "To remove the PRO Launch role later, ask in the support channel.",
        };
    await startDiscordHarness(page, "phone_only");
    await page.goto(`/${locale}`);
    await page.getByRole("button", { name: names.pro, exact: true }).click();
    await page
      .getByRole("button", { name: names.continue, exact: true })
      .click();
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    let membershipPosts = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/pro-launch"
      )
        membershipPosts++;
    });
    await page.getByRole("button", { name: names.join, exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(names.joined);
    const invite = page.getByRole("link", { name: names.invite, exact: true });
    await expect(invite).toHaveAttribute(
      "href",
      "https://discord.gg/79SMq4A7vg",
    );
    await expect(invite).toHaveAttribute("target", "_blank");
    await expect(invite).toHaveAttribute("rel", /noopener/);
    await expect(invite).toHaveAttribute("rel", /noreferrer/);
    await expect(page.getByText(names.optional, { exact: true })).toBeVisible();
    await expect(page.getByText(names.removal, { exact: true })).toBeVisible();
    await context.route("https://discord.gg/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "Discord invite intercepted",
      }),
    );
    const popupPromise = page.waitForEvent("popup");
    await invite.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect.poll(() => membershipPosts).toBe(1);
    expect(
      (await db.query("SELECT * FROM pro_launch_memberships")).rowCount,
    ).toBe(1);
    await popup.close();
  });
}

test("an over-limit Add credits entry opens the shared dialog without a simulation POST", async ({
  page,
}) => {
  await seedDraft(page, true);
  let simulationPosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/top-gear/jobs"
    )
      simulationPosts++;
  });
  await restoreDraft(page);
  await expect(
    page.getByLabel("Up to 256 combinations", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "More combinations with PRO.",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/over-limit-sidebar.png` });
  await page.getByRole("button", { name: "Add credits", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Gear Lab without limits",
  );
  expect(simulationPosts).toBe(0);
});
