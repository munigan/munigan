vi.mock("@/features/pro-launch/ProLaunchProvider", () => ({
  useProLaunch: () => ({ open: vi.fn() }),
  proBeforeSignInEvent: "munigan.pro.before-sign-in",
}));
import { proBeforeSignInEvent } from "@/features/pro-launch/ProLaunchProvider";
import { beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { fixtureRequest } from "../../../tests/support/fixtures";
import authMessages from "../../../messages/en-US/auth.json";
import importMessages from "../../../messages/en-US/import.json";
import inventory from "../../../messages/en-US/inventory.json";
import common from "../../../messages/en-US/common.json";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../tests/support/purchase-fixtures";
import type { PurchaseAnalysisState } from "./purchases/purchase-worker-contract";
import { useGearLabSelector } from "./state/GearLabProvider";
import diagnostics from "../../../messages/en-US/diagnostics.json";

import { TopGearApp } from "./TopGearApp";
import { draftKey, saveDraft } from "../import/draft-store";
import { topGearStartEvent } from "@/features/shell/top-gear-navigation";
const { auth, push, purchaseState, controls } = vi.hoisted(() => ({
  controls: { real: false },
  purchaseState: { current: { status: "loading" } as PurchaseAnalysisState },
  auth: {
    refresh: vi.fn(),
    status: "authenticated",
    account: { id: "a" },
    savingEnabled: true,
  },
  push: vi.fn(),
}));
vi.mock("./state/GearLabRuntime", async (original) => {
  const actual = await original<typeof import("./state/GearLabRuntime")>();
  return {
    ...actual,
    useAnalysisView: () => {
      const value = actual.useAnalysisView();
      const purchases = useGearLabSelector((s) => s.draft?.purchases);
      return {
        ...value,
        view: {
          ...value.view,
          state: purchases ? purchaseState.current : value.view.state,
        },
      };
    },
  };
});
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
  InventorySelector: ({ ref }: { ref?: React.Ref<HTMLElement> }) => {
    const count = useGearLabSelector(
      (s) => s.draft?.selection.selectedInstanceIds.length,
    );
    const actions = useGearLabSelector((s) => s.actions);
    const lastId = useGearLabSelector((s) =>
      s.draft?.selection.selectedInstanceIds.at(-1),
    );
    return (
      <section ref={ref} tabIndex={-1} aria-label="Equipment selection">
        <span data-testid="selection-count">{count}</span>
        <button onClick={() => actions.setResourceQuantity("frost", 80)}>
          Edit wallet draft
        </button>
        <button
          onClick={() => {
            if (lastId) actions.toggleItem(lastId);
          }}
        >
          Reduce selection
        </button>
      </section>
    );
  },
}));
vi.mock("./RunSetup", async (original) => {
  const actual = await original<typeof import("./RunSetup")>();
  return {
    RunSetup: (props: Parameters<typeof actual.RunSetup>[0]) =>
      controls.real ? (
        <actual.RunSetup {...props} />
      ) : (
        <>
          <button onClick={props.onRun} disabled={props.pending}>
            Run fixture
          </button>
          <button onClick={props.onReduceSelection}>
            Sidebar reduce selection
          </button>
          {props.feedback}
        </>
      ),
  };
});
vi.mock("../auth/SignInDialog", () => ({ SignInDialog: () => null }));
function view() {
  return render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{
        auth: authMessages,
        import: importMessages,
        diagnostics,
        inventory,
        common,
      }}
    >
      <TopGearApp />
    </NextIntlClientProvider>,
  );
}
beforeEach(() => {
  auth.status = "authenticated";
  auth.refresh.mockReset();
  controls.real = false;
  sessionStorage.clear();
  localStorage.clear();
  push.mockReset();
  purchaseState.current = { status: "loading" };
  vi.unstubAllGlobals();
});
it("offers an explicit anonymous run after a known account rejection, with a new key", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
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
  await waitFor(() => expect(localStorage.getItem(draftKey)).not.toBeNull());
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
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
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
  await waitFor(() => expect(localStorage.getItem(draftKey)).not.toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(calls[0]).toEqual(calls[1]);
  expect(localStorage.getItem(draftKey)).toBeNull();
});

it("restores the sign-in draft through Strict Mode effect replay", async () => {
  const { saveDraft } = await import("../import/draft-store");
  saveDraft(fixtureRequest());
  sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ json: async () => ({ policy: purchasePolicy }) }),
  );
  const { StrictMode } = await import("react");
  render(
    <StrictMode>
      <NextIntlClientProvider
        locale="en-US"
        messages={{
          auth: authMessages,
          import: importMessages,
          diagnostics,
          inventory,
          common,
        }}
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
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
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
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
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
        ? { json: async () => ({ policy: purchasePolicy }) }
        : { ok: true, json: async () => ({ reportUrl: "/reports/finished" }) },
    ),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  await waitFor(() => expect(localStorage.getItem(draftKey)).not.toBeNull());
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
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
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

