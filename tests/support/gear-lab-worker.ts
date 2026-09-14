import { vi } from "vitest";
import { analyzePurchaseSelection } from "@/domain/purchases/analysis";
import { decodeDraft, encodeSnapshot } from "@/domain/top-gear/request-schema";
import type {
  PurchaseWorkerReply,
  PurchaseWorkerRequest,
} from "@/features/inventory/purchases/purchase-worker-contract";

/** Explicit delivery lets tests model browser queues and late events. */
export class ControlledWorker {
  static instances: ControlledWorker[] = [];
  messages: PurchaseWorkerRequest[] = [];
  listeners = new Map<
    string,
    Set<(event: MessageEvent<PurchaseWorkerReply>) => void>
  >();
  terminate = vi.fn();
  constructor() {
    ControlledWorker.instances.push(this);
  }
  get onmessage() {
    return (event: { data: PurchaseWorkerReply }) => this.emit(event.data);
  }
  get onerror() {
    return () => this.fail();
  }
  get message() {
    return this.messages.at(-1)!;
  }
  addEventListener(
    type: string,
    callback: (event: MessageEvent<PurchaseWorkerReply>) => void,
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }
  removeEventListener = vi.fn(
    (
      type: string,
      callback: (event: MessageEvent<PurchaseWorkerReply>) => void,
    ) => {
      this.listeners.get(type)?.delete(callback);
    },
  );
  postMessage(message: PurchaseWorkerRequest) {
    this.messages.push(message);
  }
  emit(reply: PurchaseWorkerReply) {
    for (const listener of this.listeners.get("message") ?? [])
      listener({ data: reply } as MessageEvent<PurchaseWorkerReply>);
  }
  fail(type: "error" | "messageerror" = "error") {
    for (const listener of this.listeners.get(type) ?? [])
      listener({} as MessageEvent<PurchaseWorkerReply>);
  }
}
export function purchaseReply(
  message: PurchaseWorkerRequest,
): Extract<PurchaseWorkerReply, { status: "ready" }> {
  let preview: Extract<PurchaseWorkerReply, { status: "ready" }>["preview"] =
    null;
  const analysis = analyzePurchaseSelection(
    decodeDraft(message.request),
    message.policy,
    (prepared) => {
      preview = {
        snapshot: encodeSnapshot(prepared.snapshot),
        selection: prepared.selection,
        candidates: prepared.candidates,
      };
    },
  );
  return { revision: message.revision, status: "ready", analysis, preview };
}
