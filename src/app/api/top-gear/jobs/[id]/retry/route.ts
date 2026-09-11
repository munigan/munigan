import { getIdentity } from "@/server/auth/identity";
import { authFlags } from "@/server/auth/config";
import { AccountError } from "@/server/auth/errors";
import { wakeDispatcher } from "@/server/jobs/wake";
import { NextRequest, NextResponse } from "next/server";
import { retryJob } from "@/server/jobs/work";
import { AdmissionError } from "@/server/jobs/admit";
import { mutation, sourceHash, requireOwner, failure } from "@/server/http/api";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    mutation(request);
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new AdmissionError("Job not found", 404);
    const identity = await getIdentity(request);
    if (identity.account && !authFlags().savingEnabled)
      throw new AccountError("SAVING_UNAVAILABLE", 503);
    const result = await retryJob(
      id,
      identity,
      request.headers.get("idempotency-key") ?? "",
      requireOwner(request),
      sourceHash(request),
    );
    wakeDispatcher();
    return NextResponse.json(
      { ...result, reportUrl: `/reports/${result.reportToken}` },
      { status: 202 },
    );
  } catch (e) {
    return failure(e);
  }
}
