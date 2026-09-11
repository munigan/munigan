"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LibraryItem } from "@/domain/accounts/contracts";
import { Button } from "@/components/ui/Button";
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogDismiss,
  DialogClose,
} from "@/components/ui/Dialog";
import { invalidateAccountData } from "@/features/auth/data-invalidation";
export function DeleteReportDialog({
  item,
  onDeleted,
}: {
  item: LibraryItem;
  onDeleted: () => void;
}) {
  const t = useTranslations("library"),
    [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const busy = useRef(false);
  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/library/${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      );
      if (!response.ok) throw new Error("delete failed");
      setOpen(false);
      invalidateAccountData();
      onDeleted();
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <DialogRoot
      open={open}
      onOpenChange={(value) => {
        if (!busy.current) {
          setOpen(value);
          setError(false);
        }
      }}
    >
      <DialogTrigger
        className="library-delete"
        aria-label={t("deleteNamed", { name: item.summary.characterName })}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
        </svg>
      </DialogTrigger>
      <DialogContent className="auth-dialog">
        <div className="auth-dialog-heading">
          <div>
            <DialogTitle className="auth-dialog-title">
              {t("deleteTitle")}
            </DialogTitle>
            <DialogDescription className="auth-dialog-description">
              {t("deleteDescription", { name: item.summary.characterName })}
            </DialogDescription>
          </div>
          <DialogDismiss />
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {t("deleteFailed")}
          </p>
        )}
        <div className="deletion-actions">
          <DialogClose
            render={<Button variant="secondary" />}
            disabled={pending}
          >
            {t("cancel")}
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => void remove()}
          >
            {t(pending ? "deleting" : "deleteReport")}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
