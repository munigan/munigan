"use client";
import type { Ref } from "react";
import { classes } from "./classes";

import { Button as Primitive } from "@base-ui/react/button";

const variants = {
  primary: "bg-action text-canvas hover:bg-[#8ced65] border-transparent",
  secondary: "bg-surface text-text border-border hover:bg-selected-surface",
  ghost: "bg-transparent text-text border-transparent hover:bg-surface",
  danger: "bg-danger text-canvas border-transparent",
};
const sizes = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-14 px-6 text-base",
};
export type ButtonProps = Omit<Primitive.Props, "ref"> & {
  ref?: Ref<HTMLElement>;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

/** Use render={<Link href="…" />} with nativeButton={false} role="link" for navigation. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <Primitive
      {...props}
      className={(state) =>
        classes(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border font-semibold no-underline transition-colors hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          variants[variant],
          sizes[size],
          typeof className === "function" ? className(state) : className,
        )
      }
    />
  );
}
