import { afterEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { fixtureRequest } from "../../../tests/support/fixtures";
import {
  decodeSnapshot,
  encodeSnapshot,
} from "@/domain/top-gear/request-schema";
import type { SetRow } from "@/domain/top-gear/model";
import commonEn from "../../../messages/en-US/common.json";
import commonPt from "../../../messages/pt-BR/common.json";
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
import inventoryEn from "../../../messages/en-US/inventory.json";
import inventoryPt from "../../../messages/pt-BR/inventory.json";
import { loadDraft } from "../import/draft-store";
import { Stat } from "@/generated/wotlk/common";
import { ReportView } from "./ReportView";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/ui/Toast", () => ({
  useToastManager: () => ({ add: vi.fn() }),
}));
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  push.mockReset();
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
        common: locale === "en-US" ? commonEn : commonPt,
        auth: locale === "en-US" ? authEn : authPt,
        reports: locale === "en-US" ? en : pt,
        diagnostics: locale === "en-US" ? diagnosticsEn : diagnosticsPt,
        inventory: locale === "en-US" ? inventoryEn : inventoryPt,
      }}
    >
      <ReportView token="stable-report" />
    </NextIntlClientProvider>
  );
}

function stats(strength: number) {
  return Array.from({ length: 40 }, (_, index) =>
    index === Stat.StatStrength ? strength : 0,
  );
}

function purchasePages() {
  const first = fixture();
  const originalSnapshot = decodeSnapshot(first.report.snapshot);
  const snapshot = structuredClone(originalSnapshot);
  snapshot.inventory.push(
    {
      instanceId: "purchase-original-50098",
      itemId: 50098,
      source: "purchase",
      gemIds: [],
      enchantId: 0,
    },
    {
      instanceId: "purchase-original-48493",
      itemId: 48493,
      source: "purchase",
      gemIds: [],
      enchantId: 0,
    },
  );
  const baseline: SetRow = {
    ...first.report.rows[0],
    id: "baseline",
    stats: stats(1000),
    purchasePlan: {
      steps: [],
      spent: {},
      remaining: { frost: 100, "regalia:vanquisher": 1 },
      consumedInstanceIds: [],
    },
  };
  const sixty: SetRow = {
    ...baseline,
    id: "spend-60",
    stats: stats(2060),
    isEquipped: false,
    dps: 10060,
    gain: 59.5,
    percent: 0.595,
    loadout: {
      ...baseline.loadout,
      shoulder: "purchase-original-50098",
    },
    purchasePlan: {
      steps: [
        {
          recipeId: "shoulder-251",
          itemId: 50098,
          resultId: "purchase-original-50098",
          cost: { frost: 60 },
        },
      ],
      spent: { frost: 60 },
      remaining: { frost: 40 },
      consumedInstanceIds: [],
    },
  };
  const regalia: SetRow = {
    ...baseline,
    id: "spend-regalia",
    stats: stats(3095),
    isEquipped: false,
    dps: 10095,
    gain: 94.5,
    percent: 0.945,
    loadout: {
      ...baseline.loadout,
      head: "purchase-original-48493",
    },
    purchasePlan: {
      steps: [
        {
          recipeId: "head-258",
          itemId: 48493,
          resultId: "purchase-original-48493",
          cost: { "regalia:vanquisher": 1 },
        },
      ],
      spent: { "regalia:vanquisher": 1 },
      remaining: { frost: 100, "regalia:vanquisher": 0 },
      consumedInstanceIds: [],
    },
  };
  const purchases = {
    inputs: {
      version: 1 as const,
      recipeRevision: "frozen-revision",
      balances: { frost: 100, "regalia:vanquisher": 1 },
      excludedItemIds: {},
      itemEnhancements: {},
    },
    recipeRevision: "frozen-revision",
    recipes: [
      {
        id: "shoulder-251",
        itemId: 50098,
        tier: 10 as const,
        itemLevel: 251 as const,
        setVariant: "dk-dps",
        slot: "shoulder" as const,
        classId: 1,
        faction: "both" as const,
        profiles: ["original" as const, "classic" as const],
        cost: { frost: 60 },
        sourceUrls: [],
      },
      {
        id: "head-258",
        itemId: 48493,
        tier: 9 as const,
        itemLevel: 258 as const,
        setVariant: "dk-dps",
        slot: "head" as const,
        classId: 1,
        faction: "both" as const,
        profiles: ["original" as const, "classic" as const],
        cost: { "regalia:vanquisher": 1 },
        sourceUrls: [],
      },
    ],
    originalSnapshot: encodeSnapshot(originalSnapshot),
  };
  return {
    first: {
      ...first,
      pinnedRows: [sixty],
      nextCursor: 20,
      report: {
        ...first.report,
        snapshot: encodeSnapshot(snapshot),
        rows: [baseline, sixty],
        equippedId: baseline.id,
        highestId: sixty.id,
        recommendedId: sixty.id,
        purchases,
      },
    },
    second: {
      ...first,
      pinnedRows: [sixty],
      nextCursor: null,
      report: {
        ...first.report,
        snapshot: encodeSnapshot(snapshot),
        rows: [regalia],
        equippedId: baseline.id,
        highestId: sixty.id,
        recommendedId: sixty.id,
        purchases,
      },
    },
    originalSnapshot,
    sixty,
  };
}

