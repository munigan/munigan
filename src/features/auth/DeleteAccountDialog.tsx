"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogDismiss,
  DialogClose,
} from "@/components/ui/Dialog";
import { useAccount } from "./AuthProvider";
import { authClient } from "./client";
import {
  clearDeletedAccountBrowserState,
  clearDeletionReturn,
  loadDeletionReturn,
  storeDeletionReturn,
} from "./deletion-return";
import { storeSignInReturn, oauthCallbackPath } from "./return-state";
import { invalidateAccountData } from "./data-invalidation";
import { accountResponseError } from "@/features/library/use-library";

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return open ? <DeletionConfirmation onOpenChange={onOpenChange} /> : null;
}
function DeletionConfirmation({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const auth = useAccount(),
    t = useTranslations("auth"),
    locale = useLocale();
  const [context] = useState(() => {
    try {
      return loadDeletionReturn();
    } catch {
      return null;
    }
  });
  const [expectedId] = useState(context?.expectedUserId ?? auth.account?.id);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [freshRequired, setFreshRequired] = useState(
      !!context && !context.validated,
    ),
    [success, setSuccess] = useState(false),
    [cleanupFailed, setCleanupFailed] = useState(false);
  const busy = useRef(false),
    currentId = useRef(auth.account?.id);
  useEffect(() => {
    currentId.current =
      auth.status === "authenticated" ? auth.account?.id : undefined;
  }, [auth.status, auth.account?.id]);
  const matches =
    auth.status === "authenticated" &&
    !!expectedId &&
    auth.account?.id === expectedId;
  function close(value: boolean) {
    if (busy.current) return;
    if (!value) {
      try {
        clearDeletionReturn();
      } catch {
        /* Closing never grants consent. */
      }
    }
    onOpenChange(value);
  }
  async function remove() {
    if (busy.current || !matches || freshRequired || !expectedId) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedUserId: expectedId }),
      });
      if (!response.ok) {
        const code = await accountResponseError(response);
        if (currentId.current !== expectedId) return;
        if (code === "FRESH_LOGIN_REQUIRED") {
          setFreshRequired(true);
          setError("deleteFreshRequired");
        } else
          setError(
            code === "ACCOUNT_CHANGED"
              ? "accountChanged"
              : "deleteAccountFailed",
          );
        return;
      }
      setSuccess(true);
      setCleanupFailed(!clearDeletedAccountBrowserState());
      auth.accountDeleted(expectedId);
      invalidateAccountData();
    } catch {
      if (currentId.current === expectedId) setError("deleteAccountFailed");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function verify() {
    if (busy.current || !matches || !expectedId) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const flow = crypto.randomUUID();
      storeDeletionReturn(flow, expectedId);
      storeSignInReturn(flow, {
        returnPath: "/library",
        locale: locale === "pt-BR" ? "pt-BR" : "en-US",
        expectedUserId: expectedId,
      });
      const callbackURL = oauthCallbackPath("flow", flow);
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      if (result?.error) setError("signInFailed");
    } catch {
      setError("signInFailed");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <DialogRoot open onOpenChange={close}>
      <DialogContent className="auth-dialog account-delete-dialog">
        <div className="auth-dialog-heading">
          <div>
            <DialogTitle className="auth-dialog-title">
              {t(success ? "deleteAccountDoneTitle" : "deleteAccountTitle")}
            </DialogTitle>
            <DialogDescription className="auth-dialog-description">
              {t(
                success
                  ? "deleteAccountDoneDescription"
                  : "deleteAccountDescription",
              )}
            </DialogDescription>
          </div>
          <DialogDismiss />
        </div>
        {success ? (
          <>
            <p className="deletion-success" role="status">
              {t("deleteAccountDone")}
            </p>
            {cleanupFailed && (
              <p className="auth-error" role="alert">
                {t("deleteCleanupFailed")}
              </p>
            )}
            <div className="deletion-actions">
              <DialogClose render={<Button variant="secondary" />}>
                {t("deleteClose")}
              </DialogClose>
            </div>
          </>
        ) : !matches ? (
          <>
            <p className="auth-error" role="alert">
              {t(auth.status === "loading" ? "loading" : "accountChanged")}
            </p>
            <div className="deletion-actions">
              <DialogClose render={<Button variant="secondary" />}>
                {t("deleteCancel")}
              </DialogClose>
            </div>
          </>
        ) : (
          <>
            <div className="deletion-profile">
              {auth.account!.image ? (
                <Image
                  src={auth.account!.image}
                  width={44}
                  height={44}
                  alt=""
                  unoptimized
                />
              ) : (
                <span className="auth-avatar">
                  {auth.account!.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <strong>{auth.account!.name}</strong>
                <small>{t("discordAccount")}</small>
              </div>
            </div>
            {context?.validated && (
              <p className="deletion-reconfirm">{t("deleteReconfirm")}</p>
            )}
            <ul className="deletion-consequences">
              <li>{t("deleteReports")}</li>
              <li>{t("deleteJobs")}</li>
              <li>{t("deleteDrafts")}</li>
            </ul>
            {error && (
              <p className="auth-error" role="alert">
                {t(error)}
              </p>
            )}
            <div className="deletion-actions">
              <DialogClose
                render={<Button variant="secondary" />}
                disabled={pending}
              >
                {t("deleteCancel")}
              </DialogClose>
              {freshRequired ? (
                <Button disabled={pending} onClick={() => void verify()}>
                  {t("deleteVerify")}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => void remove()}
                >
                  {t(pending ? "deletingAccount" : "deleteConfirm")}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
// One shared host keeps mobile/desktop controls from opening duplicate dialogs.
export function DeleteAccountDialogHost() {
  const [open, setOpen] = useState(false),
    pathname = usePathname(),
    auth = useAccount();
  useEffect(() => {
    const request = () => setOpen(true);
    window.addEventListener("munigan:account-delete-request", request);
    return () =>
      window.removeEventListener("munigan:account-delete-request", request);
  }, []);
  useEffect(() => {
    if (pathname !== "/library" || auth.status !== "authenticated") return;
    try {
      if (loadDeletionReturn()?.validated) queueMicrotask(() => setOpen(true));
    } catch {
      /* Without valid per-tab state, require opening the account menu again. */
    }
  }, [pathname, auth.status]);
  return <DeleteAccountDialog open={open} onOpenChange={setOpen} />;
}
