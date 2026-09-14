import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import inventory from "../../../../messages/en-US/inventory.json";
import { fixtureRequest } from "../../../../tests/support/fixtures";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import {
  ControlledWorker,
  purchaseReply,
} from "../../../../tests/support/gear-lab-worker";
import { createGearLabStore } from "./gear-lab-store";
import { createAnalysisSession } from "./useGearLabAnalysis";
import { createDraftPersistence } from "./gear-lab-persistence";
import { useGearLabAdmission } from "./useGearLabAdmission";
import {
  draftKey,
  saveDraft,
  clearDraft,
  clearMatchingDraft,
} from "@/features/import/draft-store";

const { auth, push } = vi.hoisted(() => ({
  auth: { status: "authenticated", refresh: vi.fn() },
  push: vi.fn(),
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAccount: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const wrapper = ({ children }: PropsWithChildren) => (
  <NextIntlClientProvider locale="en-US" messages={{ inventory }}>
    {children}
  </NextIntlClientProvider>
);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  auth.status = "authenticated";
  push.mockReset();
  vi.stubGlobal("Worker", ControlledWorker);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  ControlledWorker.instances = [];
});
function setup(request = purchaseFixture({ frost: 100 })) {
  const store = createGearLabStore(request);
  const session = createAnalysisSession(store);
  session.start();
  session.setPolicy(purchasePolicy);
  const persistence = createDraftPersistence(store, {
    save: saveDraft,
    clear: clearDraft,
    clearMatching: clearMatchingDraft,
    onError: () => {},
  });
  const hook = renderHook(
    () =>
      useGearLabAdmission({
        store,
        getAnalysis: () => session.getSnapshot().controller,
        persistence,
        policy: purchasePolicy,
        readNonPurchase: session.readNonPurchase,
        onStorageError: () => {},
      }),
    { wrapper },
  );
  const posts: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      posts.push(init);
      return {
        ok: true,
        json: async () => ({ reportUrl: "/reports/current" }),
      };
    }),
  );
  return {
    ...hook,
    store,
    session,
    persistence,
    posts,
    close() {
      hook.unmount();
      persistence.dispose();
      session.stop();
    },
  };
}
it("rejects a stale completed purchase snapshot at click time before any network or durable attempt", async () => {
  const test = setup();
  const worker = ControlledWorker.instances.at(-1)!;
  act(() => worker.emit(purchaseReply(worker.message)));
  const controller = test.session.getSnapshot().controller;
  const ready = controller.getSnapshot();
  expect(ready.state.status).toBe("ready");
  vi.spyOn(controller, "getSnapshot").mockReturnValue({
    ...ready,
    revision: ready.revision + 1,
  });
  await act(async () => test.result.current.run());
  expect(test.posts).toHaveLength(0);
  expect(sessionStorage.getItem("munigan.top-gear.admission")).toBeNull();
  expect(test.result.current.error?.message).toBe(
    inventory.purchases.calculating,
  );
  test.close();
});
it("reads the replacement controller after auth awaits across session replay", async () => {
  auth.status = "unavailable";
  let recover!: (value: unknown) => void;
  auth.refresh.mockReturnValue(
    new Promise((resolve) => {
      recover = resolve;
    }),
  );
  const test = setup();
  let worker = ControlledWorker.instances.at(-1)!;
  act(() => worker.emit(purchaseReply(worker.message)));
  let run!: Promise<void>;
  act(() => {
    run = test.result.current.run();
  });
  act(() => {
    test.session.stop();
    test.session.start();
  });
  worker = ControlledWorker.instances.at(-1)!;
  act(() => worker.emit(purchaseReply(worker.message)));
  await act(async () => {
    recover({ status: "anonymous" });
    await run;
  });
  expect(test.posts).toHaveLength(1);
  expect(push).toHaveBeenCalledWith("/reports/current");
  test.close();
});
it("does not admit a newly edited purchase draft while refreshed auth awaits fresh analysis", async () => {
  auth.status = "unavailable";
  let recover!: (value: unknown) => void;
  auth.refresh.mockReturnValue(
    new Promise((resolve) => {
      recover = resolve;
    }),
  );
  const test = setup();
  const worker = ControlledWorker.instances.at(-1)!;
  act(() => worker.emit(purchaseReply(worker.message)));
  let run!: Promise<void>;
  act(() => {
    run = test.result.current.run();
  });
  act(() => test.store.getState().actions.setResourceQuantity("frost", 120));
  await act(async () => {
    recover({ status: "anonymous" });
    await run;
  });
  expect(test.posts).toHaveLength(0);
  expect(test.result.current.pending).toBe(false);
  test.close();
});
it("blocks a disallowed nonpurchase draft even when run is invoked imperatively", async () => {
  const test = setup(fixtureRequest());
  act(() => test.session.setPolicy({ ...purchasePolicy, maxUnits: 0 }));
  await act(async () => test.result.current.run());
  expect(test.posts).toHaveLength(0);
  test.close();
});
it("guards immediate duplicate calls and persists a newer store draft on older admission success", async () => {
  const test = setup(fixtureRequest());
  let respond!: (value: unknown) => void;
  const fetch = vi.fn().mockReturnValue(
    new Promise((resolve) => {
      respond = resolve;
    }),
  );
  vi.stubGlobal("fetch", fetch);
  let run!: Promise<void>;
  act(() => {
    run = test.result.current.run();
    void test.result.current.run();
  });
  act(() => test.store.getState().actions.setResourceQuantity("frost", 80));
  await act(async () => {
    respond({ ok: true, json: async () => ({ reportUrl: "/reports/older" }) });
    await run;
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(localStorage.getItem(draftKey)!).purchases.balances.frost,
  ).toBe(80);
  expect(push).toHaveBeenCalledWith("/reports/older");
  test.close();
});

it("preserves the no-valid-enhancement-sets guard even with an allowed cached estimate", async () => {
  const test = setup(fixtureRequest());
  const current = test.session.readNonPurchase()!;
  vi.spyOn(test.session, "readNonPurchase").mockReturnValue({
    ...current,
    enhancementAnalysis: {
      validCount: 0,
      excludedCount: 1,
      complete: true,
      referenceIncluded: false,
      conflicts: [],
    },
  });
  test.rerender();
  await act(async () => test.result.current.run());
  expect(test.posts).toHaveLength(0);
  expect(test.result.current.error?.message).toBe(inventory.editor.noValidSets);
  test.close();
});

it("does not post or navigate before the current draft has been durably saved", async () => {
  const test = setup(fixtureRequest());
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  await act(async () => test.result.current.run());
  expect(test.posts).toHaveLength(0);
  expect(push).not.toHaveBeenCalled();
  expect(test.result.current.pending).toBe(false);
  expect(test.result.current.error?.message).toBe("Storage unavailable");
  set.mockRestore();
  test.close();
});
