import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { encodeSnapshot } from "@/domain/top-gear/request-schema";
import type { SetRow } from "@/domain/top-gear/model";
import authEn from "../../../messages/en-US/auth.json";
import authPt from "../../../messages/pt-BR/auth.json";
import { storeReturnState, loadReturnState } from "../auth/return-state";
vi.mock("../auth/AuthProvider", () => ({
  useAccount: () => ({
    status: "anonymous",
    account: null,
    savingEnabled: true,
  }),
}));
import en from "../../../messages/en-US/reports.json";
import pt from "../../../messages/pt-BR/reports.json";
import diagnosticsEn from "../../../messages/en-US/diagnostics.json";
import diagnosticsPt from "../../../messages/pt-BR/diagnostics.json";
import { ReportView } from "./ReportView";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/Toast", () => ({
  useToastManager: () => ({ add: vi.fn() }),
}));
vi.mock("./GearStrip", () => ({ GearStrip: () => <span>Gear fixture</span> }));
afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fixture() {
  const request = fixtureRequest();
  const row: SetRow = {
    id: "first",
    loadout: request.snapshot.equipped,
    dps: 10000.5,
    gain: 0,
    percent: 0,
    swaps: 0,
    eligible: true,
    isEquipped: true,
    tiedToHighest: true,
    iterations: 1000,
    inputHash: "stable",
  };
  return {
    jobId: "fixture",
    canManage: false,
    access: {
      saved: false,
      canManage: false,
      canSave: false,
      canDelete: false,
      effectiveExpiresAt: "2030-01-01T00:00:00Z",
      anonymousExpiresAt: "2030-01-01T00:00:00Z",
    },
    error: null,
    pinnedRows: [row],
    totalRows: 22,
    nextCursor: 20 as number | null,
    report: {
      snapshot: encodeSnapshot(request.snapshot),
      selection: request.selection,
      rows: [row],
      status: "complete",
      phase: "complete",
      highestId: row.id,
      recommendedId: null,
      equippedId: row.id,
      policy: { iterationsPerSet: 1000 },
      coverage: {
        planned: 22,
        succeeded: 22,
        failed: 0,
        returned: 22,
        exhaustive: true,
      },
      termination: "complete",
      expiresAt: "2030-01-01T00:00:00Z",
    },
  };
}
function view(locale: "en-US" | "pt-BR") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{
        auth: locale === "en-US" ? authEn : authPt,
        reports: locale === "en-US" ? en : pt,
        diagnostics: locale === "en-US" ? diagnosticsEn : diagnosticsPt,
      }}
    >
      <ReportView token="stable-report" />
    </NextIntlClientProvider>
  );
}
it("retains report page and selected combination without refetching when the locale switches", async () => {
  const first = fixture();
  const second = {
    ...first,
    nextCursor: null,
    report: {
      ...first.report,
      rows: [21, 22].map((id) => ({
        ...first.report.rows[0],
        id: `set-${id}`,
        isEquipped: false,
        dps: 10000 + id,
      })),
    },
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => first })
    .mockResolvedValueOnce({ ok: true, json: async () => second });
  vi.stubGlobal("fetch", fetch);
  const { rerender, container } = render(view("en-US"));
  await screen.findByRole("button", { name: "Next" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const selected = await screen.findByRole("button", {
    name: "View set 22, 10,022 DPS",
  });
  fireEvent.click(selected);
  expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("21–22 of 22")).toBeInTheDocument();
  const selectedHtml = container.querySelector(".combination-row.selected");
  rerender(view("pt-BR"));
  expect(screen.getByText("21–22 de 22")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Ver conjunto 22, 10.022 DPS" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector(".combination-row.selected")).toBe(
    selectedHtml,
  );
  await waitFor(() =>
    expect(document.title).toBe("RELATÓRIO DO TOP GEAR · munigan.app"),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "/api/reports/stable-report?cursor=0",
    "/api/reports/stable-report?cursor=20",
  ]);
});
it("keeps historical error details readable under a translated report error heading", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({ error: "Historical engine message" }),
    }),
  );
  render(view("pt-BR"));
  expect(
    await screen.findByRole("heading", {
      name: "Não foi possível carregar este relatório",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Historical engine message/)).toBeInTheDocument();
});

it("restores the preserved page first, selected row and scroll once, then consumes the flow", async () => {
  const key = "b".repeat(43),
    path = "/reports/stable-report";
  storeReturnState(key, {
    version: 1,
    reportPath: path,
    locale: "en-US",
    cursor: 20,
    selectedId: "restored",
    difference: "highest",
    scrollY: 320,
  });
  sessionStorage.setItem(`munigan.auth.restore.${path}`, key);
  const payload = fixture();
  payload.report.rows = [
    {
      ...payload.report.rows[0],
      id: "restored",
      dps: 12000,
      isEquipped: false,
    },
  ];
  payload.nextCursor = null;
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => payload });
  vi.stubGlobal("fetch", fetch);
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(view("en-US"));
  expect(
    await screen.findByRole("button", { name: /View set.*12,000 DPS/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(fetch.mock.calls[0][0]).toBe("/api/reports/stable-report?cursor=20");
  await waitFor(() =>
    expect(scroll).toHaveBeenCalledWith({ top: 320, behavior: "instant" }),
  );
  expect(loadReturnState(key)).toBeNull();
  expect(scroll).toHaveBeenCalledTimes(1);
});
it("uses effective retained expiry even when the frozen report expired yesterday", async () => {
  const payload = fixture();
  payload.report.expiresAt = "2000-01-01T00:00:00Z";
  payload.access = {
    ...payload.access,
    saved: true,
    effectiveExpiresAt: null as unknown as string,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
  );
  render(view("en-US"));
  expect(await screen.findByText("Saved to My Library")).toBeInTheDocument();
  expect(screen.getByText(/No automatic expiry/)).toBeInTheDocument();
  expect(screen.queryByText(/2000/)).not.toBeInTheDocument();
});
