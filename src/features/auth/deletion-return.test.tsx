import { beforeEach, expect, it, vi } from "vitest";
import {
  storeDeletionReturn,
  loadDeletionReturn,
  validateDeletionReturn,
} from "./deletion-return";
const flow = "a".repeat(43);
beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});
it("rejects mismatched flows/accounts and expired return context", () => {
  storeDeletionReturn(flow, "original");
  validateDeletionReturn("b".repeat(43), "original");
  expect(loadDeletionReturn()?.validated).toBe(false);
  validateDeletionReturn(flow, "other");
  expect(loadDeletionReturn()?.validated).toBe(false);
  validateDeletionReturn(flow, "original");
  expect(loadDeletionReturn()?.validated).toBe(true);
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 31 * 60 * 1000);
  expect(loadDeletionReturn()).toBeNull();
});
it.each([
  "{",
  JSON.stringify({
    version: 1,
    flow,
    expectedUserId: "a",
    expiresAt: Date.now() + 1000,
    validated: "yes",
  }),
  "x".repeat(1025),
])("ignores malformed or oversized context", (raw) => {
  sessionStorage.setItem("munigan.auth.account-deletion", raw);
  expect(loadDeletionReturn()).toBeNull();
});
