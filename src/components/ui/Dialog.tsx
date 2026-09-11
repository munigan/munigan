"use client";
import { useTranslations } from "next-intl";
import { classes } from "./classes";

import { Dialog } from "@base-ui/react/dialog";

export const DialogRoot = Dialog.Root;
export const DialogTrigger = Dialog.Trigger;
export const DialogClose = Dialog.Close;
export const DialogTitle = Dialog.Title;
export const DialogDescription = Dialog.Description;

export function DialogDismiss() {
  const t = useTranslations("common");
  return (
    <Dialog.Close
      aria-label={t("close")}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted transition-colors hover:bg-selected-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
    >
      <svg
        className="shrink-0"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </Dialog.Close>
  );
}

/** Focus management, dismissal and stacking belong to the primitive, content to the caller. */
export function DialogContent({ className, ...props }: Dialog.Popup.Props) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs" />
      <Dialog.Popup
        {...props}
        className={(state) =>
          classes(
            "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-border bg-surface p-4 text-text shadow-2xl outline-none sm:p-5",
            typeof className === "function" ? className(state) : className,
          )
        }
      />
    </Dialog.Portal>
  );
}
