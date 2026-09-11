"use client";
import type { ComponentProps } from "react";
import { ClassicCompactItemLink } from "./ClassicCompactItemLink";
export function OriginalItemLink(
  props: Omit<ComponentProps<typeof ClassicCompactItemLink>, "version">,
) {
  return <ClassicCompactItemLink {...props} version="original" />;
}
