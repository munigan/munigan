import { classes } from "./classes";
import type { ComponentProps } from "react";
export function PageHeading({
  className = "",
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      {...props}
      className={classes(
        "grid grid-cols-[minmax(0,1fr)] items-center gap-x-6 gap-y-3 py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:py-10",
        className,
      )}
    />
  );
}
export function SectionHeading({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={classes(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    />
  );
}
export function Surface({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={classes(
        "rounded-panel border border-border bg-surface",
        className,
      )}
    />
  );
}
export function Eyebrow({ className = "", ...props }: ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={classes(
        "font-brand text-xs font-medium tracking-[.1em] uppercase text-muted",
        className,
      )}
    />
  );
}
