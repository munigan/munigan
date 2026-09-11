"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { DialogContent, DialogDescription, DialogDismiss, DialogRoot, DialogTitle } from "@/components/ui/Dialog";
import { authClient } from "./client";
import { DiscordIcon } from "./DiscordIcon";

function validCallbackPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  const origin = window.location.origin;
  const url = new URL(path, origin);
  return url.origin === origin && !url.pathname.startsWith("/api/auth");
}

export function SignInDialog({ open, onOpenChange, callbackPath }: { open: boolean; onOpenChange: (open: boolean) => void; callbackPath: string }) {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function beginSignIn() {
    setError(null);
    if (!validCallbackPath(callbackPath)) {
      setError(t("invalidCallback"));
      return;
    }
    setPending(true);
    try {
      const result = await authClient.signIn.social({ provider: "discord", callbackURL: callbackPath, errorCallbackURL: callbackPath });
      if (result?.error) setError(t("signInFailed"));
    } catch {
      setError(t("signInFailed"));
    } finally {
      setPending(false);
    }
  }
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="auth-dialog">
        <div className="auth-dialog-heading"><div><DialogTitle className="auth-dialog-title">{t("title")}</DialogTitle><DialogDescription className="auth-dialog-description">{t("description")}</DialogDescription></div><DialogDismiss /></div>
        <Button className="auth-discord-button" onClick={() => void beginSignIn()} disabled={pending}><span>{t("continueDiscord")}</span><DiscordIcon /></Button>
        <Button className="auth-continue-anonymous" variant="ghost" onClick={() => onOpenChange(false)}>{t("continueAnonymous")}</Button>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="auth-return-note">{t("returnNotice")}</p>
      </DialogContent>
    </DialogRoot>
  );
}
