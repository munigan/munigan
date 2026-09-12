"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ItemInstance } from "@/domain/top-gear/model";
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
import { classes } from "@/components/ui/classes";
import "./item-source-icon.css";

const paths = {
  purchase: "M3 3h2l3 12h10l3-8H6M9 20h.01M18 20h.01",
  equipped: "m8 3-5 3-2 5 5 2v8h12v-8l5-2-2-5-5-3a4 4 0 0 1-8 0Z",
  bag: "M9 8 7 3c3 1 7 1 10 0l-2 5M9 8c-2 3-6 5-6 9 0 3 4 4 9 4s9-1 9-4c0-4-4-6-6-9M8 8h8m-1 0 3 3m-3-3v4M7 14c-1 1-1 2-1 3",
  custom:
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM12 8v8M8 12h8",
};

/** Item provenance, shared by inventory rows, pickers and item details. */
export function ItemSourceIcon({
  source,
  label,
  className,
}: {
  source: ItemInstance["source"];
  label?: string;
  className?: string;
}) {
  const t = useTranslations("inventory.sources");
  const text = label ?? t(source);
  const [open, setOpen] = useState(false);
  const pointerType = useRef("");
  useEffect(() => {
    if (!open) return;
    // A hovered hint may leave focus elsewhere in a dialog. Dismiss the hint
    // before that dialog handles Escape and discards the user's pending edits.
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [open]);
  return (
    <TooltipRoot
      open={open}
      onOpenChange={(next, details) => {
        // Touch synthesizes mouseleave after a tap. Keep its hint open until
        // an outside press, focus change or Escape dismisses it.
        if (
          !next &&
          details.reason === "trigger-hover" &&
          pointerType.current === "touch"
        ) {
          details.cancel();
          return;
        }
        setOpen(next);
      }}
    >
      <TooltipTrigger
        render={<span role="img" tabIndex={0} />}
        aria-label={text}
        data-item-source={source}
        className={classes("item-source-icon", className)}
        delay={250}
        closeOnClick={false}
        onPointerEnter={(event) => {
          pointerType.current = event.pointerType;
        }}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onClick={(event) => {
          // Source hints can sit inside clickable rows or checkbox labels.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={paths[source]} />
        </svg>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </TooltipRoot>
  );
}
