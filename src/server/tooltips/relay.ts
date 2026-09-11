import {
  ItemTooltipResponseSchema,
  type TooltipVersion,
} from "@/domain/tooltips/contracts";

export class TooltipRelayError extends Error {
  constructor(public status = 503) {
    super("Item details are temporarily unavailable");
  }
}
export async function fetchItemTooltip(version: TooltipVersion, id: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const aborted = new Promise<never>((_, reject) =>
    controller.signal.addEventListener(
      "abort",
      () => reject(new TooltipRelayError()),
      { once: true },
    ),
  );
  try {
    const secret = process.env.ITEM_TOOLTIP_RELAY_SECRET;
    const configured = process.env.ITEM_TOOLTIP_RELAY_URL;
    if (!secret || !configured) throw new TooltipRelayError();
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new TooltipRelayError();
    url.pathname = `/v1/items/${version}/${id}`;
    const response = await Promise.race([
      fetch(url, {
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${secret}`,
        },
      }),
      aborted,
    ]);
    if (!response.ok) {
      await response.body?.cancel();
      throw new TooltipRelayError(response.status === 404 ? 404 : 503);
    }
    if (
      !response.body ||
      Number(response.headers.get("content-length")) > 512 * 1024
    ) {
      await response.body?.cancel();
      throw new TooltipRelayError();
    }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      size += value.length;
      if (size > 512 * 1024) {
        await reader.cancel();
        throw new TooltipRelayError();
      }
      chunks.push(value);
    }
    const result = ItemTooltipResponseSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (
      result.item.id !== id ||
      result.item.version !== version ||
      Date.parse(result.meta.fetchedAt) > Date.now() + 5_000
    )
      throw new TooltipRelayError();
    return result;
  } catch (error) {
    if (error instanceof TooltipRelayError) throw error;
    throw new TooltipRelayError();
  } finally {
    clearTimeout(timer);
    if (controller.signal.aborted) void reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
