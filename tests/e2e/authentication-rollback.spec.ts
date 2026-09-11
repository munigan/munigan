import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";
import { startDiscordHarness } from "../support/discord-oauth";
test("rollback preserves existing login while rejecting new enrollment and saving", async ({
  page,
}) => {
  const runtime = JSON.parse(
    readFileSync(
      ".superpowers/sdd/2026-09-10-discord-authentication/oauth-runtime.json",
      "utf8",
    ),
  );
  if (!/^tg_oauth_e2e_[a-f0-9]{16}$/.test(runtime.schema))
    throw new Error("Invalid fixture schema");
  const db = new pg.Pool({ connectionString: runtime.databaseURL });
  try {
    await db.query(
      "INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES('existing','Account A','100000000000000001@discord.placeholder.invalid',false,now(),now())",
    );
    await db.query(
      "INSERT INTO auth_account(id,account_id,provider_id,user_id,created_at,updated_at) VALUES('existing','100000000000000001','discord','existing',now(),now())",
    );
    await startDiscordHarness(page);
    await page.goto("/en-us");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Continue with Discord" }).click();
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Account menu" }),
    ).toBeVisible();
    const session = await page.request.get("/api/account/session");
    const body = await session.json();
    expect(body.savingEnabled).toBe(false);
    expect(body.enrollmentEnabled).toBe(false);
    await page.context().clearCookies();
    await page.unroute("https://discord.com/**");
    await startDiscordHarness(page, "account_b");
    await page.goto("/en-us");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Continue with Discord" }).click();
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(page.locator(".auth-return [role=alert]")).toBeVisible();
    expect((await db.query("SELECT id FROM auth_user")).rowCount).toBe(1);
    expect((await db.query("SELECT id FROM auth_session")).rowCount).toBe(1);
  } finally {
    await db.end();
  }
});
