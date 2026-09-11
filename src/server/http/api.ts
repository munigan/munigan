import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdmissionError } from "@/server/jobs/admit";
import { capability } from "@/server/jobs/capabilities";
import { AccountError } from "@/server/auth/errors";
import { diagnosticIdentity } from "@/i18n/diagnostics";
export const ownerCookie = "tg_owner";
export function owner(request: NextRequest) {
  return request.cookies.get(ownerCookie)?.value;
}
export function ensureOwnerCookie(
  request: NextRequest,
  response: NextResponse,
) {
  const key = owner(request);
  if (key && /^[\w-]{43}$/.test(key)) return;
  response.cookies.set(ownerCookie, capability(), {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" && process.env.APP_ENV !== "local",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
export function requireOwner(request: NextRequest) {
  const key = owner(request);
  if (!key || !/^[\w-]{43}$/.test(key))
    throw new AdmissionError(
      "Reload this page to initialize your anonymous session",
      401,
    );
  return key;
}
export function mutation(request: NextRequest) {
  const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  if (request.headers.get("origin") !== expected)
    throw new AdmissionError("Invalid request origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AdmissionError("Use application/json", 415);
}
export async function body(request: NextRequest, maximumBytes = 1500000) {
  const reader = request.body?.getReader();
  if (!reader) throw new AdmissionError("Request body required", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new AdmissionError("Request body is too large", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AdmissionError("Invalid JSON", 400);
  }
}
export function failure(error: unknown) {
  if (error instanceof AccountError)
    return NextResponse.json(
      {
        code: error.code,
        error:
          error.code === "AUTH_UNAVAILABLE"
            ? "Authentication is temporarily unavailable"
            : error.code === "REPORT_EXPIRED"
              ? "This report has expired"
              : "Unable to process account request",
      },
      { status: error.status, headers: privateHeaders },
    );
  if (error instanceof AdmissionError)
    return NextResponse.json(
      { error: error.message, ...diagnosticIdentity(error) },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Invalid Top Gear input",
        code: "invalidInput",
        details: error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .slice(0, 3),
      },
      { status: 422 },
    );
  if (
    error instanceof Error &&
    /ECONNREFUSED|timeout|CAPABILITY_KEY|Production admission/.test(
      error.message,
    )
  )
    return NextResponse.json(
      {
        error:
          "Simulation service is unavailable. Your selection has been kept.",
        code: "serviceUnavailable",
      },
      { status: 503 },
    );
  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "Unable to process request",
      ...diagnosticIdentity(
        error instanceof Error ? error : "Unable to process request",
      ),
    },
    { status: 422 },
  );
}
export const privateHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export function sourceHash(request: NextRequest) {
  const header = process.env.TRUSTED_IP_HEADER;
  if (!header) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.APP_ENV !== "local"
    )
      throw new AdmissionError("Public admission is not configured", 503);
    return undefined;
  }
  const ip = request.headers.get(header)?.trim();
  if (!ip || !isIP(ip))
    throw new AdmissionError(
      "The deployment did not supply a trusted client address",
      503,
    );
  return createHmac("sha256", process.env.CAPABILITY_KEY ?? "")
    .update(ip)
    .digest("hex");
}
