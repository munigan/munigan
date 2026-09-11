import { NextRequest, NextResponse } from "next/server";
import { describeError } from "@/i18n/error";
import { failure, privateHeaders } from "@/server/http/api";
import { importWarmaneCharacter, WarmaneError } from "@/server/warmane/armory";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const character = await importWarmaneCharacter({
      name: request.nextUrl.searchParams.get("name") ?? "",
      realm: request.nextUrl.searchParams.get("realm") ?? "",
    });
    return NextResponse.json({ character }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof WarmaneError)
      return NextResponse.json(
        { error: error.message, ...describeError(error) },
        { status: error.status, headers: privateHeaders },
      );
    return failure(error);
  }
}
