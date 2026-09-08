"use client";
import { useEffect, useState } from "react";

export function useReport<T extends { report: { status: string } }>(
  url: string,
) {
  const [state, setState] = useState<{
    url: string;
    data: T | null;
    error: string;
  }>({ url, data: null, error: "" });
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
          throw new Error(next.error || "Could not refresh this report");
        }
        if (abort.signal.aborted) return;
        terminal = !["queued", "running"].includes(next.report.status);
        setState({ url, data: next, error: "" });
      } catch (e) {
        if (!abort.signal.aborted) {
          setState((old) => ({
            url,
            data: terminal || old.url !== url ? null : old.data,
            error: (e as Error).message,
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
  }, [url]);
  return state.url === url ? state : { url, data: null, error: "" };
}
