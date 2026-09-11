import { isLocale, type AppLocale } from "./config";
export function resolveLocale(
  cookie: string | undefined,
  header: string | null,
): AppLocale {
  if (isLocale(cookie)) return cookie;
  const languages = (header ?? "")
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().toLowerCase().split(";");
      const quality = parameters.find((p) => p.trim().startsWith("q="));
      return { tag, index, q: quality ? Number(quality.trim().slice(2)) : 1 };
    })
    .filter((x) => Number.isFinite(x.q) && x.q > 0 && x.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of languages) {
    if (/^pt(?:-|$)/.test(tag)) return "pt-BR";
    if (/^en(?:-|$)/.test(tag)) return "en-US";
  }
  return "en-US";
}
