"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PRO_CONSENT_VERSION,
  type ProLaunchSource,
} from "@/domain/pro-launch/contracts";
import type { PublicAccount } from "@/domain/accounts/contracts";
import { useAccount } from "@/features/auth/AuthProvider";
import { useDiscordSignIn } from "@/features/auth/useDiscordSignIn";
import {
  ProLaunchClientError,
  getProLaunchStatus,
  joinProLaunch,
} from "./client";
import { consumeProLaunchResume, hasProLaunchResume } from "./resume";
import { ProLaunchDialog, type ProDialogState } from "./ProLaunchDialog";

export const proBeforeSignInEvent = "munigan:pro-before-sign-in";
type ProLaunchController = {
  open(source: ProLaunchSource, trigger?: HTMLElement): void;
};
const ProLaunchContext = createContext<ProLaunchController | null>(null);

export function ProLaunchProvider({ children }: { children: ReactNode }) {
  const auth = useAccount();
  const { account, refresh, status: authStatus } = auth;
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("pro");
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<ProLaunchSource>("header");
  const [state, setState] = useState<ProDialogState>({ kind: "auth_loading" });
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const joining = useRef(false);
  const currentAccountId = useRef<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const resumeRefreshPath = useRef<string | null>(null);
  const signIn = useDiscordSignIn({
    callbackPath: pathname,
    proLaunch: { source },
  });
  useLayoutEffect(() => {
    currentAccountId.current =
      authStatus === "authenticated" ? (account?.id ?? null) : null;
  }, [account?.id, authStatus]);

  const invalidate = useCallback(() => {
    ++generation.current;
    request.current?.abort();
    request.current = null;
    joining.current = false;
  }, []);

  const loadStatus = useCallback(
    async (account: PublicAccount) => {
      invalidate();
      currentAccountId.current = account.id;
      const requestGeneration = generation.current;
      const expectedUserId = account.id;
      const controller = new AbortController();
      request.current = controller;
      setState({ kind: "membership_loading", account });
      try {
        const result = await getProLaunchStatus(controller.signal);
        if (
          controller.signal.aborted ||
          requestGeneration !== generation.current ||
          expectedUserId !== currentAccountId.current
        )
          return;
        setState(
          result.status === "joined"
            ? { kind: "joined", account }
            : { kind: "ready", account, joining: false, error: null },
        );
      } catch {
        if (
          controller.signal.aborted ||
          requestGeneration !== generation.current ||
          expectedUserId !== currentAccountId.current
        )
          return;
        setState({ kind: "membership_error", account });
      }
    },
    [invalidate],
  );

  useEffect(() => {
    if (!open) {
      invalidate();
      return;
    }
    if (authStatus === "loading") {
      invalidate();
      const nextGeneration = generation.current;
      queueMicrotask(() => {
        if (nextGeneration === generation.current)
          setState({ kind: "auth_loading" });
      });
      return;
    }
    if (authStatus === "unavailable") {
      invalidate();
      const nextGeneration = generation.current;
      queueMicrotask(() => {
        if (nextGeneration === generation.current)
          setState({ kind: "auth_unavailable" });
      });
      return;
    }
    if (authStatus === "anonymous" || !account) {
      invalidate();
      const nextGeneration = generation.current;
      queueMicrotask(() => {
        if (nextGeneration === generation.current)
          setState({
            kind: "anonymous",
            signingIn: signIn.pending,
            error: signIn.error,
          });
      });
      return;
    }
    invalidate();
    const nextGeneration = generation.current;
    queueMicrotask(() => {
      if (
        nextGeneration === generation.current &&
        currentAccountId.current === account.id
      )
        void loadStatus(account);
    });
  }, [
    authStatus,
    account,
    open,
    loadStatus,
    invalidate,
    signIn.pending,
    signIn.error,
  ]);

  useEffect(() => {
    if (pathname === "/auth/return" || !hasProLaunchResume(pathname)) return;
    if (authStatus === "anonymous") {
      if (resumeRefreshPath.current !== pathname) {
        resumeRefreshPath.current = pathname;
        void refresh();
      }
      return;
    }
    if (authStatus !== "authenticated" || !account) return;
    const resumed = consumeProLaunchResume(account.id, pathname);
    if (resumed) {
      queueMicrotask(() => {
        setSource(resumed.source);
        setOpen(true);
      });
    }
  }, [pathname, authStatus, account, refresh]);

  useEffect(() => () => invalidate(), [invalidate]);

  const openDialog = useCallback(
    (nextSource: ProLaunchSource, nextTrigger?: HTMLElement) => {
      trigger.current = nextTrigger ?? null;
      setSource(nextSource);
      setOpen(true);
    },
    [],
  );

  const closeDialog = useCallback(() => {
    invalidate();
    setOpen(false);
  }, [invalidate]);

  const join = useCallback(async () => {
    if (
      joining.current ||
      state.kind !== "ready" ||
      state.joining ||
      authStatus !== "authenticated" ||
      !account ||
      state.account.id !== account.id ||
      currentAccountId.current !== account.id
    )
      return;
    const shownAccount = state.account;
    const expectedUserId = shownAccount.id;
    invalidate();
    joining.current = true;
    const requestGeneration = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setState({
      kind: "ready",
      account: shownAccount,
      joining: true,
      error: null,
    });
    try {
      await joinProLaunch(
        {
          expectedUserId,
          source,
          locale: locale === "pt-BR" ? "pt-BR" : "en-US",
          consentVersion: PRO_CONSENT_VERSION,
        },
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        requestGeneration !== generation.current ||
        expectedUserId !== currentAccountId.current
      )
        return;
      joining.current = false;
      setState({ kind: "joined", account: shownAccount });
    } catch (error) {
      if (
        controller.signal.aborted ||
        requestGeneration !== generation.current ||
        expectedUserId !== currentAccountId.current
      )
        return;
      if (
        error instanceof ProLaunchClientError &&
        (error.status === 401 ||
          error.code === "ACCOUNT_CHANGED" ||
          error.code === "ACCOUNT_DELETING")
      ) {
        invalidate();
        setState({ kind: "auth_loading" });
        void refresh();
        return;
      }
      joining.current = false;
      setState({
        kind: "ready",
        account: shownAccount,
        joining: false,
        error: t("joinFailed"),
      });
    }
  }, [state, authStatus, account, source, locale, refresh, invalidate, t]);

  const beginSignIn = useCallback(async () => {
    const event = new Event(proBeforeSignInEvent, { cancelable: true });
    if (!window.dispatchEvent(event)) {
      setState({
        kind: "anonymous",
        signingIn: false,
        error: t("preserveFailed"),
      });
      return;
    }
    await signIn.beginSignIn();
  }, [signIn, t]);

  const controller = useMemo(() => ({ open: openDialog }), [openDialog]);
  const renderedState: ProDialogState =
    authStatus === "loading"
      ? { kind: "auth_loading" }
      : authStatus === "unavailable"
        ? { kind: "auth_unavailable" }
        : authStatus === "anonymous" || !account
          ? state.kind === "anonymous"
            ? state
            : {
                kind: "anonymous",
                signingIn: signIn.pending,
                error: signIn.error,
              }
          : state.kind === "auth_loading"
            ? state
            : "account" in state && state.account.id === account.id
              ? state
              : { kind: "membership_loading", account };
  return (
    <ProLaunchContext.Provider value={controller}>
      {children}
      <ProLaunchDialog
        open={open}
        state={renderedState}
        onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}
        onSignIn={() => void beginSignIn()}
        onJoin={() => void join()}
        onRetry={() => {
          if (authStatus === "authenticated" && account)
            void loadStatus(account);
          else void refresh();
        }}
        finalFocus={() =>
          trigger.current?.isConnected
            ? trigger.current
            : document.querySelector<HTMLElement>(".workbench-menu-button")
        }
      />
    </ProLaunchContext.Provider>
  );
}

export function useProLaunch(): ProLaunchController {
  const value = useContext(ProLaunchContext);
  if (!value)
    throw new Error("useProLaunch must be used within ProLaunchProvider");
  return value;
}
