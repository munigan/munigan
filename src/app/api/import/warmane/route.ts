import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AppError, describeError } from "@/i18n/error";
import { privateHeaders } from "@/server/http/api";
import { relayUnavailable } from "@/server/warmane/relay";
import {
  lookupWarmaneCharacter,
  WarmaneError,
  WarmaneRelayError,
} from "@/server/warmane/armory";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const mode = request.nextUrl.searchParams.get("mode") ?? "auto";
    if (mode !== "auto" && mode !== "refresh" && mode !== "saved")
      throw new AppError("invalidInput", "Choose a valid Armory import mode.");
    const result = await lookupWarmaneCharacter(
      {
        name: request.nextUrl.searchParams.get("name") ?? "",
        realm: request.nextUrl.searchParams.get("realm") ?? "",
      },
      mode,
    );
    return NextResponse.json(result, {
      headers: { ...privateHeaders, "X-Request-Id": result.meta.requestId },
    });
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error(
        JSON.stringify({
          event: "warmane.api",
          requestId,
          code: "warmaneRelayUnavailable",
        }),
      );
      error = relayUnavailable(requestId);
    }
    if (error instanceof WarmaneRelayError)
      return NextResponse.json(
        { error: error.failure.message, ...error.failure },
        {
          status: error.status,
          headers: {
            ...privateHeaders,
            "X-Request-Id": error.failure.requestId,
            ...(error.failure.retryAfterSeconds !== undefined
              ? { "Retry-After": String(error.failure.retryAfterSeconds) }
              : {}),
          },
        },
      );
    const described = describeError(error);
    return NextResponse.json(
      { error: described.message, ...described, requestId },
      {
        status: error instanceof WarmaneError ? error.status : 422,
        headers: { ...privateHeaders, "X-Request-Id": requestId },
      },
    );
  }
}
