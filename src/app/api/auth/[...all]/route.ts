import { toNextJsHandler } from "better-auth/next-js";
import { isIP } from "node:net";
import { getAuth } from "@/server/auth/config";
import {
  AccountError,
  accountFailure,
  authUnavailable,
} from "@/server/auth/errors";
export const runtime = "nodejs";

const allowed = new Set([
  "/api/auth/sign-in/social",
  "/api/auth/callback/discord",
  "/api/auth/get-session",
  "/api/auth/sign-out",
]);
async function handle(request: Request) {
  if (!allowed.has(new URL(request.url).pathname))
    return new Response(null, { status: 404 });
  try {
    if (
      request.method === "POST" &&
      new URL(request.url).pathname !== "/api/auth/callback/discord" &&
      request.headers.get("origin") !== process.env.APP_ORIGIN
    ) {
      throw new AccountError("INVALID_REQUEST", 403);
    }
    if (
      process.env.VERCEL &&
      !isIP(request.headers.get("x-vercel-forwarded-for")?.trim() ?? "")
    )
      throw authUnavailable();
    if (
      new URL(request.url).pathname === "/api/auth/sign-in/social" &&
      request.method === "POST"
    ) {
      let body: unknown;
      try {
        body = await request.clone().json();
      } catch {
        throw new AccountError("INVALID_REQUEST", 400);
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("provider" in body) ||
        body.provider !== "discord" ||
        "scopes" in body ||
        "additionalParams" in body ||
        "idToken" in body
      )
        throw new AccountError("INVALID_REQUEST", 400);
    }
    const handler = toNextJsHandler(getAuth());
    const response = await (request.method === "GET"
      ? handler.GET(request)
      : handler.POST(request));
    if (response.status >= 500) return accountFailure(authUnavailable());
    // The pinned OAuth adapter converts some persistence failures into redirects.
    // Preserve the application's unavailable contract for those failures too.
    const location = response.headers.get("location");
    if (
      location &&
      new URL(request.url).pathname === "/api/auth/callback/discord"
    ) {
      const code = new URL(location, request.url).searchParams.get("error");
      if (
        code &&
        [
          "internal_server_error",
          "unable_to_create_user",
          "unable_to_create_session",
          "unable_to_update_account",
        ].includes(code)
      )
        return accountFailure(authUnavailable());
      const destination = new URL(location, request.url);
      if (
        destination.origin === new URL(process.env.BETTER_AUTH_URL!).origin &&
        destination.pathname === "/api/auth/error"
      ) {
        // Better Auth cannot recover a trusted callback for invalid/replayed state.
        // Send only a fixed failure marker; never forward provider query values.
        const headers = new Headers(response.headers);
        headers.set(
          "location",
          new URL(
            "/auth/return?error=state_mismatch",
            process.env.BETTER_AUTH_URL!,
          ).href,
        );
        headers.set("cache-control", "no-store");
        return new Response(null, { status: response.status, headers });
      }
    }
    return response;
  } catch (error) {
    return accountFailure(error);
  }
}
export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
