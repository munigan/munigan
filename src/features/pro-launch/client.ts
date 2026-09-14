import type { AccountErrorCode } from "@/domain/accounts/contracts";
import {
  PRO_OFFER_VERSION,
  type JoinProLaunchInput,
  type ProLaunchMembership,
  type ProLaunchStatus,
} from "@/domain/pro-launch/contracts";

const recognizedCodes = new Set<AccountErrorCode>([
  "SIGN_IN_REQUIRED",
  "AUTH_UNAVAILABLE",
  "NOT_FOUND",
  "REPORT_EXPIRED",
  "OWNER_COOKIE_REQUIRED",
  "INTENT_EXPIRED",
  "REPORT_NOT_READY",
  "CLAIM_CONFLICT",
  "ACCOUNT_DELETING",
  "FRESH_LOGIN_REQUIRED",
  "ACCOUNT_CHANGED",
  "SAVING_UNAVAILABLE",
  "INVALID_REQUEST",
  "RATE_LIMITED",
]);

export class ProLaunchClientError extends Error {
  constructor(
    public status: number,
    public code?: AccountErrorCode,
  ) {
    super("PRO launch request failed");
    this.name = "ProLaunchClientError";
  }
}

function isJoined(value: unknown): value is ProLaunchMembership {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const joinedAt = typeof data.joinedAt === "string" ? data.joinedAt : "";
  const joinedTime = Date.parse(joinedAt);
  return (
    Object.keys(data).length === 3 &&
    data.status === "joined" &&
    Number.isFinite(joinedTime) &&
    new Date(joinedTime).toISOString() === joinedAt &&
    data.offerVersion === PRO_OFFER_VERSION
  );
}

function parseStatus(value: unknown): ProLaunchStatus {
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    if (Object.keys(data).length === 1 && data.status === "not_joined")
      return { status: "not_joined" };
    if (isJoined(value)) return value;
  }
  throw new Error("Invalid PRO launch response");
}

async function readResponse(response: Response): Promise<ProLaunchStatus> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const code =
      payload &&
      typeof payload === "object" &&
      recognizedCodes.has(
        (payload as { code?: AccountErrorCode }).code as AccountErrorCode,
      )
        ? (payload as { code: AccountErrorCode }).code
        : undefined;
    throw new ProLaunchClientError(response.status, code);
  }
  return parseStatus(payload);
}

export async function getProLaunchStatus(
  signal: AbortSignal,
): Promise<ProLaunchStatus> {
  return readResponse(
    await fetch("/api/pro-launch", {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    }),
  );
}

export async function joinProLaunch(
  input: JoinProLaunchInput,
  signal: AbortSignal,
): Promise<ProLaunchMembership> {
  const result = await readResponse(
    await fetch("/api/pro-launch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "same-origin",
      signal,
    }),
  );
  if (result.status !== "joined")
    throw new Error("Invalid PRO launch response");
  return result;
}
