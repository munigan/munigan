"use client";
import { useEffect } from "react";
import Script from "next/script";
import { fitItemTooltip } from "./tooltip-viewport";

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
    let activeLink: HTMLAnchorElement | null = null;
    const tooltips = new Set<HTMLElement>();
    // Provider tooltips live under body. Promote visible ones above modal
    // dialogs, whose top layer cannot be reached by increasing z-index.
    const syncTooltipLayer = () => {
      document
        .querySelectorAll<HTMLElement>(".wowhead-tooltip")
        .forEach((tooltip) => tooltips.add(tooltip));
      tooltips.forEach((tooltip) => {
        if (!tooltip.showPopover) return;
        const visible = tooltip.dataset.visible === "yes";
        // A body-level popover remains inert while a modal is open. Move it
        // into the active dialog so long tooltips can actually be scrolled.
        const host = activeLink?.isConnected
          ? (activeLink.closest("dialog[open]") ?? document.body)
          : document.body;
        if ((visible || !tooltip.isConnected) && tooltip.parentElement !== host)
          host.appendChild(tooltip);
        const raised = tooltip.matches(":popover-open");
        if (visible && !raised) {
          tooltip.setAttribute("popover", "manual");
          tooltip.showPopover();
        } else if (!visible && raised) tooltip.hidePopover();
        if (visible && activeLink?.isConnected)
          fitItemTooltip(tooltip, activeLink);
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
      attributeFilter: ["data-visible", "style"],
    });
    const trackLink = (event: Event) => {
      const target = event.target;
      const link =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a[data-wowhead]")
          : null;
      if (link) activeLink = link;
    };
    document.addEventListener("mouseover", trackLink, true);
    document.addEventListener("focusin", trackLink, true);
    window.addEventListener("resize", syncTooltipLayer);
    window.addEventListener("scroll", syncTooltipLayer, true);
    window.visualViewport?.addEventListener("resize", syncTooltipLayer);
    window.visualViewport?.addEventListener("scroll", syncTooltipLayer);
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
      for (const tooltip of tooltips) {
        if (tooltip.matches(":popover-open")) tooltip.hidePopover();
        if (tooltip.parentElement !== document.body)
          document.body.appendChild(tooltip);
      }
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", focus);
      document.removeEventListener("mouseover", trackLink, true);
      document.removeEventListener("focusin", trackLink, true);
      window.removeEventListener("resize", syncTooltipLayer);
      window.removeEventListener("scroll", syncTooltipLayer, true);
      window.visualViewport?.removeEventListener("resize", syncTooltipLayer);
      window.visualViewport?.removeEventListener("scroll", syncTooltipLayer);
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
