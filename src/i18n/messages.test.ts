import type { ReactNode } from "react";
import { it, expect } from "vitest";
import { createTranslator } from "next-intl";
import { messages as en } from "./messages-en";
import { messages as pt } from "./messages-pt";
import { messages as homeEn } from "./messages-home-en";
import { messages as homePt } from "./messages-home-pt";
import type { AccountErrorCode } from "@/domain/accounts/contracts";

const accountErrorCodes = {
  SIGN_IN_REQUIRED: true,
  AUTH_UNAVAILABLE: true,
  NOT_FOUND: true,
  REPORT_EXPIRED: true,
  OWNER_COOKIE_REQUIRED: true,
  INTENT_EXPIRED: true,
  REPORT_NOT_READY: true,
  CLAIM_CONFLICT: true,
  ACCOUNT_DELETING: true,
  FRESH_LOGIN_REQUIRED: true,
  ACCOUNT_CHANGED: true,
  SAVING_UNAVAILABLE: true,
  INVALID_REQUEST: true,
  RATE_LIMITED: true,
} satisfies Record<AccountErrorCode, true>;
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

it("ships every account error translation in home and workbench catalogs", () => {
  for (const catalog of [en, pt, homeEn, homePt]) {
    expect(catalog).toHaveProperty("auth.errors");
    expect(catalog).toHaveProperty("library.errors");
    for (const code of Object.keys(accountErrorCodes) as AccountErrorCode[]) {
      expect(catalog).toHaveProperty(`auth.errors.${code}`);
      expect(catalog).toHaveProperty(`library.errors.${code}`);
    }
  }
});

it("ships the final bilingual account copy and one Gear Lab display name", () => {
  expect(en.auth).toMatchObject({
    continueDiscord: "Continue with Discord",
    saveBenefit: "This report, saved to My Library",
    saved: "Report saved",
    library: "My Library",
    saveFailedAfterLogin:
      "You're signed in, but this report wasn't saved. Try saving again.",
    savedReadOnly: "Shared report · read only",
    runWithoutSaving: "Run without saving",
    deleteAccountDone: "Access removed. Data cleanup is processing.",
  });
  expect(pt.auth).toMatchObject({
    continueDiscord: "Continuar com Discord",
    saveBenefit: "Este relatório, salvo na Minha biblioteca",
    saved: "Relatório salvo",
    library: "Minha biblioteca",
    saveFailedAfterLogin:
      "Você entrou, mas este relatório não foi salvo. Tente salvar novamente.",
    savedReadOnly: "Relatório compartilhado · somente leitura",
    runWithoutSaving: "Simular sem salvar",
    deleteAccountDone:
      "Acesso removido. A exclusão dos dados está em andamento.",
  });
  expect(en.shell.gearLab).toBe("Gear Lab");
  expect(pt.shell.gearLab).toBe(en.shell.gearLab);
  expect(en.home.description).toBe("Compare equipped, bag and custom items.");
  expect(pt.home.description).toBe(
    "Compare itens equipados, da bolsa e adicionados manualmente.",
  );
  expect(en.auth.errors).toMatchObject({
    AUTH_UNAVAILABLE: "We couldn't check your session. Try again.",
    REPORT_EXPIRED: "This report expired and can no longer be saved.",
  });
  expect(pt.auth.errors).toMatchObject({
    AUTH_UNAVAILABLE: "Não foi possível verificar sua sessão. Tente novamente.",
    REPORT_EXPIRED: "Este relatório expirou e não pode mais ser salvo.",
  });
});
