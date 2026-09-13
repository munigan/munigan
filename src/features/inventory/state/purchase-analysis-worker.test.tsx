import { afterEach, expect, it, vi } from "vitest";
import {
  purchaseFixture,
  purchasePolicy,
} from "../../../../tests/support/purchase-fixtures";
afterEach(() => vi.unstubAllGlobals());
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
  await import("../purchases/purchase-analysis.worker");
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
  await import("../purchases/purchase-analysis.worker");
  self.onmessage!(
    new MessageEvent("message", {
      data: {
        revision: 9,
        request: encodeRequest(request),
        policy: { ...purchasePolicy, maxSearchNodes: 3000 },
      },
    }),
  );
  expect(post.mock.calls[0][0]).toMatchObject({
    revision: 9,
    status: "preview",
  });
  const reply = post.mock.calls.at(-1)![0];
  expect(reply.status).toBe("ready");
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
