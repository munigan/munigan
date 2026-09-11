"use client";
import { useTranslations } from "next-intl";

import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { classes } from "./classes";

export const useToastManager = Toast.useToastManager;

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={5000} limit={3}>
      {children}
      <ToastList />
    </Toast.Provider>
  );
}

function ToastList() {
  const t = useTranslations("common");
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-[100] flex w-[calc(100%-32px)] max-w-sm flex-col gap-2 outline-none sm:right-6 sm:bottom-6">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="flex translate-y-0 items-start gap-3 rounded-panel border border-border bg-surface p-4 text-text shadow-2xl transition-[opacity,translate] duration-200 ease-out data-ending-style:duration-150 data-ending-style:opacity-0 data-limited:hidden data-starting-style:opacity-0 motion-safe:data-ending-style:translate-y-1 motion-safe:data-starting-style:translate-y-2 motion-reduce:transition-none"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={classes(
                "mt-0.5 shrink-0",
                toast.type === "error" ? "text-danger" : "text-action",
              )}
            >
              <circle cx="12" cy="12" r="9" />
              <path
                d={toast.type === "error" ? "M12 7v6m0 4v.01" : "m8 12 3 3 5-6"}
              />
            </svg>
            <Toast.Content className="min-w-0 flex-1">
              <Toast.Title className="m-0 text-sm font-semibold leading-6" />
              <Toast.Description className="mt-1 text-sm leading-5 text-muted" />
            </Toast.Content>
            <Toast.Close
              aria-label={t("dismissNotification")}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-muted"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
