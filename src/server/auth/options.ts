import type { BetterAuthOptions } from "better-auth";

const disabledPaths = [
  "/sign-up/email",
  "/sign-in/email",
  "/send-verification-email",
  "/verify-email",
  "/request-password-reset",
  "/reset-password",
  "/verify-password",
  "/change-password",
  "/set-password",
  "/change-email",
  "/update-user",
  "/delete-user",
  "/delete-user/callback",
  "/link-social",
  "/unlink-account",
  "/get-access-token",
  "/refresh-token",
  "/account-info",
  "/list-accounts",
];

export function authOptions(env: NodeJS.ProcessEnv): BetterAuthOptions {
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.APP_ORIGIN ? [env.APP_ORIGIN] : [],
    disabledPaths,
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies:
        env.NODE_ENV === "production" ||
        env.BETTER_AUTH_URL?.startsWith("https://"),
      crossSubDomainCookies: { enabled: false },
      ipAddress: {
        ipAddressHeaders: env.VERCEL ? ["x-vercel-forwarded-for"] : [],
      },
    },
    user: {
      modelName: "auth_user",
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      deleteUser: { enabled: false },
      changeEmail: { enabled: false },
    },
    session: {
      modelName: "auth_session",
      fields: {
        userId: "user_id",
        createdAt: "created_at",
        updatedAt: "updated_at",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
      },
      expiresIn: 604800,
      updateAge: 86400,
      freshAge: 300,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "auth_account",
      fields: {
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
      },
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      storeAccountCookie: false,
      accountLinking: { enabled: false },
    },
    verification: {
      modelName: "auth_verification",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limit",
      window: 60,
      max: 100,
    },
    emailAndPassword: { enabled: false },
    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID ?? "",
        clientSecret: env.DISCORD_CLIENT_SECRET ?? "",
        disableDefaultScope: true,
        scope: ["identify"],
        disableSignUp: env.AUTH_ENROLLMENT_ENABLED !== "true",
        mapProfileToUser: (profile) => ({
          email: `${profile.id}@discord.placeholder.invalid`,
          emailVerified: false,
        }),
      },
    },
  };
}
