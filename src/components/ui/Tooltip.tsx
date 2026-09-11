"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { classes } from "./classes";
import "./tooltip.css";

export const TooltipProvider = Tooltip.Provider;
export const TooltipRoot = Tooltip.Root;
export const TooltipTrigger = Tooltip.Trigger;

export function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  ...props
}: Tooltip.Popup.Props & {
  side?: Tooltip.Positioner.Props["side"];
  sideOffset?: number;
}) {
  return (
    <Tooltip.Portal>
      <Tooltip.Positioner
        side={side}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="app-tooltip-positioner"
      >
        <Tooltip.Popup
          {...props}
          className={(state) =>
            classes(
              "app-tooltip-popup",
              typeof className === "function" ? className(state) : className,
            )
          }
        />
      </Tooltip.Positioner>
    </Tooltip.Portal>
  );
}
