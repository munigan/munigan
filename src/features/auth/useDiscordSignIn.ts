"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProLaunchSource } from "@/domain/pro-launch/contracts";
import { authClient } from "./client";
import {
  oauthCallbackPath,
  safeReturnPath,
  storeSignInReturn,
} from "./return-state";

export function useDiscordSignIn({
  callbackPath,
  proLaunch,
}: {
  callbackPath: string;
  proLaunch?: { source: ProLaunchSource };
}): {
  pending: boolean;
  error: string | null;
  beginSignIn(): Promise<void>;
} {
  const locale = useLocale();
  const t = useTranslations("auth");
  const flow = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function beginSignIn() {
    setError(null);
    if (
      !callbackPath.startsWith("/") ||
      callbackPath.startsWith("//") ||
      callbackPath.includes("\\") ||
      /^\/api\/auth/.test(callbackPath) ||
      /^\/auth\/return/.test(callbackPath)
    ) {
      setError(t("invalidCallback"));
      return;
    }
    setPending(true);
    try {
      if (!flow.current) flow.current = crypto.randomUUID();
      storeSignInReturn(flow.current, {
        returnPath: safeReturnPath(callbackPath, window.location.origin),
        locale: locale === "pt-BR" ? "pt-BR" : "en-US",
        ...(proLaunch ? { proLaunch } : {}),
      });
      const callbackURL = oauthCallbackPath("flow", flow.current);
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      if (result?.error) setError(t("signInFailed"));
    } catch {
      setError(t("signInFailed"));
    } finally {
      setPending(false);
    }
  }

  return { pending, error, beginSignIn };
}
