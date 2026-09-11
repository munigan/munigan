import { NextRequest, NextResponse } from "next/server";
import { getIdentity, requireAccount } from "@/server/auth/identity";
import { deleteLibraryReport } from "@/server/accounts/deletion";
import { privateHeaders } from "@/server/http/api";
import { savingBody, savingFailure } from "@/server/http/report-saving";
export const runtime = "nodejs";
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await savingBody(request);
    const account = requireAccount(await getIdentity(request));
    await deleteLibraryReport(account.id, (await context.params).id);
    return new NextResponse(null, { status: 204, headers: privateHeaders });
  } catch (error) {
    return savingFailure(error);
  }
}
