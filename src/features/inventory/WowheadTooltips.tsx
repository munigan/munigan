"use client";
import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    whTooltips?: {
      colorLinks: boolean;
      iconizeLinks: boolean;
      renameLinks: boolean;
      iconSize: boolean;
    };
    $WowheadPower?: { refreshLinks: (force?: boolean) => void };
  }
}

export function WowheadTooltips() {
  useEffect(() => {
    window.whTooltips = {
      colorLinks: false,
      iconizeLinks: false,
      renameLinks: false,
      iconSize: true,
    };
    let frame = 0;
    // Provider tooltips live under body. Promote visible ones above modal
    // dialogs, whose top layer cannot be reached by increasing z-index.
    const syncTooltipLayer = () => {
      document
        .querySelectorAll<HTMLElement>(".wowhead-tooltip")
        .forEach((tooltip) => {
          if (!tooltip.showPopover) return;
          const visible = tooltip.dataset.visible === "yes";
          const raised = tooltip.matches(":popover-open");
          if (visible && !raised) {
            tooltip.setAttribute("popover", "manual");
            tooltip.showPopover();
          } else if (!visible && raised) tooltip.hidePopover();
        });
    };
    const observer = new MutationObserver((changes) => {
      syncTooltipLayer();
      // React adds item links after import/filtering; ignore the provider's own tooltip/icon nodes.
      if (
        !changes.some((change) =>
          [...change.addedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches("a[data-wowhead]") ||
                node.querySelector("a[data-wowhead]")),
          ),
        )
      )
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        window.$WowheadPower?.refreshLinks(true),
      );
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-visible"],
    });
    const focus = (event: FocusEvent) => {
      const link = event.target;
      if (
        !(link instanceof HTMLAnchorElement) ||
        !link.hasAttribute("data-wowhead")
      )
        return;
      const rect = link.getBoundingClientRect();
      link.dispatchEvent(
        new MouseEvent(event.type === "focusin" ? "mouseover" : "mouseout", {
          bubbles: true,
          clientX: rect.right,
          clientY: rect.top,
        }),
      );
    };
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", focus);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focus);
    };
  }, []);
  return (
    <Script
      id="wowhead-tooltips"
      src="https://wow.zamimg.com/js/tooltips.js"
      strategy="afterInteractive"
      onReady={() => window.$WowheadPower?.refreshLinks(true)}
    />
  );
}
