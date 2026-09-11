"use client";
import { useCallback, useEffect, useState } from "react";
import type {
  AccountErrorCode,
  LibraryPage,
  LibraryQuery,
} from "@/domain/accounts/contracts";
import { useAccount } from "@/features/auth/AuthProvider";
import { subscribeAccountData } from "@/features/auth/data-invalidation";
const codes: AccountErrorCode[] = [
  "SIGN_IN_REQUIRED",
  "AUTH_UNAVAILABLE",
  "NOT_FOUND",
  "REPORT_EXPIRED",
  "OWNER_COOKIE_REQUIRED",
  "INTENT_EXPIRED",
  "REPORT_NOT_READY",
  "CLAIM_CONFLICT",
  "ACCOUNT_DELETING",
  "FRESH_LOGIN_REQUIRED",
  "ACCOUNT_CHANGED",
  "SAVING_UNAVAILABLE",
  "INVALID_REQUEST",
  "RATE_LIMITED",
];
export async function accountResponseError(
  response: Response,
): Promise<AccountErrorCode> {
  try {
    const result = await response.json();
    if (codes.includes(result.code)) return result.code;
  } catch {
    /* safe fallback */
  }
  return "AUTH_UNAVAILABLE";
}
export function useLibrary(query: LibraryQuery): {
  data: LibraryPage | null;
  pending: boolean;
  error: AccountErrorCode | null;
  refresh: () => void;
} {
  const auth = useAccount();
  const identity =
    auth.status === "authenticated" ? (auth.account?.id ?? "") : "";
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [state, setState] = useState<{
    identity: string;
    url: string;
    revision: number;
    data: LibraryPage | null;
    error: AccountErrorCode | null;
  }>({ identity: "", url: "", revision: -1, data: null, error: null });
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search.slice(0, 100));
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.tool) params.set("tool", query.tool);
  if (query.character) params.set("character", query.character);
  if (query.classKey) params.set("classKey", query.classKey);
  if (query.spec) params.set("spec", query.spec);
  if (query.sort === "oldest") params.set("sort", query.sort);
  const url = `/api/library${params.size ? `?${params}` : ""}`;
  useEffect(
    () =>
      subscribeAccountData(() => {
        setState((old) => ({ ...old, data: null }));
        refresh();
      }),
    [refresh],
  );
  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = await accountResponseError(response);
          if (!controller.signal.aborted)
            setState((old) => ({
              identity,
              url,
              revision,
              data:
                old.identity === identity &&
                ![
                  "SIGN_IN_REQUIRED",
                  "ACCOUNT_DELETING",
                  "ACCOUNT_CHANGED",
                ].includes(error)
                  ? old.data
                  : null,
              error,
            }));
          return;
        }
        const data: LibraryPage = await response.json();
        if (!controller.signal.aborted)
          setState({ identity, url, revision, data, error: null });
      } catch {
        if (!controller.signal.aborted)
          setState((old) => ({
            identity,
            url,
            revision,
            data: old.identity === identity ? old.data : null,
            error: "AUTH_UNAVAILABLE",
          }));
      }
    }
    void load();
    return () => controller.abort();
  }, [identity, url, revision]);
  const sameAccount = !!identity && identity === state.identity;
  const current =
    sameAccount && state.url === url && state.revision === revision;
  return {
    data: sameAccount ? state.data : null,
    pending: !!identity && !current,
    error: current ? state.error : null,
    refresh,
  };
}
