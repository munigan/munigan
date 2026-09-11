import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/server/auth/identity";
import { beginSaveIntent } from "@/server/library/claims";
import { privateHeaders } from "@/server/http/api";
import { savingBody, savingFailure } from "@/server/http/report-saving";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await savingBody(request);
    const { token } = await context.params;
    return NextResponse.json(
      await beginSaveIntent(token, await getIdentity(request)),
      { status: 201, headers: privateHeaders },
    );
  } catch (error) {
    return savingFailure(error);
  }
}