it("recovers the immutable uncertain payload while a newer wallet draft is still awaiting analysis", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
      calls.push(init);
      if (calls.length === 1) throw new Error("lost response");
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/recovered" }),
      };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Edit wallet draft" }),
  );
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem(draftKey)!).purchases?.balances.frost,
    ).toBe(80),
  );
  const newerDraft = localStorage.getItem(draftKey);
  await userEvent.click(
    screen.getByRole("button", { name: authMessages.retryReturn }),
  );
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/recovered"));
  expect(calls[1].body).toBe(calls[0].body);
  expect(calls[1].headers).toEqual(calls[0].headers);
  expect(localStorage.getItem(draftKey)).toBe(newerDraft);
});
it("guards new purchase submission even when a caller bypasses the disabled button", async () => {
  saveDraft(purchaseFixture({ frost: 100 }));
  sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
  const post = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
      post();
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/invalid" }),
      };
    }),
  );
  view();
  await userEvent.click(
    await screen.findByRole("button", { name: "Run fixture" }),
  );
  expect(post).not.toHaveBeenCalled();
});
it("repairs a profession-invalid override without preview and preserves unrelated profiles", async () => {
  const request = purchaseFixture({ frost: 100 });
  request.purchases!.itemEnhancements = {
    original: { "50098": { gemIds: [42142] }, "51125": { enchantId: 0 } },
    classic: { "50098": { enchantId: 0 } },
  };
  saveDraft(request);
  sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
  purchaseState.current = {
    status: "error",
    diagnostic: {
      code: "purchaseEnhancementInvalid",
      path: "purchases.itemEnhancements",
      severity: "error",
      message: "Profession required",
      params: { itemId: 50098, profile: "original" },
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => ({ policy: purchasePolicy }) })),
  );
  view();
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Reset enhancements for item #50098",
    }),
  );
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem(draftKey)!).purchases.itemEnhancements
        .original["50098"],
    ).toBeUndefined(),
  );
  const saved = JSON.parse(localStorage.getItem(draftKey)!);
  expect(saved.purchases.itemEnhancements.original["50098"]).toBeUndefined();
  expect(saved.purchases.itemEnhancements.original["51125"]).toEqual({
    enchantId: 0,
  });
  expect(saved.purchases.itemEnhancements.classic["50098"]).toEqual({
    enchantId: 0,
  });
});

it("recovers a persisted attempt even when the newer draft cannot be decoded", async () => {
  const { createAttempt } = await import("./admission-attempt");
  const { encodeRequest } = await import("@/domain/top-gear/request-schema");
  const attempt = createAttempt(encodeRequest(fixtureRequest()), "anonymous");
  attempt.status = "uncertain";
  sessionStorage.setItem("munigan.top-gear.admission", JSON.stringify(attempt));
  localStorage.setItem(draftKey, '{"broken":"new draft"}');
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
      calls.push(init);
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/recovered" }),
      };
    }),
  );
  view();
  const retry = await screen.findByRole("button", {
    name: authMessages.retryReturn,
  });
  expect(retry).toBeEnabled();
  await userEvent.click(retry);
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/recovered"));
  expect(calls[0].body).toBe(attempt.body);
  expect(localStorage.getItem(draftKey)).toBe('{"broken":"new draft"}');
});

it("persists the local precision selection and submits its actual 6000 iteration request", async () => {
  controls.real = true;
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config"))
        return {
          json: async () => ({
            policy: {
              version: "unlimited-local-v1",
              unitsPerSet: 5000,
              maxUnits: null,
              maxSearchNodes: null,
              maxJobSeconds: null,
              maxAttempts: 2,
              iterationsPerSet: 500,
              selectableIterations: { min: 500, max: 6000, step: 500 },
            },
          }),
        };
      calls.push(init);
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/selected-iterations" }),
      };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  const select = await screen.findByRole("combobox", {
    name: "Iterations per set",
  });
  await userEvent.click(select);
  await userEvent.click((await screen.findAllByRole("option"))[11]);
  expect(select).toHaveTextContent("6,000");
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(draftKey)!).iterations).toBe(6000),
  );
  await userEvent.click(screen.getByRole("button", { name: /Run Gear Lab/ }));
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith("/reports/selected-iterations"),
  );
  expect(JSON.parse(calls[0].body as string).iterations).toBe(6000);
});

it("refreshes an unavailable session and submits a 4000-iteration local run using the recovered anonymous identity", async () => {
  auth.status = "unavailable";
  auth.refresh.mockResolvedValue({
    status: "anonymous",
    account: null,
    savingEnabled: false,
    enrollmentEnabled: false,
  });
  const request = { ...fixtureRequest(), iterations: 4000 };
  saveDraft(request);
  sessionStorage.setItem("munigan.top-gear.signin-restore", "1");
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
      calls.push(init);
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/recovered-local" }),
      };
    }),
  );
  view();
  await userEvent.click(
    await screen.findByRole("button", { name: "Run fixture" }),
  );
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith("/reports/recovered-local"),
  );
  expect(auth.refresh).toHaveBeenCalledTimes(1);
  expect(JSON.parse(calls[0].body as string)).toMatchObject({
    iterations: 4000,
    authMode: "anonymous",
  });
});

