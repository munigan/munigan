import { expect, it, vi, afterEach } from "vitest";
import { tooltipSourceUrl } from "@/domain/tooltips/contracts";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});
function payload(id: number, version = "classic") {
  return {
    item: {
      schemaVersion: 1,
      id,
      version,
      source: {
        provider: version === "classic" ? "wowhead" : "cavernoftime",
        url: tooltipSourceUrl(version as "classic" | "original", id),
      },
      name: `Item ${id}`,
      quality: 4,
      icon: null,
      itemLevel: 245,
      heroic: false,
      lines: [{ kind: "effect", text: "Equip: An effect" }],
      sockets: [],
      socketBonus: null,
    },
    meta: { fetchedAt: "2026-09-11T00:00:00.000Z", cache: "fresh" },
  };
}
it("coalesces pending requests and keeps versions separate", async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          payload(45931, url.includes("original") ? "original" : "classic"),
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const { loadItemTooltip } = await import("./tooltip-client");
  const [a, b, c] = await Promise.all([
    loadItemTooltip("classic", 45931),
    loadItemTooltip("classic", 45931),
    loadItemTooltip("original", 45931),
  ]);
  expect(a).toEqual(b);
  expect(c.item.version).toBe("original");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("rejects mismatched IDs and versions and retries errors after cooldown", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(payload(1))))
    .mockResolvedValueOnce(new Response(JSON.stringify(payload(45931))));
  vi.stubGlobal("fetch", fetcher);
  const { loadItemTooltip } = await import("./tooltip-client");
  await expect(loadItemTooltip("classic", 45931)).rejects.toThrow();
  await expect(loadItemTooltip("classic", 45931)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(60001);
  expect((await loadItemTooltip("classic", 45931)).item.id).toBe(45931);
});
it("bounds cached entries and revalidates expired successful responses", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(JSON.stringify(payload(Number(url.split("/").at(-1))))),
  );
  vi.stubGlobal("fetch", fetcher);
  const { loadItemTooltip, peekItemTooltip } = await import("./tooltip-client");
  for (let id = 1; id <= 151; id++) await loadItemTooltip("classic", id);
  expect(peekItemTooltip("classic", 1)).toBeUndefined();
  expect(peekItemTooltip("classic", 151)?.item.id).toBe(151);
  vi.advanceTimersByTime(300001);
  await loadItemTooltip("classic", 151);
  expect(fetcher).toHaveBeenCalledTimes(152);
});
