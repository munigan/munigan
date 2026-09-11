import { appendFileSync } from "node:fs";
const origin = "http://127.0.0.1:3100";
const db = new URL(process.env.DATABASE_URL || "http://invalid");
if (
  process.env.OAUTH_E2E_HARNESS !== "1" ||
  !["development", "production"].includes(process.env.NODE_ENV) ||
  process.env.APP_ORIGIN !== origin ||
  process.env.BETTER_AUTH_URL !== origin ||
  db.hostname !== "127.0.0.1" ||
  db.port !== "55435" ||
  !/^-c search_path=tg_oauth_e2e_[a-f0-9]{16}$/.test(
    db.searchParams.get("options") || "",
  ) ||
  process.env.VITEST
)
  throw new Error("Unsafe OAuth harness process configuration");
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (
    !["discord.com", "discordapp.com"].some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    )
  )
    return nativeFetch(input, init);
  const request = new Request(input, init);
  const event = (kind) =>
    appendFileSync(
      process.env.OAUTH_E2E_EVENTS_FILE,
      JSON.stringify({ kind }) + "\n",
    );
  if (
    request.method === "POST" &&
    request.url === "https://discord.com/api/oauth2/token"
  ) {
    const form = new URLSearchParams(await request.text());
    if (
      form.get("grant_type") !== "authorization_code" ||
      form.get("client_id") !== "oauth-e2e-client" ||
      form.get("client_secret") !== "oauth-e2e-client-secret" ||
      form.get("redirect_uri") !== origin + "/api/auth/callback/discord"
    )
      return Response.json({ error: "invalid_request" }, { status: 400 });
    const profile = form.get("code")?.replace(/^oauth-e2e:/, "");
    if (!["account_a", "account_b", "phone_only"].includes(profile))
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    event("token");
    return Response.json({
      access_token: "access:" + profile,
      refresh_token: "refresh:" + profile,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "identify",
    });
  }
  if (
    request.method === "GET" &&
    [
      "https://discord.com/api/users/@me",
      "https://discord.com/api/users/%40me",
    ].includes(request.url)
  ) {
    const key = request.headers
      .get("authorization")
      ?.replace(/^Bearer access:/, "");
    const profiles = {
      account_a: {
        id: "100000000000000001",
        username: "account-a",
        global_name: "Account A",
      },
      account_b: {
        id: "100000000000000002",
        username: "account-b",
        global_name: "Account B",
      },
      phone_only: {
        id: "100000000000000003",
        username: "phone-only",
        global_name: null,
      },
    };
    if (!profiles[key])
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    event("userinfo");
    return Response.json({
      ...profiles[key],
      avatar: null,
      email: null,
      verified: false,
      discriminator: "0",
    });
  }
  throw new Error("Unexpected outbound Discord request");
};
