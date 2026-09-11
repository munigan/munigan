import type {
  ItemTooltip,
  TooltipVersion,
} from "../../../src/domain/tooltips/contracts";
import { parseCavernOfTime, parseWowhead } from "./parser";

export class UpstreamError extends Error {
  constructor(
    public status = 503,
    public retrySeconds = 300,
  ) {
    super("Item tooltip source unavailable");
  }
}
const LIMIT = 512 * 1024;

export async function fetchItem(
  version: TooltipVersion,
  id: number,
): Promise<ItemTooltip> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(new UpstreamError(504)),
      { once: true },
    );
  });
  try {
    const url =
      version === "classic"
        ? `https://nether.wowhead.com/wotlk/tooltip/item/${id}`
        : `https://wotlk.cavernoftime.com/item=${id}`;
    const response = await Promise.race([
      fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: version === "classic" ? "application/json" : "text/html",
          "User-Agent": "Munigan-Item-Tooltips/1.0 (+https://munigan.app)",
        },
      }),
      aborted,
    ]);
    if (!response.ok) {
      const retry = response.headers.get("retry-after");
      let seconds =
        retry && /^\d+$/.test(retry)
          ? Number(retry)
          : retry
            ? Math.ceil((Date.parse(retry) - Date.now()) / 1000)
            : 0;
      seconds = Number.isFinite(seconds)
        ? Math.min(86_400, Math.max(0, seconds))
        : 0;
      await response.body?.cancel();
      throw new UpstreamError(
        response.status === 404 ? 404 : 503,
        Math.max(seconds, response.status === 404 ? 86_400 : 300),
      );
    }
    if (
      Number(response.headers.get("content-length")) > LIMIT ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new UpstreamError(502);
    }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) {
        await reader.cancel();
        throw new UpstreamError(502);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = new TextDecoder().decode(bytes);
    return version === "classic"
      ? parseWowhead(JSON.parse(body), id)
      : parseCavernOfTime(body, id);
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
    if (controller.signal.aborted) void reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
