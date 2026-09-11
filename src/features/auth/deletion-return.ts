import { validFlowKey } from "./return-state";
const key = "munigan.auth.account-deletion";
type DeletionReturn = {
  version: 1;
  flow: string;
  expectedUserId: string;
  expiresAt: number;
  validated: boolean;
};
export function loadDeletionReturn(): DeletionReturn | null {
  const raw = sessionStorage.getItem(key);
  if (!raw || raw.length > 1024) return null;
  try {
    const state = JSON.parse(raw);
    return state.version === 1 &&
      typeof state.flow === "string" &&
      validFlowKey(state.flow) &&
      typeof state.expectedUserId === "string" &&
      state.expectedUserId.length > 0 &&
      state.expectedUserId.length <= 128 &&
      typeof state.validated === "boolean" &&
      Number.isFinite(state.expiresAt) &&
      state.expiresAt > Date.now() &&
      state.expiresAt <= Date.now() + 30 * 60 * 1000
      ? state
      : null;
  } catch {
    return null;
  }
}
export function storeDeletionReturn(flow: string, expectedUserId: string) {
  if (!validFlowKey(flow) || !expectedUserId || expectedUserId.length > 128)
    throw new Error("Invalid deletion return");
  sessionStorage.setItem(
    key,
    JSON.stringify({
      version: 1,
      flow,
      expectedUserId,
      expiresAt: Date.now() + 30 * 60 * 1000,
      validated: false,
    }),
  );
}
// Only the return page calls this after checking the actual same-origin session.
export function validateDeletionReturn(flow: string, accountId: string) {
  const state = loadDeletionReturn();
  if (state?.flow === flow && state.expectedUserId === accountId)
    sessionStorage.setItem(key, JSON.stringify({ ...state, validated: true }));
}
export function clearDeletionReturn() {
  sessionStorage.removeItem(key);
}
export function clearDeletedAccountBrowserState(): boolean {
  let cleared = true;
  // Only known application drafts/return/admission state, never storage.clear().
  for (const key of [
    "wow-droptimizer.top-gear.v1",
    "munigan.top-gear.import.v1",
  ]) {
    try {
      localStorage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index),
    );
    for (const key of keys)
      if (
        key &&
        (key.startsWith("munigan.auth.") ||
          key === "munigan.top-gear.admission" ||
          key === "munigan.top-gear.signin-restore")
      ) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          cleared = false;
        }
      }
  } catch {
    cleared = false;
  }
  return cleared;
}
