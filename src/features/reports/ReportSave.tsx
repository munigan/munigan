"use client";
import Image from "next/image";
import styles from "./ReportSave.module.css";
import { number } from "./report-presentation";
import { reportPercentage } from "./stat-presentation";
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
  character?: {
    name: string;
    specialization: string;
    icon: string;
    dps?: number;
    percent?: number | null;
  };
}) {
  const t = useTranslations("auth"),
    locale = useLocale(),
    auth = useAccount();
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<{ accountId: string | null } | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(`munigan.report.notice.${token}`) === "1";
    } catch {
      return false;
    }
  });
  const intent = useRef("");
  const expiry = access.effectiveExpiresAt
    ? new Date(access.effectiveExpiresAt).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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
        setSaved({ accountId: auth.account?.id ?? null });
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
      setError(
        auth.status === "authenticated" ? "saveFailedAfterLogin" : "saveFailed",
      );
    } finally {
      setPending(false);
    }
  }
  if (access.saved || saved)
    return (
      <p className="muted small" role="status">
        {t(
          auth.status === "authenticated" &&
            (access.canManage ||
              (saved && saved.accountId === auth.account?.id))
            ? "saved"
            : "savedReadOnly",
        )}
      </p>
    );
  if (
    !access.canSave ||
    !auth.savingEnabled ||
    !["anonymous", "authenticated"].includes(auth.status)
  )
    return null;
  const authenticated = auth.status === "authenticated";
  const saveButton = (
    <Button
      variant={dismissed ? "secondary" : "primary"}
      className={styles.saveButton}
      disabled={pending}
      onClick={() => (authenticated ? void save() : setOpen(true))}
    >
      {pending ? t("saving") : t("saveReport")}
      {authenticated ? <SaveIcon kind="bookmark" /> : <DiscordIcon />}
    </Button>
  );
  return (
    <div className={styles.root}>
      {!dismissed ? (
        <section className={styles.notice} aria-label={t("keepReport")}>
          <SaveIcon kind="bookmark" className={styles.noticeIcon} />
          <div className={styles.noticeCopy}>
            <strong>{t("keepReport")}</strong>
            <p>
              {t(authenticated ? "saveNoticeAccount" : "saveNoticeDiscord")}{" "}
              {expiry && t("expires", { date: expiry })}
            </p>
          </div>
          {saveButton}
          <button
            type="button"
            className={styles.dismiss}
            aria-label={t("dismissNotice")}
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(`munigan.report.notice.${token}`, "1");
              } catch {
                // Dismissal still works when browser storage is unavailable.
              }
            }}
          >
            <SaveIcon kind="close" />
          </button>
        </section>
      ) : (
        <div className={styles.quietActions}>
          {saveButton}
          {expiry && <span>{t("expires", { date: expiry })}</span>}
        </div>
      )}
      {error && !open && (
        <p className="auth-error" role="alert">
          {t(error)}
        </p>
      )}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.dialog}>
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>{t("saveProgress")}</p>
              <DialogTitle className={styles.title}>
                {t("keepThisOne")}
              </DialogTitle>
            </div>
            <DialogDismiss />
          </div>
          <DialogDescription className={styles.description}>
            {t(authenticated ? "saveDescriptionAccount" : "saveDescription")}
          </DialogDescription>
          {character && (
            <div className={styles.character}>
              <div className={styles.identity}>
                <Image
                  unoptimized
                  src={`https://wow.zamimg.com/images/wow/icons/large/${character.icon}.jpg`}
                  width={44}
                  height={44}
                  alt=""
                  className={styles.portrait}
                />
                <div className={styles.characterText}>
                  <strong>{character.name}</strong>
                  <span>{character.specialization} · Gear Lab</span>
                </div>
              </div>
              {character.dps !== undefined && (
                <div className={styles.result}>
                  <strong>
                    {number(character.dps, locale)}
                    <span className={styles.mobileDps}> DPS</span>
                  </strong>
                  <span
                    className={
                      character.percent == null || character.percent === 0
                        ? styles.neutral
                        : character.percent > 0
                          ? styles.gain
                          : styles.loss
                    }
                  >
                    <span className={styles.desktopDps}>
                      DPS{character.percent != null && " · "}
                    </span>
                    {character.percent != null &&
                      `${character.percent > 0 ? "+" : ""}${reportPercentage(character.percent, locale)}`}
                  </span>
                </div>
              )}
            </div>
          )}
          <ul className={styles.benefits}>
            <li>
              <SaveIcon kind="history" />
              <span>{t("saveBenefit")}</span>
            </li>
            <li>
              <SaveIcon kind="check" />
              <span>{t("saveAccess")}</span>
            </li>
          </ul>
          <div className={styles.dialogActions}>
            <Button
              className={styles.discordButton}
              disabled={pending}
              onClick={() => void save()}
            >
              {pending
                ? t("saving")
                : t(authenticated ? "saveReport" : "continueDiscord")}
              {authenticated ? <SaveIcon kind="bookmark" /> : <DiscordIcon />}
            </Button>
            <Button
              variant="ghost"
              className={styles.continueButton}
              onClick={() => setOpen(false)}
            >
              {t("continueWithoutSaving")}
            </Button>
            {error && (
              <p className="auth-error" role="alert">
                {t(error)}
              </p>
            )}
          </div>
          <div className={styles.footer}>
            {!authenticated && <p>{t("saveReturn")}</p>}
            {expiry && (
              <p className={styles.expiry}>
                <SaveIcon kind="clock" />
                <span>
                  {t.rich("saveExpiry", {
                    date: () => (
                      <time dateTime={access.effectiveExpiresAt!}>
                        {expiry}
                      </time>
                    ),
                  })}
                </span>
              </p>
            )}
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}

function SaveIcon({
  kind,
  className,
}: {
  kind: "bookmark" | "history" | "check" | "clock" | "close";
  className?: string;
}) {
  const paths = {
    bookmark: "M6 3h12v18l-6-4-6 4Z",
    history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2",
    check: "m5 12 4 4L19 6",
    clock: "M12 8v5l3 2",
    close: "m6 6 12 12M6 18 18 6",
  };
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "clock" && <circle cx="12" cy="12" r="9" />}
      <path d={paths[kind]} />
    </svg>
  );
}
