// A navigation intent also fires when Next's Link targets the current URL.
// The tool can cancel it if saving the current import fails.
export const topGearStartEvent = "munigan:top-gear-start";
export function startTopGear() {
  return window.dispatchEvent(
    new Event(topGearStartEvent, { cancelable: true }),
  );
}
