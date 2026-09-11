import { expect, type Page } from "@playwright/test";
export async function startDiscordHarness(page: Page, profile = "account_a") {
  const pattern = "https://discord.com/**";
  await page.route(pattern, async (route) => {
    const url = new URL(route.request().url());
    expect(url.pathname).toBe("/api/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("client_id")).toBe("oauth-e2e-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:3100/api/auth/callback/discord",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(Boolean(url.searchParams.get("state"))).toBe(true);
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Controlled Discord consent</title><button id="allow">Allow</button><button id="deny">Deny</button><script>const p=new URL(location.href).searchParams;function finish(allow){const u=new URL(p.get('redirect_uri'));u.searchParams.set('state',p.get('state'));u.searchParams.set(allow?'code':'error',allow?${JSON.stringify("oauth-e2e:" + profile)}:'access_denied');location.href=u.href;}document.querySelector('#allow').onclick=()=>finish(true);document.querySelector('#deny').onclick=()=>finish(false);</script>`,
    });
  });
  return {
    origin: "https://discord.com",
    close: async () => page.unroute(pattern),
  };
}
