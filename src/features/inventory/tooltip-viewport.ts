// Both provider and local tooltips use viewport coordinates in the top layer.
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
  // The provider resets width to auto when reusing a tooltip. Keep its layout
  // stable before measuring or choosing a side, including on narrow screens.
  set("width", `${Math.min(320, width)}px`);
  set("max-width", `${width}px`);
  set("max-height", `${height}px`);
  const rect = anchor.getBoundingClientRect();
  const box = tooltip.getBoundingClientRect();
  const preferred =
    rect.right + 10 + box.width <= left + width
      ? rect.right + 10
      : rect.left - box.width - 10;
  set(
    "left",
    `${Math.max(left, Math.min(preferred, left + width - box.width))}px`,
  );
  set(
    "top",
    `${Math.max(top, Math.min(rect.top, top + height - box.height))}px`,
  );
}
