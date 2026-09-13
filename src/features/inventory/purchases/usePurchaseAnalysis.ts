"use client";
import { itemVersionOf } from "@/domain/top-gear/item-version";
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
  const key = useMemo(() => {
    if (!request?.purchases || !policy) return null;
    const encoded = encodeRequest(request);
    delete encoded.iterations;
    // Iterations affect execution, not item acquisition or legal combinations.
    // Keep the worker input stable and apply the chosen precision below.
    return JSON.stringify({
      request: encoded,
      policy: { ...policy, iterationsPerSet: 1 },
    });
  }, [request, policy]);
  const baseKey = useMemo(() => {
    if (!key) return null;
    const value = JSON.parse(key);
    delete value.request.purchases.excludedItemIds;
    return JSON.stringify(value);
  }, [key]);
  const workerRef = useRef<{ baseKey: string; worker: Worker } | null>(null);
  useEffect(
    () => () => {
      workerRef.current?.worker.terminate();
      workerRef.current = null;
    },
    [],
  );
  const generation = useRef(0);
  const [workerResult, setResult] = useState<{
    key: string;
    baseKey: string;
    state: PurchaseAnalysisState;
  } | null>(null);
  const result = useMemo(() => {
    if (
      !workerResult ||
      !policy ||
      workerResult.state.status !== "ready" ||
      workerResult.state.analysis.status !== "complete"
    )
      return workerResult;
    const state = workerResult.state;
    const analysis = state.analysis;
    if (analysis.status !== "complete") return workerResult;
    return {
      ...workerResult,
      state: {
        ...state,
        analysis: {
          ...analysis,
          plan: {
            ...analysis.plan,
            simulations: analysis.plan.simulations.map((simulation, index) => ({
              ...simulation,
              iterations: policy.iterationsPerSet,
              seed: String(100000 + index * (policy.iterationsPerSet + 1)),
            })),
          },
        },
      },
    };
  }, [workerResult, policy]);
  useEffect(() => {
    const revision = ++generation.current;
    if (!key || !baseKey) {
      workerRef.current?.worker.terminate();
      workerRef.current = null;
      return;
    }
    let worker: Worker | undefined;
    let active = true;
    const fail = () => {
      if (active && generation.current === revision) {
        workerRef.current?.worker.terminate();
        workerRef.current = null;
      }
      if (active && generation.current === revision)
        setResult({
          key,
          baseKey,
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
    const receive = (event: MessageEvent<PurchaseWorkerReply>) => {
      if (
        !active ||
        event.data.revision !== generation.current ||
        event.data.revision !== revision
      )
        return;
      try {
        const reply = event.data;
        if (reply.status === "preview") return;
        setResult({
          key,
          baseKey,
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
    try {
      if (workerRef.current?.baseKey !== baseKey) {
        workerRef.current?.worker.terminate();
        workerRef.current = null;
      }
      worker =
        workerRef.current?.worker ??
        new Worker(new URL("./purchase-analysis.worker.ts", import.meta.url), {
          type: "module",
        });
      worker.addEventListener("message", receive);
      worker.addEventListener("error", fail);
      worker.addEventListener("messageerror", fail);
      worker.postMessage({ ...JSON.parse(key), revision });
      workerRef.current = { baseKey, worker };
    } catch {
      fail();
    }
    return () => {
      active = false;
      worker?.removeEventListener("message", receive);
      worker?.removeEventListener("error", fail);
      worker?.removeEventListener("messageerror", fail);
    };
  }, [key, baseKey]);
  if (!key) return { status: "idle" };
  if (result?.key === key) return result.state;
  if (
    result?.baseKey === baseKey &&
    result.state.status === "ready" &&
    result.state.preview &&
    request?.purchases
  ) {
    const previous = result.state.preview;
    const excluded = new Set(
      request.purchases.excludedItemIds[itemVersionOf(request.snapshot)] ?? [],
    );
    const candidates = previous.candidates.map((candidate) => ({
      ...candidate,
      included: !excluded.has(candidate.instance.itemId),
    }));
    const generatedIds = new Set(candidates.map((c) => c.instance.instanceId));
    return {
      ...result.state,
      refreshing: true,
      preview: {
        ...previous,
        candidates,
        selection: {
          ...previous.selection,
          selectedInstanceIds: [
            ...previous.selection.selectedInstanceIds.filter(
              (id) => !generatedIds.has(id),
            ),
            ...candidates
              .filter((c) => c.available && c.included)
              .map((c) => c.instance.instanceId),
          ],
        },
      },
    };
  }
  return { status: "loading" };
}
