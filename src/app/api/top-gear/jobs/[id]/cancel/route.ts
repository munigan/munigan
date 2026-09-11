import { getIdentity } from "@/server/auth/identity";
import { NextRequest, NextResponse } from "next/server";
import { cancelJob, AdmissionError } from "@/server/jobs/admit";
import { mutation, failure } from "@/server/http/api";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    mutation(request);
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new AdmissionError("Job not found", 404);
    await cancelJob(id, await getIdentity(request));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
