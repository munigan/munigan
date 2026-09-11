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
