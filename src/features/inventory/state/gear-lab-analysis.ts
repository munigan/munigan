import {
  decodeSnapshot,
  encodeRequest,
} from "@/domain/top-gear/request-schema";
import type {
  PurchaseAnalysisState,
  PurchaseDiagnostic,
  PurchasePreview,
  PurchaseWorkerReply,
} from "../purchases/purchase-worker-contract";
import type { AnalysisInput } from "./gear-lab-selectors";

export type AnalysisView = {
  revision: number;
  completedRevision: number | null;
  state: PurchaseAnalysisState;
  preview: PurchasePreview | null;
};
export type AnalysisController = {
  update(input: AnalysisInput | null): void;
  retry(): void;
  getSnapshot(): AnalysisView;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

function sameRecord(a: object, b: object, ignored: readonly string[] = []) {
  const entries = Object.entries(a).filter(([key]) => !ignored.includes(key));
  return (
    entries.length ===
      Object.keys(b).filter((key) => !ignored.includes(key)).length &&
    entries.every(
      ([key, value]) => value === (b as Record<string, unknown>)[key],
    )
  );
}
function sameAvailability(a: AnalysisInput | null, b: AnalysisInput) {
  if (!a || a.epoch !== b.epoch || !a.request.purchases || !b.request.purchases)
    return false;
  return (
    sameRecord(a.request, b.request, ["selection", "purchases"]) &&
    sameRecord(a.request.purchases, b.request.purchases, ["excludedItemIds"]) &&
    sameRecord(a.policy, b.policy)
  );
}

/** The worker queue contains exactly one dispatched revision. Only the newest
 * undispatched input is retained; serialization happens when that slot opens. */
export function createAnalysisController(
  createWorker: () => Worker,
): AnalysisController {
  let view: AnalysisView = {
    revision: 0,
    completedRevision: null,
    state: { status: "idle" },
    preview: null,
  };
  let latest: AnalysisInput | null = null;
  let pending: AnalysisInput | null = null;
  let activeRevision: number | null = null;
  let worker: Worker | null = null;
  let detach: (() => void) | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();
  const publish = (next: AnalysisView) => {
    view = next;
    for (const listener of listeners) listener();
  };
  const release = () => {
    const previous = worker;
    worker = null;
    activeRevision = null;
    detach?.();
    detach = null;
    previous?.terminate();
  };
  const fail = (
    diagnostic: PurchaseDiagnostic = {
      code: "serviceConnection",
      message:
        "Could not calculate purchases. Try again or edit your resources.",
      path: "purchases",
      severity: "error",
    },
  ) => {
    release();
    pending = null;
    publish({
      ...view,
      completedRevision: null,
      state: { status: "error", diagnostic },
    });
  };
  const dispatch = () => {
    if (disposed || activeRevision !== null || !pending) return;
    const input = pending;
    pending = null;
    try {
      if (!worker) {
        const created = createWorker();
        worker = created;
        const transportFailure = () => {
          if (!disposed && worker === created) fail();
        };
        const receive = (event: MessageEvent<PurchaseWorkerReply>) => {
          const reply = event.data;
          if (
            disposed ||
            worker !== created ||
            activeRevision === null ||
            reply.revision !== activeRevision
          )
            return;
          try {
            if (reply.status === "preview") {
              if (reply.revision === view.revision)
                publish({
                  ...view,
                  preview: {
                    ...reply.preview,
                    snapshot: decodeSnapshot(reply.preview.snapshot),
                  },
                });
              return;
            }
            activeRevision = null;
            if (reply.revision === view.revision) {
              if (reply.status === "error") {
                fail(reply.diagnostic);
                return;
              }
              const preview = reply.preview
                ? {
                    ...reply.preview,
                    snapshot: decodeSnapshot(reply.preview.snapshot),
                  }
                : null;
              publish({
                ...view,
                completedRevision: reply.revision,
                state: { status: "ready", analysis: reply.analysis, preview },
                preview,
              });
            }
            dispatch();
          } catch {
            transportFailure();
          }
        };
        detach = () => {
          created.removeEventListener("message", receive);
          created.removeEventListener("error", transportFailure);
          created.removeEventListener("messageerror", transportFailure);
        };
        created.addEventListener("message", receive);
        created.addEventListener("error", transportFailure);
        created.addEventListener("messageerror", transportFailure);
      }
      activeRevision = view.revision;
      worker.postMessage({
        revision: activeRevision,
        request: encodeRequest(input.request),
        policy: input.policy,
      });
    } catch {
      fail();
    }
  };
  return {
    update(input) {
      if (disposed || input === latest) return;
      const previous = latest;
      latest = input;
      const preview =
        input && sameAvailability(previous, input) ? view.preview : null;
      if (!input?.request.purchases || previous?.epoch !== input.epoch) {
        release();
        pending = null;
      }
      publish({
        revision: view.revision + 1,
        completedRevision: null,
        state: { status: input?.request.purchases ? "loading" : "idle" },
        preview,
      });
      if (!input?.request.purchases) return;
      pending = input;
      dispatch();
    },
    retry() {
      if (
        disposed ||
        !latest?.request.purchases ||
        view.state.status !== "error"
      )
        return;
      publish({
        ...view,
        revision: view.revision + 1,
        completedRevision: null,
        state: { status: "loading" },
      });
      pending = latest;
      dispatch();
    },
    getSnapshot: () => view,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      latest = pending = null;
      listeners.clear();
    },
  };
}
