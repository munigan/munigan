import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { pool } from "@/server/db/client";
import { authOptions } from "./options";
import { assertActiveAccount } from "./account-lock";
import { authUnavailable } from "./errors";

let auth: ReturnType<typeof betterAuth> | undefined;
export function authFlags() {
  return {
    savingEnabled: process.env.REPORT_SAVING_ENABLED === "true",
    enrollmentEnabled: process.env.AUTH_ENROLLMENT_ENABLED === "true",
  };
}
export function authConfigured(): boolean {
  return [
    process.env.BETTER_AUTH_SECRET,
    process.env.BETTER_AUTH_URL,
    process.env.APP_ORIGIN,
    process.env.DISCORD_CLIENT_ID,
    process.env.DISCORD_CLIENT_SECRET,
  ].every(Boolean);
}
export function getAuth(): ReturnType<typeof betterAuth> {
  if (!authConfigured()) throw authUnavailable();
  let origin: URL;
  try {
    origin = new URL(process.env.BETTER_AUTH_URL!);
    if (
      origin.origin !== process.env.APP_ORIGIN ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/" ||
      !["http:", "https:"].includes(origin.protocol) ||
      (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
    )
      throw authUnavailable();
    if (process.env.BETTER_AUTH_SECRET!.length < 32) throw authUnavailable();
  } catch {
    throw authUnavailable();
  }
  auth ??= betterAuth<BetterAuthOptions>({
    ...authOptions(process.env),
    database: pool,
    // Auth internals can attach raw SQL/provider details; expose only our stable errors.
    logger: { disabled: true },
    onAPIError: { throw: true },
    databaseHooks: {
      user: {
        create: {
          before: async () => {
            if (!authFlags().enrollmentEnabled)
              throw new APIError("FORBIDDEN", {
                message: "Enrollment is disabled",
              });
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            await assertActiveAccount(session.userId);
          },
        },
      },
    },
  });
  return auth;
}
