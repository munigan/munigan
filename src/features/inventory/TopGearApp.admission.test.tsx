import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { fixtureRequest } from "../../../tests/support/fixtures";
import authMessages from "../../../messages/en-US/auth.json";
import importMessages from "../../../messages/en-US/import.json";
import diagnostics from "../../../messages/en-US/diagnostics.json";
import type { TopGearRequest } from "@/domain/top-gear/model";
import { TopGearApp } from "./TopGearApp";
import { draftKey, saveDraft } from "../import/draft-store";
import { topGearStartEvent } from "@/features/shell/top-gear-navigation";
const { auth, push } = vi.hoisted(() => ({
  auth: { status: "authenticated", account: { id: "a" }, savingEnabled: true },
  push: vi.fn(),
}));
vi.mock("../auth/AuthProvider", () => ({ useAccount: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../import/ImportPanel", () => ({
  ImportPanel: ({ onResolved }: { onResolved: (s: unknown) => void }) => (
    <button onClick={() => onResolved(fixtureRequest().snapshot)}>
      Import fixture
    </button>
  ),
}));
vi.mock("./InventorySelector", () => ({
  InventorySelector: ({
    request,
    onChange,
  }: {
    request: TopGearRequest;
    onChange: (request: TopGearRequest) => void;
  }) => (
    <button
      onClick={() =>
        onChange({
          ...request,
          selection: {
            ...request.selection,
            selectedInstanceIds: request.selection.selectedInstanceIds.slice(
              0,
              -1,
            ),
          },
        })
      }
    >
      Reduce selection
    </button>
  ),
}));
vi.mock("./RunSetup", () => ({
  RunSetup: ({ onRun, pending }: { onRun: () => void; pending: boolean }) => (
    <button onClick={onRun} disabled={pending}>
      Run fixture
    </button>
  ),
}));
vi.mock("../auth/SignInDialog", () => ({ SignInDialog: () => null }));
function view() {
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ auth: authMessages, import: importMessages, diagnostics }}
    >
      <TopGearApp />
    </NextIntlClientProvider>,
  );
}
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  push.mockReset();
  vi.unstubAllGlobals();
});
it("offers an explicit anonymous run after a known account rejection, with a new key", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config")) return { json: async () => ({}) };
      calls.push(init);
      return calls.length === 1
        ? {
            ok: false,
            status: 401,
            json: async () => ({ code: "SIGN_IN_REQUIRED" }),
          }
        : { ok: true, json: async () => ({ reportUrl: "/reports/abc" }) };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  await userEvent.click(
    await screen.findByRole("button", { name: "Run without saving" }),
  );
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/abc"));
  expect(JSON.parse(calls[0].body as string).authMode).toBe("account");
  expect(JSON.parse(calls[1].body as string).authMode).toBe("anonymous");
  expect(calls[0].headers).not.toEqual(calls[1].headers);
});
it("disables mode switching through network uncertainty and retries the same body/key", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config")) return { json: async () => ({}) };
      calls.push(init);
      if (calls.length === 1) throw new Error("network");
      return { ok: true, json: async () => ({ reportUrl: "/reports/abc" }) };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  expect(
    await screen.findByRole("button", { name: "Run without saving" }),
  ).toBeDisabled();
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(calls[0]).toEqual(calls[1]);
  expect(localStorage.getItem(draftKey)).toBeNull();
});

it("restores the sign-in draft through Strict Mode effect replay", async () => {
  const { saveDraft } = await import("../import/draft-store");
  saveDraft(fixtureRequest());
  sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
  const { StrictMode } = await import("react");
  render(
    <StrictMode>
      <NextIntlClientProvider
        locale="en-US"
        messages={{ auth: authMessages, import: importMessages, diagnostics }}
      >
        <TopGearApp />
      </NextIntlClientProvider>
    </StrictMode>,
  );
  expect(
    await screen.findByRole("button", { name: "Run fixture" }),
  ).toBeInTheDocument();
});

it("submits a corrected smaller selection with a new key after a definitive first allowance rejection", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config")) return { json: async () => ({}) };
      calls.push(init);
      return calls.length === 1
        ? {
            ok: false,
            status: 422,
            json: async () => ({
              code: "allowance",
              error: "Reduce your item selections to fit the free allowance",
            }),
          }
        : { ok: true, json: async () => ({ reportUrl: "/reports/corrected" }) };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Reduce selection" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/corrected"));
  const first = JSON.parse(calls[0].body as string),
    corrected = JSON.parse(calls[1].body as string);
  expect(corrected.selection.selectedInstanceIds).toEqual(
    first.selection.selectedInstanceIds.slice(0, -1),
  );
  expect(corrected.authMode).toBe("account");
  expect(calls[1].headers).not.toEqual(calls[0].headers);
});
it("keeps the original attempt locked when allowance rejection follows network uncertainty", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config")) return { json: async () => ({}) };
      calls.push(init);
      if (calls.length === 1) throw new Error("network");
      return {
        ok: false,
        status: 422,
        json: async () => ({ code: "allowance" }),
      };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(
    screen.getByRole("button", { name: "Run without saving" }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole("button", { name: "Reduce selection" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  expect(calls).toHaveLength(3);
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[2]).toEqual(calls[0]);
  expect(push).not.toHaveBeenCalled();
});

it("removes the submitted draft when admission succeeds and the report opens", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("config")
        ? { json: async () => ({}) }
        : { ok: true, json: async () => ({ reportUrl: "/reports/finished" }) },
    ),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/finished"));
  expect(localStorage.getItem(draftKey)).toBeNull();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  act(() => {
    window.dispatchEvent(new Event(topGearStartEvent));
  });
  expect(localStorage.getItem(draftKey)).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Restore draft" }),
  ).not.toBeInTheDocument();
});

it("preserves a newer draft saved while an older run is being admitted", async () => {
  const newer = fixtureRequest();
  newer.snapshot.settings.player!.name = "New draft";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("config")) return { json: async () => ({}) };
      saveDraft(newer);
      return { ok: true, json: async () => ({ reportUrl: "/reports/older" }) };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/older"));
  expect(JSON.parse(localStorage.getItem(draftKey)!).snapshot.id).toBe(
    newer.snapshot.id,
  );
});
