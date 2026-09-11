// Owned item tooltips use viewport coordinates in the browser top layer.
export function fitItemTooltip(tooltip: HTMLElement, anchor: Element) {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft ?? 0) + 8;
  const top = (viewport?.offsetTop ?? 0) + 8;
  const width = Math.max(1, (viewport?.width ?? innerWidth) - 16);
  const height = Math.max(1, (viewport?.height ?? innerHeight) - 16);
  const set = (property: string, value: string) => {
    if (
      tooltip.style.getPropertyValue(property) !== value ||
      tooltip.style.getPropertyPriority(property) !== "important"
    )
      tooltip.style.setProperty(property, value, "important");
  };
  set("position", "fixed");
  set(
    "width",
    `${Math.min(tooltip.dataset.gem === "true" ? 280 : 336, width)}px`,
  );
  set("max-width", `${width}px`);
  const rect = anchor.getBoundingClientRect();
  const tooltipWidth = Math.min(
    tooltip.dataset.gem === "true" ? 280 : 336,
    width,
  );
  const rightFits = rect.right + 8 + tooltipWidth <= left + width;
  const leftFits = rect.left - tooltipWidth - 8 >= left;
  const below = top + height - rect.bottom - 8;
  const above = rect.top - top - 8;
  // A clamped side placement can cover the anchor on mobile between focus and
  // pointerup, redirecting the click to its parent row. Use the larger vertical
  // space when neither side fits, and scroll within that space.
  const vertical = !rightFits && !leftFits;
  const useBelow = below >= above;
  set(
    "max-height",
    `${vertical ? Math.max(1, Math.min(height, Math.max(above, below))) : height}px`,
  );
  const box = tooltip.getBoundingClientRect();
  const x = rightFits
    ? rect.right + 8
    : leftFits
      ? rect.left - box.width - 8
      : rect.left;
  const y = vertical
    ? useBelow
      ? rect.bottom + 8
      : rect.top - box.height - 8
    : rect.top;
  set("left", `${Math.max(left, Math.min(x, left + width - box.width))}px`);
  set("top", `${Math.max(top, Math.min(y, top + height - box.height))}px`);
}
