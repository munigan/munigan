"use client";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import type { PublicAccount } from "@/domain/accounts/contracts";
import { DISCORD_PRO_INVITE } from "@/domain/pro-launch/discord";
import { Button } from "@/components/ui/Button";
import {
  DialogContent,
  DialogDescription,
  DialogDismiss,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/Dialog";
import { DiscordIcon } from "@/features/auth/DiscordIcon";
import { ProFeatures } from "./ProFeatures";
import { ProAccount, ProSignup } from "./ProSignup";
import "./pro-launch.css";

export type ProDialogState =
  | { kind: "auth_loading" }
  | { kind: "auth_unavailable" }
  | { kind: "anonymous"; signingIn: boolean; error: string | null }
  | { kind: "membership_loading"; account: PublicAccount }
  | { kind: "membership_error"; account: PublicAccount }
  | {
      kind: "ready";
      account: PublicAccount;
      joining: boolean;
      error: string | null;
    }
  | { kind: "joined"; account: PublicAccount };

export type ProLaunchDialogProps = {
  open: boolean;
  state: ProDialogState;
  onOpenChange(open: boolean): void;
  onSignIn(): void;
  onJoin(): void;
  onRetry(): void;
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
};

export function ProLaunchDialog({
  open,
  state,
  onOpenChange,
  onSignIn,
  onJoin,
  onRetry,
  finalFocus,
}: ProLaunchDialogProps) {
  const t = useTranslations("pro");
  const pathname = usePathname();
  const joined = state.kind === "joined";
  const account = "account" in state ? state.account : null;
  const status =
    state.kind === "auth_loading"
      ? t("loading")
      : state.kind === "membership_loading"
        ? t("membershipLoading")
        : null;
  const failure =
    state.kind === "auth_unavailable"
      ? t("authUnavailable")
      : state.kind === "membership_error"
        ? t("statusFailed")
        : null;
  return (
    <DialogRoot open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <DialogContent
        className="pro-dialog"
        data-joined={joined || undefined}
        finalFocus={finalFocus}
      >
        <header className="pro-heading">
          <div className="pro-kicker">
            <span className="pro-badge">✦ PRO</span>
            <span>{t("comingSoon")}</span>
          </div>
          <DialogDismiss />
          {joined ? (
            <>
              <span className="pro-success-mark" aria-hidden="true">
                ✓
              </span>
              <DialogTitle className="pro-title pro-joined-title">
                {t("joinedTitle")}
              </DialogTitle>
              <DialogDescription className="pro-description">
                {t("joinedBody")}
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="pro-title">{t("title")}</DialogTitle>
              <DialogDescription className="pro-description">
                <span>{t("lead")}</span>
                <span>{t("introduction")}</span>
              </DialogDescription>
            </>
          )}
        </header>
        {joined ? (
          <div className="pro-joined">
            <div className="pro-joined-account">
              <ProAccount account={state.account} />
              <span>{t("joined")} ✓</span>
            </div>
            <p>{t("nextSteps")}</p>
            <div className="pro-discord-option">
              <a
                className="pro-discord-link"
                href={DISCORD_PRO_INVITE}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DiscordIcon />
                {t("discordNotifications")}
              </a>
              <p>{t("discordOptional")}</p>
              <p>{t("roleRemovalHelp")}</p>
            </div>
            <Button className="pro-primary" onClick={() => onOpenChange(false)}>
              {t(pathname === "/gear-lab" ? "backGearLab" : "back")}
            </Button>
          </div>
        ) : (
          <>
            <ProFeatures />
            {status && (
              <div className="pro-state" role="status">
                {account && <ProAccount account={account} />}
                {status}
              </div>
            )}
            {failure && (
              <div className="pro-state">
                {account && <ProAccount account={account} />}
                <p role="alert">{failure}</p>
                <Button variant="secondary" onClick={onRetry}>
                  {t("retry")}
                </Button>
              </div>
            )}
            {state.kind === "anonymous" && (
              <ProSignup
                account={null}
                joining={state.signingIn}
                error={state.error}
                onSignIn={onSignIn}
                onJoin={onJoin}
              />
            )}
            {state.kind === "ready" && (
              <ProSignup
                account={state.account}
                joining={state.joining}
                error={state.error}
                onSignIn={onSignIn}
                onJoin={onJoin}
              />
            )}
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
