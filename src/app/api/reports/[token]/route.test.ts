import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readReport } from "@/server/reports/read";
import type { SetRow } from "@/domain/top-gear/model";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../../tests/support/purchase-fixtures";
import { GET } from "./route";

vi.mock("@/server/reports/read", () => ({ readReport: vi.fn() }));
vi.mock("@/server/auth/identity", () => ({
  getIdentity: async () => ({ account: null, ownerHash: null }),
}));

const request = purchaseFixture();
const rows: SetRow[] = Array.from({ length: 100041 }, (_, index) => ({
  id: String(index),
  loadout: request.snapshot.equipped,
  dps: 1000,
  gain: 0,
  percent: 0,
  swaps: 0,
  eligible: true,
  isEquipped: index === 0,
  tiedToHighest: false,
  iterations: 500,
  inputHash: String(index),
}));
const data: Awaited<ReturnType<typeof readReport>> = {
  jobId: "local-report",
  error: null,
  canManage: false,
  access: {
    saved: false,
    canManage: false,
    canSave: false,
    canDelete: false,
    effectiveExpiresAt: "2030-01-01T00:00:00Z",
    anonymousExpiresAt: "2030-01-01T00:00:00Z",
  },
  report: {
    token: "local-report",
    snapshot: request.snapshot,
    selection: request.selection,
    policy: {
      ...purchasePolicy,
      maxUnits: null,
      maxSearchNodes: null,
      maxJobSeconds: null,
    },
    status: "complete",
    phase: "complete",
    rows,
    equippedId: "0",
    highestId: "100040",
    recommendedId: null,
    coverage: {
      planned: 100041,
      succeeded: 100041,
      failed: 0,
      returned: 100041,
      exhaustive: true,
    },
    termination: "complete",
    expiresAt: "2030-01-01T00:00:00Z",
  },
};
beforeEach(() => vi.mocked(readReport).mockResolvedValue(data));
async function page(cursor: string) {
  const response = await GET(
    new NextRequest(
      `http://localhost/api/reports/local-report?cursor=${encodeURIComponent(cursor)}`,
    ),
    { params: Promise.resolve({ token: "local-report" }) },
  );
  expect(response.status).toBe(200);
  return response.json();
}

it("pages uncapped reports past 100,000 and reaches the final slice without repeating a cursor", async () => {
  const middle = await page("100020");
  expect(middle.report.rows).toHaveLength(20);
  expect(middle.report.rows[0].id).toBe("100020");
  expect(middle.report.rows[19].id).toBe("100039");
  expect(middle.nextCursor).toBe(100040);
  const last = await page(String(middle.nextCursor));
  expect(last.report.rows.map((row: SetRow) => row.id)).toEqual(["100040"]);
  expect(last.nextCursor).toBeNull();
  expect(last.pinnedRows.map((row: SetRow) => row.id)).toEqual(["0", "100040"]);
  const afterEnd = await page("100041");
  expect(afterEnd.report.rows).toHaveLength(0);
  expect(afterEnd.nextCursor).toBeNull();
});

it.each(["nonsense", "-1", "20.5", "Infinity", "9007199254740992"])(
  "normalizes malformed or unsafe cursor %s to the first finite integer page",
  async (cursor) => {
    const result = await page(cursor);
    expect(result.report.rows[0].id).toBe("0");
    expect(result.nextCursor).toBe(20);
  },
);

it("bounds a safe but oversized local cursor against the report length", async () => {
  const result = await page("9007199254740991");
  expect(result.report.rows).toHaveLength(0);
  expect(result.nextCursor).toBeNull();
});

it("preserves the existing cursor ceiling for capped policies", async () => {
  vi.mocked(readReport).mockResolvedValue({
    ...data,
    report: { ...data.report, policy: purchasePolicy },
  });
  const result = await page("100020");
  expect(result.report.rows[0].id).toBe("100000");
  expect(result.nextCursor).toBe(100020);
});
