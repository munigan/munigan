"use client";
import { useEffect, useState } from "react";
import { describeError, type ErrorDescriptor } from "@/i18n/error";

export function useReport<T extends { report: { status: string } }>(
  url: string,
  resourceKey = url,
) {
  const [state, setState] = useState<{
    url: string;
    requestedUrl: string;
    resourceKey: string;
    data: T | null;
    error: string;
    diagnostic: ErrorDescriptor | null;
  }>({
    url,
    requestedUrl: url,
    resourceKey,
    data: null,
    error: "",
    diagnostic: null,
  });
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false,
      terminal = false;
    const schedule = (delay: number) => {
      if (!abort.signal.aborted && !terminal && !document.hidden)
        timer = setTimeout(poll, delay);
    };
    const poll = async () => {
      if (pending || terminal || document.hidden || abort.signal.aborted)
        return;
      pending = true;
      let delay = 2000;
      try {
        const response = await fetch(url, { signal: abort.signal });
        const next = await response.json();
        if (!response.ok) {
          terminal = response.status === 404 || response.status === 410;
          throw describeError({
            ...next,
            error: next.error || "Could not refresh this report",
          });
        }
        if (abort.signal.aborted) return;
        terminal = !["queued", "running"].includes(next.report.status);
        setState({
          url,
          requestedUrl: url,
          resourceKey,
          data: next,
          error: "",
          diagnostic: null,
        });
      } catch (e) {
        if (!abort.signal.aborted) {
          setState((old) => ({
            url: old.resourceKey === resourceKey && old.data ? old.url : url,
            requestedUrl: url,
            resourceKey,
            data: terminal || old.resourceKey !== resourceKey ? null : old.data,
            error: describeError(e).message,
            diagnostic: describeError(e),
          }));
          delay = 5000;
        }
      } finally {
        pending = false;
        schedule(delay);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [url, resourceKey]);
  // Pagination shares a resource key; navigating to another report never does.
  const sameReport = state.resourceKey === resourceKey;
  return {
    url: sameReport ? state.url : url,
    data: sameReport ? state.data : null,
    error: sameReport && state.requestedUrl === url ? state.error : "",
    diagnostic:
      sameReport && state.requestedUrl === url ? state.diagnostic : null,
    isPending: !sameReport || state.requestedUrl !== url,
  };
}
