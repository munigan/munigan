import { NextRequest, NextResponse } from "next/server";
import { AccountError, authUnavailable } from "@/server/auth/errors";
import { AdmissionError } from "@/server/jobs/admit";
import { body, failure, mutation, privateHeaders } from "./api";

export async function savingBody(
  request: NextRequest,
  completion = false,
): Promise<string | null> {
  mutation(request);
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new AdmissionError("Use application/json", 415);
  const value: unknown = await body(request, 2048);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new AccountError("INVALID_REQUEST", 400);
  const fields = value as Record<string, unknown>;
  if (completion) {
    if (
      Object.keys(fields).length !== 1 ||
      typeof fields.token !== "string" ||
      !/^[\w-]{43}$/.test(fields.token)
    )
      throw new AccountError("INVALID_REQUEST", 400);
    return fields.token;
  }
  if (Object.keys(fields).length)
    throw new AccountError("INVALID_REQUEST", 400);
  return null;
}
export function savingFailure(error: unknown) {
  if (error instanceof AdmissionError)
    return NextResponse.json(
      { code: "INVALID_REQUEST", error: "Invalid request" },
      { status: error.status, headers: privateHeaders },
    );
  return failure(error instanceof AccountError ? error : authUnavailable());
}
