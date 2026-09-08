import { NextRequest, NextResponse } from "next/server";
import { readReport } from "@/server/jobs/work";
import { owner, failure, privateHeaders } from "@/server/http/api";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const data = await readReport((await params).token, owner(request));
    const rows = data.report.rows;
    const offset = Math.max(
      0,
      Math.min(100000, Number(request.nextUrl.searchParams.get("cursor")) || 0),
    );
    const size = 20;
    const pinnedRows = rows.filter((r) =>
      [
        data.report.equippedId,
        data.report.highestId,
        data.report.recommendedId,
      ].includes(r.id),
    );
    return NextResponse.json(
      {
        ...data,
        report: { ...data.report, rows: rows.slice(offset, offset + size) },
        pinnedRows,
        nextCursor: offset + size < rows.length ? offset + size : null,
        totalRows: rows.length,
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
