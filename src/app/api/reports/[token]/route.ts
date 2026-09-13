import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/server/auth/identity";
import { readReport } from "@/server/reports/read";
import { ensureOwnerCookie, failure, privateHeaders } from "@/server/http/api";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const data = await readReport(
      (await params).token,
      await getIdentity(request),
    );
    const rows = data.report.rows;
    const cursor = Number(request.nextUrl.searchParams.get("cursor"));
    // Uncapped reports must advance past the former admission-era ceiling.
    const maximumOffset =
      data.report.policy.maxUnits === null ? rows.length : 100000;
    const offset =
      Number.isSafeInteger(cursor) && cursor >= 0
        ? Math.min(cursor, maximumOffset)
        : 0;
    const size = 20;
    const pinnedRows = rows.filter((r) =>
      [
        data.report.equippedId,
        data.report.highestId,
        data.report.recommendedId,
      ].includes(r.id),
    );
    const response = NextResponse.json(
      {
        ...data,
        report: { ...data.report, rows: rows.slice(offset, offset + size) },
        pinnedRows,
        nextCursor: offset + size < rows.length ? offset + size : null,
        totalRows: rows.length,
      },
      { headers: privateHeaders },
    );
    ensureOwnerCookie(request, response);
    return response;
  } catch (e) {
    return failure(e);
  }
}
