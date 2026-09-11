import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/server/auth/identity";
import { AccountError } from "@/server/auth/errors";
import { requestAccountDeletion } from "@/server/accounts/deletion";
import { privateHeaders } from "@/server/http/api";
import {
  accountMutationBody,
  savingFailure,
} from "@/server/http/report-saving";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const fields = await accountMutationBody(request);
    if (
      Object.keys(fields).length !== 1 ||
      typeof fields.expectedUserId !== "string" ||
      !fields.expectedUserId ||
      fields.expectedUserId.length > 256
    )
      throw new AccountError("INVALID_REQUEST", 400);
    await requestAccountDeletion(
      await getIdentity(request),
      fields.expectedUserId,
    );
    return NextResponse.json(
      { status: "deleting" },
      { status: 202, headers: privateHeaders },
    );
  } catch (error) {
    return savingFailure(error);
  }
}
