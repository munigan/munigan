"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TopGearRequest, WorkPolicy } from "@/domain/top-gear/model";
import {
  decodeSnapshot,
  encodeRequest,
} from "@/domain/top-gear/request-schema";
import type {
  PurchaseAnalysisState,
  PurchaseWorkerReply,
} from "./purchase-worker-contract";
export type {
  PurchaseAnalysisState,
  PurchasePreview,
} from "./purchase-worker-contract";
export function usePurchaseAnalysis(
  request: TopGearRequest | null,
  policy: WorkPolicy | null,
): PurchaseAnalysisState {
  const key = useMemo(
    () =>
      request?.purchases && policy
        ? JSON.stringify({ request: encodeRequest(request), policy })
        : null,
    [request, policy],
  );
  const generation = useRef(0);
  const [result, setResult] = useState<{
    key: string;
    state: PurchaseAnalysisState;
  } | null>(null);
  useEffect(() => {
    const revision = ++generation.current;
    if (!key) return;
    let worker: Worker | undefined;
    let active = true;
    const fail = () => {
      if (active && generation.current === revision)
        setResult({
          key,
          state: {
            status: "error",
            diagnostic: {
              code: "serviceConnection",
              message:
                "Could not calculate purchases. Edit your resources to retry.",
              path: "purchases",
              severity: "error",
            },
          },
        });
    };
    try {
      worker = new Worker(
        new URL("./purchase-analysis.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event: MessageEvent<PurchaseWorkerReply>) => {
        if (
          !active ||
          event.data.revision !== generation.current ||
          event.data.revision !== revision
        )
          return;
        try {
          const reply = event.data;
          setResult({
            key,
            state:
              reply.status === "error"
                ? reply
                : {
                    status: "ready",
                    analysis: reply.analysis,
                    preview: reply.preview
                      ? {
                          ...reply.preview,
                          snapshot: decodeSnapshot(reply.preview.snapshot),
                        }
                      : null,
                  },
          });
        } catch {
          fail();
        }
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.postMessage({ ...JSON.parse(key), revision });
    } catch {
      fail();
    }
    return () => {
      active = false;
      worker?.terminate();
    };
  }, [key]);
  if (!key) return { status: "idle" };
  return result?.key === key ? result.state : { status: "loading" };
}
