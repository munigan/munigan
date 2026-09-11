// Payload-free invalidation: no account identifiers or report capabilities cross tabs.
const eventName = "munigan:data-invalidated";
const channelName = "munigan.data";
const storageKey = "munigan.data.invalidated";
export function invalidateAccountData() {
  const nonce = crypto.randomUUID();
  window.dispatchEvent(new CustomEvent(eventName, { detail: nonce }));
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage(nonce);
      channel.close();
    } else localStorage.setItem(storageKey, nonce);
  } catch {
    /* Local listeners already received the invalidation. */
  }
}
export function subscribeAccountData(listener: () => void) {
  const seen = new Set<string>();
  const receive = (nonce: unknown) => {
    if (typeof nonce !== "string" || seen.has(nonce)) return;
    seen.add(nonce);
    if (seen.size > 20) seen.delete(seen.values().next().value!);
    listener();
  };
  const local = (event: Event) => receive((event as CustomEvent).detail);
  const message = (event: MessageEvent) => receive(event.data);
  window.addEventListener(eventName, local);
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined")
      channel = new BroadcastChannel(channelName);
  } catch {
    /* storage fallback */
  }
  channel?.addEventListener("message", message);
  const storage = (event: StorageEvent) => {
    if (event.key === storageKey) receive(event.newValue);
  };
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, local);
    window.removeEventListener("storage", storage);
    channel?.removeEventListener("message", message);
    channel?.close();
  };
}
