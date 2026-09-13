import type {
  Diagnostic,
  Selection,
  Snapshot,
  WorkPolicy,
} from "@/domain/top-gear/model";
import type {
  PurchaseAnalysis,
  PurchaseCandidate,
} from "@/domain/purchases/model";
import type {
  encodeRequest,
  encodeSnapshot,
} from "@/domain/top-gear/request-schema";
export type PurchaseDiagnostic = Diagnostic & {
  diagnostics?: Diagnostic[];
  params?: { itemId: number; profile: "original" | "classic" };
};
export type PurchasePreview = {
  snapshot: Snapshot;
  selection: Selection;
  candidates: PurchaseCandidate[];
};
export type PurchaseAnalysisState =
  | { status: "idle" | "loading" }
  | {
      status: "ready";
      refreshing?: boolean;
      analysis: PurchaseAnalysis;
      preview: PurchasePreview | null;
    }
  | { status: "error"; diagnostic: PurchaseDiagnostic };
export type PurchaseWorkerRequest = {
  revision: number;
  request: ReturnType<typeof encodeRequest>;
  policy: WorkPolicy;
};
export type PurchaseWorkerReply = { revision: number } & (
  | {
      status: "ready";
      analysis: PurchaseAnalysis;
      preview:
        | (Omit<PurchasePreview, "snapshot"> & {
            snapshot: ReturnType<typeof encodeSnapshot>;
          })
        | null;
    }
  | { status: "error"; diagnostic: PurchaseDiagnostic }
);
