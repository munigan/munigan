import { NextRequest, NextResponse } from "next/server";
import { accountFailure, accountHeaders } from "@/server/auth/errors";
import { getIdentity, requireAccount } from "@/server/auth/identity";
import { libraryReportPath } from "@/server/library/repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = requireAccount(await getIdentity(request));
    return NextResponse.json(
      { reportPath: await libraryReportPath(account.id, (await params).id) },
      { headers: accountHeaders },
    );
  } catch (error) {
    return accountFailure(error);
  }
}
