"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  ReportAccess,
  ReportViewState,
} from "@/domain/accounts/contracts";
import { Button } from "@/components/ui/Button";
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogDismiss,
} from "@/components/ui/Dialog";
import { useAccount } from "../auth/AuthProvider";
import { authClient } from "../auth/client";
import { accountErrorKey } from "../auth/account-error-key";
import { DiscordIcon } from "../auth/DiscordIcon";
import {
  storeReturnState,
  validFlowKey,
  oauthCallbackPath,
} from "../auth/return-state";

export function ReportSave({
  token,
  access,
  onSaved,
  getViewState,
  character,
}: {
  token: string;
  access: ReportAccess;
  onSaved: () => void;
  getViewState?: () => ReportViewState;
  character?: string;
}) {
  const t = useTranslations("auth"),
    locale = useLocale(),
    auth = useAccount();
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(`munigan.report.notice.${token}`) === "1";
    } catch {
      return false;
    }
  });
  const intent = useRef("");
  const expiry = access.effectiveExpiresAt
    ? new Date(access.effectiveExpiresAt).toLocaleDateString(locale, {
        timeZone: "UTC",
      })
    : null;
  async function save() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (auth.status === "authenticated") {
        const response = await fetch(`/api/reports/${token}/save`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        if (!response.ok) {
          const result = await response.json();
          setError(accountErrorKey(result.code));
          return;
        }
        setSaved(true);
        setOpen(false);
        onSaved();
      } else {
        if (!intent.current) {
          const response = await fetch(`/api/reports/${token}/save-intent`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          const result = await response.json();
          if (!response.ok) {
            setError(accountErrorKey(result.code));
            return;
          }
          if (!validFlowKey(result.token ?? ""))
            throw new Error("intent failed");
          intent.current = result.token;
        }
        storeReturnState(
          intent.current,
          getViewState?.() ?? {
            version: 1,
            reportPath: `/reports/${token}`,
            locale: locale === "pt-BR" ? "pt-BR" : "en-US",
            cursor: 0,
            selectedId: null,
            difference: "equipped",
            scrollY: window.scrollY,
          },
        );
        const callbackURL = oauthCallbackPath("intent", intent.current);
        const result = await authClient.signIn.social({
          provider: "discord",
          callbackURL,
          errorCallbackURL: callbackURL,
        });
        if (result?.error) throw new Error("sign-in failed");
      }
    } catch {
      setError("saveFailed");
    } finally {
      setPending(false);
    }
  }
  if (access.saved || saved)
    return (
      <p className="muted small" role="status">
        {t("saved")}
      </p>
    );
  if (
    !access.canSave ||
    !auth.savingEnabled ||
    !["anonymous", "authenticated"].includes(auth.status)
  )
    return null;
  return (
    <div className="report-save">
      {!dismissed && (
        <div className="report-save-notice">
          <div>
            <strong>{t("keepReport")}</strong>
            <p>
              {character} {expiry && t("expires", { date: expiry })}
            </p>
          </div>
          <button
            type="button"
            className="auth-utility-button"
            aria-label={t("dismissNotice")}
            onClick={() => {
              try {
                sessionStorage.setItem(`munigan.report.notice.${token}`, "1");
                setDismissed(true);
              } catch {
                setError("saveFailed");
              }
            }}
          >
            ×
          </button>
        </div>
      )}
      <div className="actions">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            auth.status === "authenticated" ? void save() : setOpen(true)
          }
        >
          {pending ? t("saving") : t("saveReport")}
        </Button>
        {dismissed && expiry && (
          <span className="muted small">{t("expires", { date: expiry })}</span>
        )}
      </div>
      {error && !open && (
        <p className="auth-error" role="alert">
          {t(error)}
        </p>
      )}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent className="auth-dialog report-save-dialog">
          <div className="auth-dialog-heading">
            <div>
              <p className="eyebrow">{t("library")}</p>
              <DialogTitle className="auth-dialog-title">
                {t("keepThisOne")}
              </DialogTitle>
              <DialogDescription className="auth-dialog-description">
                {t("saveDescription")}
              </DialogDescription>
            </div>
            <DialogDismiss />
          </div>
          {character && (
            <div className="report-save-character">{character}</div>
          )}
          <p>{t("saveBenefit")}</p>
          <p>{t("saveAccess")}</p>
          <Button
            className="auth-discord-button"
            disabled={pending}
            onClick={() => void save()}
          >
            {pending ? t("saving") : t("continueDiscord")}
            <DiscordIcon />
          </Button>
          <Button
            variant="ghost"
            className="auth-continue-anonymous"
            onClick={() => setOpen(false)}
          >
            {t("continueWithoutSaving")}
          </Button>
          {error && (
            <p className="auth-error" role="alert">
              {t(error)}
            </p>
          )}
          <p className="auth-return-note">
            {expiry && t("expires", { date: expiry })} {t("saveReturn")}
          </p>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
