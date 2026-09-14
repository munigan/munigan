import { afterEach, expect, it, vi } from "vitest";
import {
  ControlledWorker,
  purchaseReply,
} from "../../../../tests/support/gear-lab-worker";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import * as schema from "@/domain/top-gear/request-schema";
import { createAnalysisInputSelector } from "./gear-lab-selectors";
import { createGearLabStore } from "./gear-lab-store";
import { createAnalysisController } from "./gear-lab-analysis";

afterEach(() => {
  vi.restoreAllMocks();
  ControlledWorker.instances = [];
});
function setup() {
  const store = createGearLabStore(purchaseFixture({ frost: 100 }));
  const select = createAnalysisInputSelector();
  const controller = createAnalysisController(
    () => new ControlledWorker() as unknown as Worker,
  );
  const update = () =>
    controller.update(select(store.getState(), purchasePolicy));
  update();
  return { store, controller, update, worker: ControlledWorker.instances[0] };
}
it("encodes only one active and the newest pending resource input", () => {
  const encode = vi.spyOn(schema, "encodeRequest");
  const { store, controller, update, worker } = setup();
  store.getState().actions.setResourceQuantity("frost", 120);
  update();
  store.getState().actions.setResourceQuantity("frost", 140);
  update();
  expect(worker.messages).toHaveLength(1);
  expect(encode).toHaveBeenCalledTimes(1);
  worker.emit({
    revision: worker.message.revision,
    status: "ready",
    analysis: { status: "search-limit", visitedNodes: 1 },
    preview: null,
  });
  expect(worker.messages).toHaveLength(2);
  expect(worker.message.request.purchases!.balances.frost).toBe(140);
  expect(controller.getSnapshot().completedRevision).toBeNull();
  expect(encode).toHaveBeenCalledTimes(2);
  controller.dispose();
});
it("does no serialization, worker work or snapshot publication for iterations-only changes", () => {
  const { store, controller, update, worker } = setup();
  const current = controller.getSnapshot();
  const encode = vi.spyOn(schema, "encodeRequest");
  store
    .getState()
    .actions.setIterations(6000, {
      ...purchasePolicy,
      selectableIterations: { min: 500, max: 6000, step: 500 },
    });
  update();
  expect(controller.getSnapshot()).toBe(current);
  expect(worker.messages).toHaveLength(1);
  expect(encode).not.toHaveBeenCalled();
  controller.dispose();
});
it("publishes prepared rows before completion without releasing the active slot", () => {
  const { store, controller, update, worker } = setup();
  const ready = purchaseReply(worker.message);
  expect(ready.preview).not.toBeNull();
  worker.emit({
    revision: ready.revision,
    status: "preview",
    preview: ready.preview!,
  });
  const prepared = controller.getSnapshot();
  expect(prepared.state.status).toBe("loading");
  expect(prepared.preview?.candidates.length).toBeGreaterThan(0);
  expect(prepared.completedRevision).toBeNull();
  store.getState().actions.setPurchaseIncluded(50098, false);
  update();
  expect(controller.getSnapshot().preview).toBe(prepared.preview);
  expect(worker.messages).toHaveLength(1);
  worker.emit(ready);
  expect(worker.messages).toHaveLength(2);
  expect(controller.getSnapshot().completedRevision).toBeNull();
  worker.emit({ ...ready, revision: ready.revision });
  expect(worker.messages).toHaveLength(2);
  worker.emit(purchaseReply(worker.message));
  expect(controller.getSnapshot().completedRevision).toBe(
    controller.getSnapshot().revision,
  );
  controller.dispose();
});
it.each(["resource", "profile"])(
  "hides stale availability immediately on %s changes",
  (change) => {
    const { store, controller, update, worker } = setup();
    worker.emit(purchaseReply(worker.message));
    expect(controller.getSnapshot().preview).not.toBeNull();
    if (change === "resource")
      store.getState().actions.setResourceQuantity("frost", 140);
    else store.getState().actions.setItemVersion("classic");
    update();
    expect(controller.getSnapshot().preview).toBeNull();
    expect(controller.getSnapshot().state.status).toBe("loading");
    controller.dispose();
  },
);
it("replaces epochs, rejects callbacks from the old worker and clears pending on null", () => {
  const { store, controller, update, worker } = setup();
  const late = [...worker.listeners.get("message")!][0];
  const reply = purchaseReply(worker.message);
  store.getState().actions.replaceDraft(purchaseFixture({ frost: 120 }));
  update();
  const current = controller.getSnapshot();
  late({ data: { ...reply, revision: current.revision } } as MessageEvent);
  expect(controller.getSnapshot()).toBe(current);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  store.getState().actions.setResourceQuantity("frost", 140);
  update();
  controller.update(null);
  expect(controller.getSnapshot().state.status).toBe("idle");
  expect(controller.getSnapshot().preview).toBeNull();
  expect(ControlledWorker.instances[1].terminate).toHaveBeenCalledTimes(1);
  controller.dispose();
});
it("does not dispatch non-purchase input and terminates when purchases are removed", () => {
  const { store, controller, update, worker } = setup();
  store.getState().actions.removeResource("frost");
  update();
  expect(store.getState().draft!.purchases).toBeUndefined();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().state.status).toBe("idle");
  expect(ControlledWorker.instances).toHaveLength(1);
  controller.retry();
  expect(ControlledWorker.instances).toHaveLength(1);
  controller.dispose();
});
it.each(["error", "messageerror"] as const)(
  "releases failed workers and retries newest pending input after %s",
  (event) => {
    const { store, controller, update, worker } = setup();
    store.getState().actions.setResourceQuantity("frost", 140);
    update();
    worker.fail(event);
    expect(controller.getSnapshot().state.status).toBe("error");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    controller.retry();
    const next = ControlledWorker.instances[1];
    expect(next.message.request.purchases!.balances.frost).toBe(140);
    next.emit(purchaseReply(next.message));
    expect(controller.getSnapshot().state.status).toBe("ready");
    controller.dispose();
  },
);
it("retries worker construction failures and terminal diagnostics", () => {
  const create = vi.fn(() => {
    throw new Error("unavailable");
  });
  const controller = createAnalysisController(create);
  controller.update(
    createAnalysisInputSelector()(
      createGearLabStore(purchaseFixture({ frost: 100 })).getState(),
      purchasePolicy,
    ),
  );
  expect(controller.getSnapshot().state.status).toBe("error");
  const worker = new ControlledWorker();
  create.mockImplementation(() => worker as never);
  controller.retry();
  worker.emit({
    revision: worker.message.revision,
    status: "error",
    diagnostic: {
      code: "invalidInput",
      message: "Invalid request",
      path: "purchases",
      severity: "error",
    },
  });
  expect(controller.getSnapshot().state.status).toBe("error");
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  controller.dispose();
});
it("disposes idempotently, removes all listeners, and ignores late callbacks and retries", () => {
  const { controller, worker } = setup();
  const notify = vi.fn();
  controller.subscribe(notify);
  const callbacks = [...worker.listeners.get("message")!];
  const reply = purchaseReply(worker.message);
  controller.dispose();
  controller.dispose();
  controller.retry();
  callbacks.forEach((callback) => callback({ data: reply } as MessageEvent));
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(worker.removeEventListener).toHaveBeenCalledTimes(3);
  expect(notify).not.toHaveBeenCalled();
});
