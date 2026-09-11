import { describe, expect, it } from "vitest";
import { authOptions } from "./options";

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DISCORD_CLIENT_ID: "discord-client",
  DISCORD_CLIENT_SECRET: "discord-secret",
  AUTH_ENROLLMENT_ENABLED: "true",
};

describe("authOptions", () => {
  it("configures Discord identify-only with an unverified placeholder identity", async () => {
    const options = authOptions(env);

    expect(Object.keys(options.socialProviders ?? {})).toEqual(["discord"]);
    const discord = options.socialProviders?.discord as {
      clientId: string;
      clientSecret: string;
      disableDefaultScope: boolean;
      scope: string[];
      disableSignUp: boolean;
      mapProfileToUser: (profile: { id: string }) => unknown;
    };
    expect(discord).toMatchObject({
      clientId: "discord-client",
      clientSecret: "discord-secret",
      disableDefaultScope: true,
      scope: ["identify"],
      disableSignUp: false,
    });

    const mapped = await discord.mapProfileToUser({
      id: "123456789",
      verified: true,
    } as never);
    expect(mapped).toEqual({
      email: "123456789@discord.placeholder.invalid",
      emailVerified: false,
    });
  });

  it("keeps existing Discord sign-in while enrollment is disabled", () => {
    const options = authOptions({ ...env, AUTH_ENROLLMENT_ENABLED: "false" });

    expect(
      (options.socialProviders?.discord as { disableSignUp: boolean })
        .disableSignUp,
    ).toBe(true);
  });

  it("uses database-backed seven-day sessions without account linking", () => {
    const options = authOptions(env);

    expect(options.session).toMatchObject({
      modelName: "auth_session",
      expiresIn: 604800,
      updateAge: 86400,
      freshAge: 300,
      cookieCache: { enabled: false },
    });
    expect(options.account).toMatchObject({
      modelName: "auth_account",
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      storeAccountCookie: false,
      accountLinking: { enabled: false },
    });
    expect(options.emailAndPassword).toEqual({ enabled: false });
  });

  it("maps every application-facing auth column to snake case", () => {
    const options = authOptions(env);

    expect(options.user?.fields).toEqual({
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
    expect(options.session?.fields).toEqual({
      userId: "user_id",
      createdAt: "created_at",
      updatedAt: "updated_at",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
    });
    expect(options.account?.fields).toEqual({
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      scope: "scope",
      password: "password",
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
    expect(options.verification?.fields).toEqual({
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
  });
});
