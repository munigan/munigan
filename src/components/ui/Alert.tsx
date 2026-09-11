import type { ComponentProps, ReactNode } from "react";
import { Button, type ButtonProps } from "./Button";
import { classes } from "./classes";

type Tone = "info" | "warning" | "error";

export function Alert({
  tone = "info",
  role,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { tone?: Tone }) {
  return (
    <div
      {...props}
      role={role ?? (tone === "error" ? "alert" : "status")}
      data-tone={tone}
      className={classes(
        "my-4 flex min-h-20 flex-col gap-3.5 border-y border-border bg-transparent py-4 text-text md:flex-row md:items-center md:gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AlertContent({
  children,
  icon = "info",
}: {
  children: ReactNode;
  icon?: "info" | "history" | "warning" | "error";
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3 md:gap-3.5">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={classes(
          "shrink-0",
          icon === "error" ? "text-danger" : "text-action",
        )}
        aria-hidden="true"
      >
        {icon === "history" ? (
          <>
            <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
            <path d="M12 7v5l3 2" />
          </>
        ) : icon === "warning" ? (
          <>
            <path d="M12 3 2 21h20L12 3Z" />
            <path d="M12 9v5m0 3v.01" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path
              d={icon === "error" ? "m9 9 6 6m0-6-6 6" : "M12 11v6m0-10v.01"}
            />
          </>
        )}
      </svg>
      <div className="min-w-0 flex-1 text-sm leading-[22px] wrap-anywhere">
        {children}
      </div>
    </div>
  );
}

export function AlertActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-11 max-w-full flex-wrap items-center justify-between gap-x-7 gap-y-2 pl-9 md:justify-start md:pl-0">
      {children}
    </div>
  );
}

export function AlertAction({
  muted = false,
  className,
  ...props
}: ButtonProps & { muted?: boolean }) {
  return (
    <Button
      {...props}
      variant="ghost"
      className={(state) =>
        classes(
          "max-w-full rounded-none px-0 text-action whitespace-normal hover:bg-transparent hover:underline",
          muted && "text-[13px] font-normal text-muted hover:text-text",
          typeof className === "function" ? className(state) : className,
        )
      }
    />
  );
}

export function AlertActionDivider() {
  return (
    <span
      aria-hidden="true"
      className="hidden h-[18px] w-px bg-border md:block"
    />
  );
}

export function AlertMessage({
  children,
  tone = "info",
  ...props
}: ComponentProps<typeof Alert>) {
  return (
    <Alert {...props} tone={tone}>
      <AlertContent icon={tone === "info" ? "info" : tone}>
        {children}
      </AlertContent>
    </Alert>
  );
}
