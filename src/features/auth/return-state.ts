import type { ReportViewState } from "@/domain/accounts/contracts";
import {
  proLaunchSources,
  type ProLaunchSource,
} from "@/domain/pro-launch/contracts";
export type SignInReturn = {
  returnPath: string;
  locale: "en-US" | "pt-BR";
  expectedUserId?: string;
  proLaunch?: { source: ProLaunchSource };
};
export const validFlowKey = (key: string) =>
  /^[A-Za-z0-9_-]{32,128}$/.test(key);
export function safeReturnPath(value: string, origin: string): string {
  try {
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      /[\\\u0000-\u0020]/.test(value)
    )
      return "/gear-lab";
    const url = new URL(value, origin);
    const decoded = decodeURIComponent(url.pathname);
    if (
      url.origin !== origin ||
      /[\\\u0000-\u0020]/.test(decoded) ||
      decoded.startsWith("//") ||
      /^\/api\/auth(?:\/|$)/i.test(decoded) ||
      /^\/auth\/return(?:\/|$)/i.test(decoded)
    )
      return "/gear-lab";
    return url.pathname;
  } catch {
    return "/gear-lab";
  }
}
export function validOAuthCallback(path: string): boolean {
  if (!path.startsWith("/auth/return?")) return false;
  const url = new URL(path, "https://local.invalid");
  const entries = [...url.searchParams];
  return (
    !url.hash &&
    entries.length === 1 &&
    ["flow", "intent"].includes(entries[0][0]) &&
    validFlowKey(entries[0][1])
  );
}
export function oauthCallbackPath(
  kind: "flow" | "intent",
  flow: string,
): string {
  const path = `/auth/return?${kind}=${flow}`;
  if (!validOAuthCallback(path)) throw new Error("Invalid OAuth return flow");
  return path;
}
function key(prefix: string, flow: string) {
  if (!validFlowKey(flow)) throw new Error("Invalid return flow");
  return `munigan.auth.${prefix}.${flow}`;
}
const origin = () => window.location.origin;
const localeValid = (value: unknown) => value === "en-US" || value === "pt-BR";
function reportValid(value: unknown): value is ReportViewState {
  if (!value || typeof value !== "object") return false;
  const s = value as ReportViewState;
  return (
    s.version === 1 &&
    typeof s.reportPath === "string" &&
    /^\/reports\/[^/]+$/.test(s.reportPath) &&
    safeReturnPath(s.reportPath, origin()) === s.reportPath &&
    localeValid(s.locale) &&
    Number.isInteger(s.cursor) &&
    s.cursor >= 0 &&
    s.cursor <= 1000000 &&
    s.cursor % 20 === 0 &&
    (s.selectedId === null ||
      (typeof s.selectedId === "string" && s.selectedId.length <= 512)) &&
    ["equipped", "highest"].includes(s.difference) &&
    Number.isFinite(s.scrollY) &&
    s.scrollY >= 0 &&
    s.scrollY <= 10000000
  );
}
function signInValid(value: unknown): value is SignInReturn {
  if (!value || typeof value !== "object") return false;
  const s = value as SignInReturn;
  return (
    typeof s.returnPath === "string" &&
    safeReturnPath(s.returnPath, origin()) === s.returnPath &&
    localeValid(s.locale) &&
    (s.expectedUserId === undefined ||
      (typeof s.expectedUserId === "string" &&
        s.expectedUserId.length > 0 &&
        s.expectedUserId.length <= 128)) &&
    (s.proLaunch === undefined ||
      (s.proLaunch !== null &&
        typeof s.proLaunch === "object" &&
        Object.keys(s.proLaunch).length === 1 &&
        "source" in s.proLaunch &&
        proLaunchSources.includes(s.proLaunch.source as ProLaunchSource)))
  );
}
function store(prefix: string, flow: string, value: unknown) {
  sessionStorage.setItem(
    key(prefix, flow),
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 30 * 60 * 1000,
      value,
    }),
  );
}
function load<T>(
  prefix: string,
  flow: string,
  valid: (value: unknown) => value is T,
): T | null {
  if (!validFlowKey(flow)) return null;
  const raw = sessionStorage.getItem(key(prefix, flow));
  if (!raw || raw.length > 4096) return null;
  try {
    const data = JSON.parse(raw);
    return data.version === 1 &&
      Number.isFinite(data.expiresAt) &&
      data.expiresAt > Date.now() &&
      data.expiresAt <= Date.now() + 30 * 60 * 1000 &&
      valid(data.value)
      ? data.value
      : null;
  } catch {
    return null;
  }
}
export function storeReturnState(flow: string, state: ReportViewState) {
  if (!reportValid(state)) throw new Error("Invalid report state");
  store("report", flow, state);
}
export const loadReturnState = (flow: string) =>
  load("report", flow, reportValid);
export const clearReturnState = (flow: string) =>
  sessionStorage.removeItem(key("report", flow));
export function storeSignInReturn(flow: string, state: SignInReturn) {
  const value = {
    ...state,
    returnPath: safeReturnPath(state.returnPath, origin()),
  };
  if (!signInValid(value)) throw new Error("Invalid sign-in state");
  store("signin", flow, value);
}
export const loadSignInReturn = (flow: string) =>
  load("signin", flow, signInValid);
export const clearSignInReturn = (flow: string) =>
  sessionStorage.removeItem(key("signin", flow));
