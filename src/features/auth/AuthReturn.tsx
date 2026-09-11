"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { localeCookie, localeMaxAge } from "@/i18n/config";
import { authClient } from "./client";
import {
  clearReturnState,
  clearSignInReturn,
  loadReturnState,
  loadSignInReturn,
  safeReturnPath,
  validFlowKey,
  oauthCallbackPath,
} from "./return-state";

import { validateDeletionReturn } from "./deletion-return";

type Flow = { kind: "intent" | "flow"; key: string };
const activeKey = "munigan.auth.active";
export function AuthReturn() {
  const t = useTranslations("auth"),
    router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(true),
    [revision, setRevision] = useState(0),
    [back, setBack] = useState("/top-gear");
  const captured = useRef(false),
    inFlight = useRef(false),
    attempt = useRef(-1);
  useLayoutEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const params = new URLSearchParams(window.location.search);
    // Strip OAuth/error parameters before any asynchronous work or completion POST.
    history.replaceState(history.state, "", "/auth/return");
    try {
      let next: Flow | null = null;
      if (params.has("intent") || params.has("flow")) {
        const kind = params.has("intent") ? "intent" : "flow";
        const key = params.get(kind) ?? "";
        if (
          validFlowKey(key) &&
          !(params.has("intent") && params.has("flow")) &&
          params.getAll(kind).length === 1
        )
          next = { kind, key };
      } else {
        const raw = sessionStorage.getItem(activeKey);
        if (raw) {
          const stored = JSON.parse(raw);
          if (
            stored.version === 1 &&
            ["intent", "flow"].includes(stored.kind) &&
            validFlowKey(stored.key)
          )
            next = stored;
        }
      }
      if (!next) throw new Error("lost");
      const state =
        next.kind === "intent"
          ? loadReturnState(next.key)
          : loadSignInReturn(next.key);
      if (!state) throw new Error("lost");
      sessionStorage.setItem(
        activeKey,
        JSON.stringify({ version: 1, ...next }),
      );
      queueMicrotask(() =>
        setBack("reportPath" in state ? state.reportPath : state.returnPath),
      );
      document.cookie = `${localeCookie}=${state.locale}; Path=/; Max-Age=${localeMaxAge}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      queueMicrotask(() => setFlow(next));
    } catch {
      queueMicrotask(() => {
        setError("returnLost");
        setPending(false);
      });
    }
  }, []);
  useEffect(() => {
    if (!flow || inFlight.current || attempt.current === revision) return;
    inFlight.current = true;
    attempt.current = revision;
    async function complete() {
      setPending(true);
      setError("");
      try {
        const state =
          flow!.kind === "intent"
            ? loadReturnState(flow!.key)
            : loadSignInReturn(flow!.key);
        if (!state) {
          setError("returnLost");
          return;
        }
        if (flow!.kind === "intent") {
          const response = await fetch("/api/library/save-intents/complete", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: flow!.key }),
          });
          const result = await response.json();
          if (!response.ok) {
            setError(
              result.code === "SIGN_IN_REQUIRED"
                ? "returnSignIn"
                : ["INTENT_EXPIRED", "NOT_FOUND", "REPORT_EXPIRED"].includes(
                      result.code,
                    )
                  ? "returnLost"
                  : "saveFailedAfterLogin",
            );
            return;
          }
          const path = safeReturnPath(result.reportPath ?? "", location.origin);
          if (!("reportPath" in state) || path !== state.reportPath)
            throw new Error("invalid result");
          sessionStorage.setItem(`munigan.auth.restore.${path}`, flow!.key);
          sessionStorage.removeItem(activeKey);
          router.replace(path);
        } else {
          const response = await fetch("/api/account/session", {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!response.ok) throw new Error("session unavailable");
          const result = await response.json();
          if (!result.account || typeof result.account.id !== "string") {
            setError("returnSignIn");
            return;
          }
          if (
            "expectedUserId" in state &&
            state.expectedUserId &&
            result.account.id !== state.expectedUserId
          ) {
            setError("accountChanged");
            return;
          }
          validateDeletionReturn(flow!.key, result.account.id);
          clearSignInReturn(flow!.key);
          sessionStorage.removeItem(activeKey);
          router.replace(
            "returnPath" in state ? state.returnPath : "/top-gear",
          );
        }
      } catch {
        setError("returnFailed");
      } finally {
        setPending(false);
        inFlight.current = false;
      }
    }
    void complete();
  }, [flow, revision, router]);
  async function signIn() {
    if (!flow) return;
    setPending(true);
    try {
      const callbackURL = oauthCallbackPath(flow.kind, flow.key);
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      if (result?.error) setError("returnFailed");
    } catch {
      setError("returnFailed");
    } finally {
      setPending(false);
    }
  }
  function abandon() {
    try {
      if (flow) {
        if (flow.kind === "intent") clearReturnState(flow.key);
        else clearSignInReturn(flow.key);
      }
      sessionStorage.removeItem(activeKey);
      router.replace(back);
    } catch {
      setError("returnFailed");
    }
  }
  return (
    <section className="auth-return">
      <h1>{t("library")}</h1>
      {pending ? (
        <p role="status">{t("returnWorking")}</p>
      ) : (
        <>
          {error && <p role="alert">{t(error)}</p>}
          <div className="actions">
            {flow && error !== "returnLost" && (
              <Button onClick={() => setRevision((v) => v + 1)}>
                {t("retryReturn")}
              </Button>
            )}
            {flow && error === "returnSignIn" && (
              <Button onClick={() => void signIn()}>
                {t("continueDiscord")}
              </Button>
            )}
            <Button variant="secondary" onClick={abandon}>
              {t(back === "/top-gear" ? "backGearLab" : "back")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
