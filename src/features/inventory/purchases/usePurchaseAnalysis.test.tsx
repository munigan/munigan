import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
import { analyzePurchaseSelection } from "@/domain/purchases/analysis";
import { encodeSnapshot } from "@/domain/top-gear/request-schema";
import { usePurchaseAnalysis } from "./usePurchaseAnalysis";
import type {
  PurchaseWorkerRequest,
  PurchaseWorkerReply,
} from "./purchase-worker-contract";
class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: { data: PurchaseWorkerReply }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  message!: PurchaseWorkerRequest;
  constructor() {
    MockWorker.instances.push(this);
  }
  postMessage(message: PurchaseWorkerRequest) {
    this.message = message;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  MockWorker.instances = [];
});
function reply(
  request = purchaseFixture({ frost: 100 }),
  revision = 1,
): Extract<PurchaseWorkerReply, { status: "ready" }> {
  let preview: Extract<PurchaseWorkerReply, { status: "ready" }>["preview"] =
    null;
  const analysis = analyzePurchaseSelection(request, purchasePolicy, (p) => {
    preview = {
      snapshot: encodeSnapshot(p.snapshot),
      selection: p.selection,
      candidates: p.candidates,
    };
  });
  return { status: "ready", revision, analysis, preview };
}
it("invalidates immediately, ignores reversed stale replies and terminates replacement/unmount work", () => {
  vi.stubGlobal("Worker", MockWorker);
  const first = purchaseFixture({ frost: 100 });
  const second = purchaseFixture({ frost: 120 });
  const { result, rerender, unmount } = renderHook(
    ({ request }) => usePurchaseAnalysis(request, purchasePolicy),
    { initialProps: { request: first } },
  );
  const a = MockWorker.instances[0];
  const firstReply = reply(first, a.message.revision);
  act(() => a.onmessage?.({ data: firstReply }));
  expect(result.current.status).toBe("ready");
  rerender({ request: second });
  expect(result.current.status).toBe("loading");
  const b = MockWorker.instances[1];
  const secondReply = reply(second, b.message.revision);
  act(() => {
    b.onmessage?.({ data: secondReply });
    a.onmessage?.({ data: firstReply });
  });
  expect(result.current.status).toBe("ready");
  if (result.current.status !== "ready")
    throw new Error("Expected current analysis");
  expect(result.current.analysis).toEqual(secondReply.analysis);
  expect(result.current.analysis).not.toEqual(firstReply.analysis);
  expect(a.terminate).toHaveBeenCalled();
  unmount();
  expect(b.terminate).toHaveBeenCalled();
});
it("publishes search limits and worker failure, then retries on edit", () => {
  vi.stubGlobal("Worker", MockWorker);
  const { result, rerender } = renderHook(
    ({ request }) => usePurchaseAnalysis(request, purchasePolicy),
    { initialProps: { request: purchaseFixture({ frost: 100 }) } },
  );
  const a = MockWorker.instances[0];
  act(() =>
    a.onmessage?.({
      data: {
        status: "ready",
        revision: a.message.revision,
        analysis: { status: "search-limit", visitedNodes: 10 },
        preview: null,
      },
    }),
  );
  expect(
    result.current.status === "ready" && result.current.analysis.status,
  ).toBe("search-limit");
  rerender({ request: purchaseFixture({ frost: 120 }) });
  act(() => MockWorker.instances[1].onerror?.());
  expect(result.current.status).toBe("error");
  rerender({ request: purchaseFixture({ frost: 130 }) });
  expect(result.current.status).toBe("loading");
});

it("carries profession-invalid enhancement repair identity across the real worker boundary", async () => {
  let request = purchaseFixture({ frost: 60 });
  const { Profession } = await import("@/generated/wotlk/common");
  const { setPurchaseEnhancements } =
    await import("@/domain/purchases/enhancements");
  request.snapshot.settings.player!.profession1 = Profession.Jewelcrafting;
  request.snapshot.professionLevels = { [Profession.Jewelcrafting]: 450 };
  request = setPurchaseEnhancements(request, 50098, { gemIds: [42142] });
  request.snapshot.settings.player!.profession1 = Profession.Blacksmithing;
  const { encodeRequest } = await import("@/domain/top-gear/request-schema");
  const post = vi.fn();
  vi.stubGlobal("postMessage", post);
  await import("./purchase-analysis.worker");
  self.onmessage!(
    new MessageEvent("message", {
      data: {
        revision: 7,
        request: encodeRequest(request),
        policy: purchasePolicy,
      },
    }),
  );
  expect(post.mock.calls[0][0]).toMatchObject({
    revision: 7,
    status: "error",
    diagnostic: {
      code: "purchaseEnhancementInvalid",
      params: { itemId: 50098, profile: "original" },
      diagnostics: [
        expect.objectContaining({
          code: "profession-gem",
          path: "purchase-original-50098.gemIds.0",
        }),
      ],
    },
  });
});

it("keeps the encoded prepared preview when enumeration later reaches its search limit", async () => {
  const request = purchaseFixture({ frost: 100, "regalia:vanquisher": 1 });
  for (let index = 0; index < 100; index++) {
    const instanceId = `legs-${index}`;
    request.snapshot.inventory.push({
      ...request.snapshot.inventory[0],
      instanceId,
      source: "bag",
      equippedSlot: undefined,
    });
    request.selection.selectedInstanceIds.push(instanceId);
  }
  const { encodeRequest, decodeSnapshot } =
    await import("@/domain/top-gear/request-schema");
  const post = vi.fn();
  vi.stubGlobal("postMessage", post);
  await import("./purchase-analysis.worker");
  self.onmessage!(
    new MessageEvent("message", {
      data: {
        revision: 9,
        request: encodeRequest(request),
        policy: { ...purchasePolicy, maxSearchNodes: 3000 },
      },
    }),
  );
  const reply = post.mock.calls[0][0];
  expect(reply.analysis).toMatchObject({
    status: "search-limit",
    visitedNodes: 3000,
  });
  expect(reply.preview.candidates.length).toBeGreaterThan(0);
  expect(decodeSnapshot(reply.preview.snapshot).settings.player!.class).toBe(
    request.snapshot.settings.player!.class,
  );
  expect(reply.preview.snapshot.settings).toEqual(
    encodeRequest(request).snapshot.settings,
  );
});
