import { twMerge } from "tailwind-merge";
/** Callers can replace utility defaults without depending on generated CSS order. */
export function classes(...values: (string | false | null | undefined)[]) {
  return twMerge(values.filter(Boolean).join(" "));
}