it("updates the frozen purchase plan across selected, paginated, pinned, and localized rows", async () => {
  const pages = purchasePages();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => pages.first })
    .mockResolvedValueOnce({ ok: true, json: async () => pages.second });
  vi.stubGlobal("fetch", fetch);
  const { rerender, container } = render(view("en-US"));

  await screen.findByText("Your purchase plan");
  expect(
    screen.getByRole("row", { name: /Emblems of Frost.*60.*40/ }),
  ).toBeInTheDocument();
  expect(
    screen
      .getByLabelText("Complete 17-slot gear set")
      .querySelectorAll(".gear-slot"),
  ).toHaveLength(17);
  expect(
    screen.getByRole("button", { name: "Stats details" }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^View equipped gear/ }));
  expect(screen.getByText("No purchases needed")).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: /Emblems of Frost.*0.*100/ }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "View set 2, 10,060 DPS" }),
  );
  expect(
    screen.getByRole("row", { name: /Emblems of Frost.*60.*40/ }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("button", { name: "View set 21, 10,095 DPS" });
  expect(
    screen.getByRole("row", { name: /Emblems of Frost.*60.*40/ }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "View set 21, 10,095 DPS" }),
  );
  expect(
    screen.getByRole("row", { name: /Regalia.*Vanquisher.*1.*0/ }),
  ).toBeInTheDocument();

  rerender(view("pt-BR"));
  expect(
    screen.getByRole("row", { name: /Insígnia.*Aniquilador.*1.*0/ }),
  ).toBeInTheDocument();
  expect(container.querySelector(".combination-row.selected")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Detalhes dos atributos" }),
  );
  expect(
    screen.getByRole("heading", { name: "Atributos do personagem" }),
  ).toBeInTheDocument();
  const primaryStats = screen.getByRole("table", {
    name: "Atributos principais",
  });
  const strength = within(primaryStats).getByRole("rowheader", {
    name: "Força",
  });
  expect(
    within(strength.closest("tr")!).getByText("3.095"),
  ).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("restores the encoded original snapshot and frozen purchase inputs when editing", async () => {
  const pages = purchasePages();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => pages.first }),
  );
  render(view("en-US"));
  await screen.findByText("Your purchase plan");

  fireEvent.click(screen.getByRole("button", { name: "Edit & run again" }));

  const draft = loadDraft();
  expect(draft?.snapshot).toEqual(pages.originalSnapshot);
  expect(
    draft?.snapshot.inventory.some((item) => item.source === "purchase"),
  ).toBe(false);
  expect(draft?.purchases).toEqual(pages.first.report.purchases.inputs);
  expect(draft?.selection).toEqual(pages.first.report.selection);
  expect(push).toHaveBeenCalledWith("/gear-lab?restore=1");
});

it("keeps complete gear and report controls without a panel for legacy reports", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => fixture() }),
  );
  render(view("en-US"));
  const gear = await screen.findByLabelText("Complete 17-slot gear set");
  expect(gear.querySelectorAll(".gear-slot")).toHaveLength(17);
  expect(
    screen.getByRole("button", { name: "Stats details" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Your purchase plan")).not.toBeInTheDocument();
});
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
    expect(document.title).toBe("RELATÓRIO DO GEAR LAB · munigan.app"),
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
  expect(
    await screen.findByText("Shared report · read only"),
  ).toBeInTheDocument();
  expect(screen.getByText(/No automatic expiry/)).toBeInTheDocument();
  expect(screen.queryByText(/2000/)).not.toBeInTheDocument();
});
