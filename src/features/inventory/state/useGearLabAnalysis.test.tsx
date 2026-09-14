import { act, renderHook } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import {
  ControlledWorker,
  purchaseReply,
} from "../../../../tests/support/gear-lab-worker";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import * as enumerate from "@/domain/equipment/enumerate";
import * as schema from "@/domain/top-gear/request-schema";
import { createGearLabStore } from "./gear-lab-store";
import { GearLabProvider } from "./GearLabProvider";
import { useGearLabAnalysis } from "./useGearLabAnalysis";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  ControlledWorker.instances = [];
});
const precisionPolicy = {
  ...purchasePolicy,
  selectableIterations: { min: 500, max: 6000, step: 500 },
};
function setup(purchases = true, strict = false) {
  vi.stubGlobal("Worker", ControlledWorker);
  const request = purchaseFixture({ frost: 100 });
  if (!purchases) delete request.purchases;
  const store = createGearLabStore(request);
  const wrapper = ({ children }: PropsWithChildren) =>
    strict ? (
      <StrictMode>
        <GearLabProvider store={store}>{children}</GearLabProvider>
      </StrictMode>
    ) : (
      <GearLabProvider store={store}>{children}</GearLabProvider>
    );
  const hook = renderHook(({ policy }) => useGearLabAnalysis(policy), {
    wrapper,
    reactStrictMode: strict,
    initialProps: { policy: precisionPolicy },
  });
  return { store, ...hook };
}
it("subscribes to draft changes immediately and coalesces them outside React renders", () => {
  const { store, result, unmount } = setup();
  const worker = ControlledWorker.instances[0];
  const firstRevision = result.current.view.revision;
  act(() => {
    store.getState().actions.setResourceQuantity("frost", 120);
    expect(result.current.controller.getSnapshot().revision).toBe(
      firstRevision + 1,
    );
    store.getState().actions.setResourceQuantity("frost", 140);
  });
  expect(worker.messages).toHaveLength(1);
  act(() => worker.emit(purchaseReply(worker.message)));
  expect(worker.messages).toHaveLength(2);
  expect(worker.message.request.purchases!.balances.frost).toBe(140);
  unmount();
  store.getState().actions.setResourceQuantity("frost", 160);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(worker.messages).toHaveLength(2);
});
it("creates a usable fresh controller after Strict Mode cleanup and releases every worker", () => {
  const { result, store, unmount } = setup(true, true);
  expect(ControlledWorker.instances).toHaveLength(2);
  const [retired, live] = ControlledWorker.instances;
  expect(retired.terminate).toHaveBeenCalledTimes(1);
  act(() => live.emit(purchaseReply(live.message)));
  expect(result.current.view.state.status).toBe("ready");
  act(() => store.getState().actions.setPurchaseIncluded(50098, false));
  expect(live.messages).toHaveLength(2);
  unmount();
  expect(live.terminate).toHaveBeenCalledTimes(1);
});
it("retains completed simulations and preview identities without encoding when precision changes", () => {
  const { result, store, rerender, unmount } = setup();
  const worker = ControlledWorker.instances[0];
  act(() => worker.emit(purchaseReply(worker.message)));
  const before = result.current.view;
  const encode = vi.spyOn(schema, "encodeRequest");
  act(() => store.getState().actions.setIterations(6000, precisionPolicy));
  rerender({ policy: { ...precisionPolicy, iterationsPerSet: 6000 } });
  expect(result.current.view).toBe(before);
  expect(worker.messages).toHaveLength(1);
  expect(encode).not.toHaveBeenCalled();
  unmount();
});
it("returns cached non-purchase counts and reads latest admission state without repeated enumeration", () => {
  const allowance = vi.spyOn(enumerate, "estimateAllowance");
  const enhancement = vi.spyOn(enumerate, "analyzeItemEnhancementSets");
  const { result, store, rerender, unmount } = setup(false);
  expect(ControlledWorker.instances).toHaveLength(0);
  const initial = result.current.nonPurchase;
  expect(initial).not.toBeNull();
  expect(result.current.readNonPurchase()).toBe(initial);
  const counts = [allowance.mock.calls.length, enhancement.mock.calls.length];
  act(() => store.getState().actions.setIterations(6000, precisionPolicy));
  rerender({ policy: { ...precisionPolicy, iterationsPerSet: 6000 } });
  expect(result.current.nonPurchase).toBe(initial);
  expect(result.current.readNonPurchase()).toBe(initial);
  expect([allowance.mock.calls.length, enhancement.mock.calls.length]).toEqual(
    counts,
  );
  act(() => {
    store.getState().actions.toggleItem("owned-legs");
    expect(result.current.readNonPurchase()).not.toBe(initial);
  });
  expect(result.current.readNonPurchase()).toBe(result.current.nonPurchase);
  unmount();
});
it("does not create workers during server rendering", () => {
  vi.stubGlobal("Worker", ControlledWorker);
  function Read() {
    return <span>{useGearLabAnalysis(purchasePolicy).view.state.status}</span>;
  }
  expect(
    renderToString(
      <GearLabProvider
        store={createGearLabStore(purchaseFixture({ frost: 100 }))}
      >
        <Read />
      </GearLabProvider>,
    ),
  ).toBe("<span>idle</span>");
  expect(ControlledWorker.instances).toHaveLength(0);
});

it("publishes search limits with preview then recovers on a new edit", () => {
  const { result, store, unmount } = setup();
  const worker = ControlledWorker.instances[0];
  const ready = purchaseReply(worker.message);
  act(() =>
    worker.emit({
      ...ready,
      analysis: { status: "search-limit", visitedNodes: 10 },
    }),
  );
  expect(result.current.view.state).toMatchObject({
    status: "ready",
    analysis: { status: "search-limit", visitedNodes: 10 },
  });
  expect(result.current.view.preview?.candidates.length).toBeGreaterThan(0);
  act(() => store.getState().actions.setResourceQuantity("frost", 120));
  expect(result.current.view.revision).not.toBe(
    result.current.view.completedRevision,
  );
  act(() => worker.emit(purchaseReply(worker.message)));
  expect(result.current.view.state).toMatchObject({
    status: "ready",
    analysis: { status: "complete" },
  });
  unmount();
});
