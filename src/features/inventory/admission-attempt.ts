import type { AuthMode } from "@/domain/accounts/contracts";
import { describeError } from "@/i18n/error";
export type AdmissionAttempt = {
  version: 1;
  key: string;
  mode: AuthMode;
  body: string;
  status: "ready" | "uncertain" | "rejected";
};
const storageKey = "munigan.top-gear.admission";
export function createAttempt(
  payload: object,
  mode: AuthMode,
): AdmissionAttempt {
  return {
    version: 1,
    key: crypto.randomUUID(),
    mode,
    body: JSON.stringify({ ...payload, authMode: mode }),
    status: "ready",
  };
}
export function loadAttempt(): AdmissionAttempt | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      !/^[\w-]{32,100}$/.test(value.key) ||
      !["anonymous", "account"].includes(value.mode) ||
      !["ready", "uncertain", "rejected"].includes(value.status) ||
      typeof value.body !== "string" ||
      value.body.length > 1500000 ||
      JSON.parse(value.body).authMode !== value.mode
    )
      throw new Error("invalid");
    return value;
  } catch {
    throw new Error("The pending simulation request could not be recovered.");
  }
}
export function discardRejectedAttempt(attempt: AdmissionAttempt) {
  if (attempt.status !== "rejected") throw new Error("Admission is unresolved");
  sessionStorage.removeItem(storageKey);
}
export const canSwitchMode = (attempt: AdmissionAttempt) =>
  attempt.status === "rejected";
export async function submitAttempt(
  attempt: AdmissionAttempt,
): Promise<string> {
  const wasUncertain = attempt.status === "uncertain";
  // Persist BEFORE the network call. Reload must retry precisely this request.
  attempt.status = "uncertain";
  sessionStorage.setItem(storageKey, JSON.stringify(attempt));
  const response = await fetch("/api/top-gear/jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": attempt.key,
    },
    body: attempt.body,
  });
  const data = await response.json();
  if (!response.ok) {
    // A later rejected retry cannot prove an earlier ambiguous request was not admitted.
    if (
      !wasUncertain &&
      ((response.status === 422 &&
        ["allowance", "invalidInput"].includes(data.code)) ||
        (response.status === 401 && data.code === "SIGN_IN_REQUIRED") ||
        (response.status === 503 &&
          ["AUTH_UNAVAILABLE", "SAVING_UNAVAILABLE"].includes(data.code)) ||
        [400, 413, 415, 429].includes(response.status))
    )
      attempt.status = "rejected";
    sessionStorage.setItem(storageKey, JSON.stringify(attempt));
    throw describeError(data);
  }
  if (
    typeof data.reportUrl !== "string" ||
    !/^\/reports\/[A-Za-z0-9_-]+$/.test(data.reportUrl)
  )
    throw new Error("Invalid report response");
  sessionStorage.removeItem(storageKey);
  return data.reportUrl;
}
