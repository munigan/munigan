import { NextRequest, NextResponse } from "next/server";
import { workPolicy } from "@/server/jobs/policy";
import { ensureOwnerCookie, failure, privateHeaders } from "@/server/http/api";
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json(
      { policy: workPolicy() },
      { headers: privateHeaders },
    );
    ensureOwnerCookie(request, response);
    return response;
  } catch (e) {
    return failure(e);
  }
}
