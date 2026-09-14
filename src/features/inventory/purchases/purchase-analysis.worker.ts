import { createPurchaseAnalyzer } from "@/domain/purchases/analysis";
import { PurchaseEnhancementError } from "@/domain/purchases/enhancements";
import { decodeDraft, encodeSnapshot } from "@/domain/top-gear/request-schema";
import { describeError } from "@/i18n/error";
import type {
  PurchaseWorkerRequest,
  PurchaseWorkerReply,
} from "./purchase-worker-contract";
const analyzePurchaseSelection = createPurchaseAnalyzer();
self.onmessage = (event: MessageEvent<PurchaseWorkerRequest>) => {
  const { revision, request, policy } = event.data;
  let reply: PurchaseWorkerReply;
  try {
    let preview: Extract<PurchaseWorkerReply, { status: "ready" }>["preview"] =
      null;
    const analysis = analyzePurchaseSelection(
      decodeDraft(request),
      policy,
      (prepared) => {
        preview = {
          snapshot: encodeSnapshot(prepared.snapshot),
          selection: prepared.selection,
          candidates: prepared.candidates,
        };
        self.postMessage({
          revision,
          status: "preview",
          preview,
        } satisfies PurchaseWorkerReply);
      },
    );
    reply = { revision, status: "ready", analysis, preview };
  } catch (error) {
    const described = describeError(error);
    reply = {
      revision,
      status: "error",
      diagnostic:
        error instanceof PurchaseEnhancementError
          ? {
              code: "purchaseEnhancementInvalid",
              diagnostics: error.diagnostics,
              params: { itemId: error.itemId, profile: error.profile },
              message: error.message,
              path: "purchases.itemEnhancements",
              severity: "error",
            }
          : {
              code: described.code ?? "invalidInput",
              message: described.message,
              path: "purchases",
              severity: "error",
            },
    };
  }
  self.postMessage(reply);
};
