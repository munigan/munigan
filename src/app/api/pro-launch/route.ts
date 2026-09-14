import { NextRequest, NextResponse } from "next/server";
import { getIdentity, requireAccount } from "@/server/auth/identity";
import {
  accountMutationBody,
  savingFailure,
} from "@/server/http/report-saving";
import { privateHeaders } from "@/server/http/api";
import { parseJoinProLaunchInput } from "@/server/pro-launch/http";
import {
  joinProLaunchList,
  readProLaunchStatus,
} from "@/server/pro-launch/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const account = requireAccount(await getIdentity(request));
    return NextResponse.json(await readProLaunchStatus(account), {
      headers: privateHeaders,
    });
  } catch (error) {
    return savingFailure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = parseJoinProLaunchInput(await accountMutationBody(request));
    const account = requireAccount(await getIdentity(request));
    return NextResponse.json(await joinProLaunchList(account, input), {
      headers: privateHeaders,
    });
  } catch (error) {
    return savingFailure(error);
  }
}
