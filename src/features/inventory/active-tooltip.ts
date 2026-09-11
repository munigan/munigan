// Item popovers and local enchant popups share one owner; generic app tooltips
// remain independent. Claim before dismissing so old cleanup cannot clear it.
let active: { id: string; dismiss: () => void } | undefined;
export function claimOwnedTooltip(id: string, dismiss: () => void) {
  const previous = active;
  active = { id, dismiss };
  if (previous && previous.id !== id) previous.dismiss();
}
export function releaseOwnedTooltip(id: string) {
  if (active?.id === id) active = undefined;
}
