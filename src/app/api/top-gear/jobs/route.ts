import { pool } from "@/server/db/client";
import { trackAfterResponse } from "@/lib/analytics/server";
import { getIdentity, requireAccount } from "@/server/auth/identity";
import { authFlags } from "@/server/auth/config";
import { AccountError } from "@/server/auth/errors";
import { digest } from "@/server/jobs/capabilities";
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
    const payload = await body(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new AccountError("INVALID_REQUEST", 400);
    const { authMode, ...simulationRequest } = payload;
    if (
      authMode !== undefined &&
      authMode !== "account" &&
      authMode !== "anonymous"
    )
      throw new AccountError("INVALID_REQUEST", 400);
    const ownerKey = requireOwner(request);
    const identity =
      authMode === "anonymous"
        ? { account: null, ownerHash: digest(ownerKey) }
        : await getIdentity(request);
    if (authMode === "account") requireAccount(identity);
    if (identity.account && !authFlags().savingEnabled)
      throw new AccountError("SAVING_UNAVAILABLE", 503);
    const result = await admitJob({
      identity,
      request: simulationRequest,
      sourceHash: sourceHash(request),
      ownerKey,
      idempotencyKey: request.headers.get("idempotency-key") ?? "",
    });
    wakeDispatcher();
    trackAfterResponse(
      request,
      "gear_run_accepted",
      result.jobId,
      {
        auth_mode: identity.account ? "account" : "anonymous",
        iterations:
          typeof simulationRequest.iterations === "number"
            ? simulationRequest.iterations
            : 500,
      },
      async () => {
        const row = await pool.query<{ created_at: Date }>(
          "SELECT created_at FROM tg_jobs WHERE id=$1",
          [result.jobId],
        );
        if (!row.rows[0]) throw new Error("Job unavailable");
        return row.rows[0].created_at;
      },
    );
    return NextResponse.json(
      { ...result, reportUrl: `/reports/${result.reportToken}` },
      { status: 202, headers: privateHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
