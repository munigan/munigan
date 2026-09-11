import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/server/auth/identity";
import { completeSaveIntent } from "@/server/library/claims";
import { privateHeaders } from "@/server/http/api";
import { savingBody, savingFailure } from "@/server/http/report-saving";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const token = await savingBody(request, true);
    return NextResponse.json(
      await completeSaveIntent(token!, await getIdentity(request)),
      { status: 200, headers: privateHeaders },
    );
  } catch (error) {
    return savingFailure(error);
  }
}
