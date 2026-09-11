import type { ReactNode } from "react";
import { it, expect } from "vitest";
import { createTranslator } from "next-intl";
import { messages as en } from "./messages-en";
import { messages as pt } from "./messages-pt";
function flatten(value: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") result[path] = entry;
    else Object.assign(result, flatten(entry, path));
  }
  return result;
}
it("keeps all message keys and ICU arguments in sync and renders every message", () => {
  const english = flatten(en),
    portuguese = flatten(pt);
  expect(Object.keys(portuguese).sort()).toEqual(Object.keys(english).sort());
  const args = (message: string) =>
    [...message.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(english))
    expect(args(portuguese[key]), key).toEqual(args(english[key]));
  for (const [locale, messages] of [
    ["en-US", english],
    ["pt-BR", portuguese],
  ] as const) {
    // Flatten keys to identifiers because next-intl reserves dots for nesting.
    const flat = Object.fromEntries(
      Object.entries(messages).map(([k, v]) => [k.replaceAll(".", "_"), v]),
    );
    const errors: unknown[] = [];
    const t = createTranslator<Record<string, string>>({
      locale,
      messages: flat,
      onError: (e) => errors.push(e),
    });
    for (const [key, value] of Object.entries(flat)) {
      const values = Object.fromEntries(args(value).map((name) => [name, 2]));
      const tags = Object.fromEntries(
        [...value.matchAll(/<(\w+)>/g)].map((match) => [
          match[1],
          (chunks: ReactNode) => chunks,
        ]),
      );
      expect(t.rich(key, { ...values, ...tags }), key).toBeDefined();
    }
    expect(errors).toEqual([]);
  }
});
