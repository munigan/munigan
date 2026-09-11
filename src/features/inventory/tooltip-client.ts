import {
  ItemTooltipResponseSchema,
  type ItemTooltipResponse,
  type TooltipVersion,
} from "@/domain/tooltips/contracts";

type Entry = {
  value?: ItemTooltipResponse;
  pending?: Promise<ItemTooltipResponse>;
  retryAt: number;
  error?: Error;
};
const entries = new Map<string, Entry>();
const keyFor = (version: TooltipVersion, id: number) => `${version}/${id}`;
export function peekItemTooltip(version: TooltipVersion, id: number) {
  return entries.get(keyFor(version, id))?.value;
}
export function loadItemTooltip(
  version: TooltipVersion,
  id: number,
): Promise<ItemTooltipResponse> {
  const key = keyFor(version, id);
  const entry = entries.get(key) ?? { retryAt: 0 };
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > 150) entries.delete(entries.keys().next().value!);
  if (entry.pending) return entry.pending;
  if (entry.retryAt > Date.now())
    return entry.value
      ? Promise.resolve(entry.value)
      : Promise.reject(entry.error);
  entry.pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`/api/tooltips/${key}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Tooltip unavailable");
      const value = ItemTooltipResponseSchema.parse(await response.json());
      if (value.item.id !== id || value.item.version !== version)
        throw new Error("Mismatched tooltip");
      entry.value = value;
      entry.error = undefined;
      entry.retryAt =
        Date.now() + (value.meta.cache === "stale" ? 60000 : 300000);
      return value;
    } catch (error) {
      entry.error =
        error instanceof Error ? error : new Error("Tooltip unavailable");
      entry.retryAt = Date.now() + 60000;
      if (entry.value) return entry.value;
      throw entry.error;
    } finally {
      clearTimeout(timeout);
      entry.pending = undefined;
    }
  })();
  return entry.pending;
}