it("recovers an immutable persisted attempt despite a restored retired purchase catalog", async () => {
  const { createAttempt } = await import("./admission-attempt");
  const { encodeRequest } = await import("@/domain/top-gear/request-schema");
  const attempt = createAttempt(encodeRequest(fixtureRequest()), "anonymous");
  attempt.status = "uncertain";
  sessionStorage.setItem("munigan.top-gear.admission", JSON.stringify(attempt));
  const newer = purchaseFixture({ frost: 80 });
  newer.purchases!.recipeRevision = "retired";
  saveDraft(newer);
  const posted: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config"))
        return { json: async () => ({ policy: purchasePolicy }) };
      posted.push(init);
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/recovered" }),
      };
    }),
  );
  view();
  await screen.findByRole("button", { name: "Run fixture" });
  await userEvent.click(
    await screen.findByRole("button", { name: authMessages.retryReturn }),
  );
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/recovered"));
  expect(posted[0].body).toBe(attempt.body);
  expect(
    JSON.parse(localStorage.getItem(draftKey)!).purchases.recipeRevision,
  ).toBe("retired");
});

it("reads precision edited while account refresh awaits and blocks duplicate clicks", async () => {
  controls.real = true;
  auth.status = "unavailable";
  let recover!: (value: unknown) => void;
  auth.refresh.mockReturnValue(
    new Promise((resolve) => {
      recover = resolve;
    }),
  );
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("config"))
        return {
          json: async () => ({
            policy: {
              ...purchasePolicy,
              iterationsPerSet: 500,
              selectableIterations: { min: 500, max: 6000, step: 500 },
            },
          }),
        };
      calls.push(init);
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/current" }),
      };
    }),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  const run = await screen.findByRole("button", { name: /Run Gear Lab/ });
  await waitFor(() => expect(run).toBeEnabled());
  fireEvent.click(run);
  fireEvent.click(run);
  await userEvent.click(
    screen.getByRole("combobox", { name: "Iterations per set" }),
  );
  await userEvent.click((await screen.findAllByRole("option"))[11]);
  await act(async () => recover({ status: "anonymous" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/current"));
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body as string)).toMatchObject({
    iterations: 6000,
    authMode: "anonymous",
  });
});

it.each(["pagehide", "visibilitychange"])(
  "flushes pending edits on %s",
  async (eventName) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => ({ policy: purchasePolicy }) })),
    );
    view();
    await userEvent.click(
      screen.getByRole("button", { name: "Import fixture" }),
    );
    await waitFor(() => expect(localStorage.getItem(draftKey)).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Reduce selection" }));
    act(() => {
      (eventName === "pagehide" ? window : document).dispatchEvent(
        new Event(eventName),
      );
    });
    expect(
      JSON.parse(localStorage.getItem(draftKey)!).selection.selectedInstanceIds,
    ).toHaveLength(fixtureRequest().selection.selectedInstanceIds.length - 1);
  },
);

it("navigates after successful admission even when draft cleanup fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("config")
        ? { json: async () => ({ policy: purchasePolicy }) }
        : {
            ok: true,
            json: async () => ({ reportUrl: "/reports/storage-error" }),
          },
    ),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  const original = Storage.prototype.removeItem;
  const remove = vi.spyOn(Storage.prototype, "removeItem");
  remove.mockImplementation(function (this: Storage, key: string) {
    if (key === draftKey) throw new Error("Storage blocked");
    return original.call(this, key);
  });
  try {
    await userEvent.click(screen.getByRole("button", { name: "Run fixture" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/reports/storage-error"),
    );
  } finally {
    remove.mockRestore();
  }
});

it("does not repeat full request validation for ordinary selection or wallet edits", async () => {
  const schema = await import("@/domain/top-gear/request-schema");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => ({ policy: purchasePolicy }) })),
  );
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  const validate = vi.spyOn(schema, "validateRequest");
  try {
    fireEvent.click(screen.getByRole("button", { name: "Reduce selection" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit wallet draft" }));
    expect(validate).not.toHaveBeenCalled();
  } finally {
    validate.mockRestore();
  }
});

it("preserves the current request before PRO sign-in without changing admission", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  const event = new Event(proBeforeSignInEvent, { cancelable: true });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  expect(sessionStorage.getItem("munigan.top-gear.signin-restore")).toBe("1");
});

it("focuses the equipment selection without changing selected IDs", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
  const scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  const before = screen.getByTestId("selection-count").textContent;
  await userEvent.click(
    screen.getByRole("button", { name: "Sidebar reduce selection" }),
  );
  expect(
    screen.getByRole("region", { name: "Equipment selection" }),
  ).toHaveFocus();
  expect(screen.getByTestId("selection-count")).toHaveTextContent(before!);
  expect(scrollIntoView).toHaveBeenCalledWith({
    block: "start",
    behavior: "auto",
  });
});

it("cancels PRO sign-in when preserving the draft fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
  view();
  await userEvent.click(screen.getByRole("button", { name: "Import fixture" }));
  const setItem = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("storage unavailable");
    });
  const event = new Event(proBeforeSignInEvent, { cancelable: true });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  setItem.mockRestore();
});
