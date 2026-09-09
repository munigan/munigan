import { wakeDispatcher } from "@/server/jobs/wake";
import { NextRequest, NextResponse } from "next/server";
import { admitJob } from "@/server/jobs/admit";
import {
  body,
  mutation,
  sourceHash,
  requireOwner,
  failure,
  privateHeaders,
} from "@/server/http/api";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    mutation(request);
    const result = await admitJob({
      request: await body(request),
      sourceHash: sourceHash(request),
      ownerKey: requireOwner(request),
      idempotencyKey: request.headers.get("idempotency-key") ?? "",
    });
    wakeDispatcher();
    return NextResponse.json(
      { ...result, reportUrl: `/reports/${result.reportToken}` },
      { status: 202, headers: privateHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
