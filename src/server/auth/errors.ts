import type { AccountErrorCode } from "@/domain/accounts/contracts";

export class AccountError extends Error {
  constructor(
    public readonly code: AccountErrorCode,
    public readonly status: number,
    message = "Unable to process account request",
  ) {
    super(message);
    this.name = "AccountError";
  }
}
export function authUnavailable() {
  return new AccountError(
    "AUTH_UNAVAILABLE",
    503,
    "Authentication is temporarily unavailable",
  );
}
export const accountHeaders = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};
export function accountFailure(error: unknown): Response {
  const safe = error instanceof AccountError ? error : authUnavailable();
  return Response.json(
    {
      code: safe.code,
      error:
        safe.code === "AUTH_UNAVAILABLE"
          ? "Authentication is temporarily unavailable"
          : "Unable to process account request",
    },
    { status: safe.status, headers: accountHeaders },
  );
}
