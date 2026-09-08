import { NextRequest, NextResponse } from "next/server";
import { workPolicy } from "@/server/jobs/policy";
import { capability } from "@/server/jobs/capabilities";
import { owner, ownerCookie, failure, privateHeaders } from "@/server/http/api";
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json(
      { policy: workPolicy() },
      { headers: privateHeaders },
    );
    if (!owner(request))
      response.cookies.set(ownerCookie, capability(), {
        httpOnly: true,
        sameSite: "strict",
        secure:
          process.env.NODE_ENV === "production" &&
          process.env.APP_ENV !== "local",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    return response;
  } catch (e) {
    return failure(e);
  }
}
