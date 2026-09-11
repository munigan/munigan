"use client";
import type { PublicAccount } from "@/domain/accounts/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "./client";

export type AuthState = {
  status: "loading" | "anonymous" | "authenticated" | "unavailable";
  account: PublicAccount | null;
  savingEnabled: boolean;
  enrollmentEnabled: boolean;
};
type AuthContextValue = AuthState & {
  refresh(): Promise<void>;
  signOut(): Promise<void>;
  accountDeleted(expectedUserId: string): void;
};
type SessionPayload = Omit<AuthState, "status">;

const initialState: AuthState = {
  status: "loading",
  account: null,
  savingEnabled: false,
  enrollmentEnabled: false,
};
const AuthContext = createContext<AuthContextValue | null>(null);
const channelName = "munigan.account";
const storageKey = "munigan.account.invalidated";

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const account = data.account;
  return (
    typeof data.savingEnabled === "boolean" &&
    typeof data.enrollmentEnabled === "boolean" &&
    (account === null ||
      (typeof account === "object" &&
        typeof (account as Record<string, unknown>).id === "string" &&
        typeof (account as Record<string, unknown>).name === "string"))
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const session = authClient.useSession();
  const sawInitialSession = useRef(false);
  const broadcast = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    controller.current?.abort();
    setState((current) => ({ ...current, status: "loading", account: null }));
    const nextController = new AbortController();
    controller.current = nextController;
    try {
      const response = await fetch("/api/account/session", {
        cache: "no-store",
        credentials: "same-origin",
        signal: nextController.signal,
      });
      if (!response.ok) throw new Error("session unavailable");
      const payload: unknown = await response.json();
      if (!isSessionPayload(payload))
        throw new Error("invalid session response");
      if (generation.current !== requestGeneration) return;
      setState({
        ...payload,
        status: payload.account ? "authenticated" : "anonymous",
      });
    } catch {
      if (
        nextController.signal.aborted ||
        generation.current !== requestGeneration
      )
        return;
      setState((current) => ({
        ...current,
        status: "unavailable",
        account: null,
      }));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      controller.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!sawInitialSession.current) {
      sawInitialSession.current = true;
      return;
    }
    if (!session.isPending) queueMicrotask(() => void refresh());
  }, [refresh, session.data, session.isPending]);

  useEffect(() => {
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(channelName);
    broadcast.current = channel;
    const invalidate = () => void refresh();
    if (channel) channel.addEventListener("message", invalidate);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) invalidate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.removeEventListener("message", invalidate);
      channel?.close();
      broadcast.current = null;
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error)
      throw new Error(result.error.message || "sign-out failed");
    ++generation.current;
    controller.current?.abort();
    setState((current) => ({ ...current, status: "anonymous", account: null }));
    if (broadcast.current) {
      broadcast.current.postMessage("invalidate");
    } else {
      localStorage.setItem(storageKey, String(Date.now()));
    }
  }, []);

  const accountDeleted = useCallback((expectedUserId: string) => {
    ++generation.current;
    controller.current?.abort();
    setState((current) =>
      current.account?.id === expectedUserId || current.status === "loading"
        ? { ...current, status: "anonymous", account: null }
        : current,
    );
    try {
      if (broadcast.current) broadcast.current.postMessage("invalidate");
      else localStorage.setItem(storageKey, crypto.randomUUID());
    } catch {
      /* The local account has already been invalidated. */
    }
  }, []);
  const value = useMemo(
    () => ({ ...state, refresh, signOut, accountDeleted }),
    [refresh, signOut, accountDeleted, state],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAccount(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAccount must be used within AuthProvider");
  return value;
}
