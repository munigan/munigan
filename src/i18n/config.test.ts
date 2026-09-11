import { it, expect } from "vitest";
import { resolveLocale } from "./resolve-locale";
import { homepagePath, localeFromSlug } from "./config";
import { formatNumber, formatPercentagePoints } from "./format";
it.each([
  ["pt-BR", "en-US", "pt-BR"],
  [undefined, "es;q=1,pt-PT;q=0.8,en;q=0.5", "pt-BR"],
  ["invalid", "en;q=0.9,pt;q=0.5", "en-US"],
  [undefined, "pt;q=0,en;q=0.8", "en-US"],
  [undefined, null, "en-US"],
  [undefined, "fr,pt;q=0.8,en;q=0.9", "en-US"],
])("resolves language preference %s %s", (cookie, header, expected) =>
  expect(resolveLocale(cookie, header)).toBe(expected),
);
it("maps homepage slugs and formats explicitly", () => {
  expect(homepagePath("pt-BR")).toBe("/pt-br");
  expect(localeFromSlug("fr")).toBeNull();
  expect(formatNumber(1234.5, "pt-BR", 1)).toBe("1.234,5");
  expect(formatPercentagePoints(8.25, "pt-BR", 2)).toBe("8,25%");
});
