import { NextRequest, NextResponse } from "next/server";
import { cancelJob, AdmissionError } from "@/server/jobs/admit";
import { mutation, requireOwner, failure } from "@/server/http/api";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    mutation(request);
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new AdmissionError("Job not found", 404);
    if (!(await cancelJob(id, requireOwner(request))))
      throw new AdmissionError("This job cannot be canceled", 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
