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
    const result = await retryJob(
      id,
      requireOwner(request),
      request.headers.get("idempotency-key") ?? "",
      sourceHash(request),
    );
    return NextResponse.json(
      { ...result, reportUrl: `/reports/${result.reportToken}` },
      { status: 202 },
    );
  } catch (e) {
    return failure(e);
  }
}
