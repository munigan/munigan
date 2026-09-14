"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  DialogContent,
  DialogDescription,
  DialogDismiss,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/Dialog";
import { DiscordIcon } from "./DiscordIcon";
import { useDiscordSignIn } from "./useDiscordSignIn";

export function SignInDialog({
  open,
  onOpenChange,
  callbackPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callbackPath: string;
}) {
  const t = useTranslations("auth");
  const { pending, error, beginSignIn } = useDiscordSignIn({ callbackPath });
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="auth-dialog">
        <div className="auth-dialog-heading">
          <div>
            <DialogTitle className="auth-dialog-title">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="auth-dialog-description">
              {t("description")}
            </DialogDescription>
          </div>
          <DialogDismiss />
        </div>
        <Button
          className="auth-discord-button"
          onClick={() => void beginSignIn()}
          disabled={pending}
        >
          <span>{t("continueDiscord")}</span>
          <DiscordIcon />
        </Button>
        <Button
          className="auth-continue-anonymous"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          {t("continueAnonymous")}
        </Button>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-return-note">{t("returnNotice")}</p>
      </DialogContent>
    </DialogRoot>
  );
}
