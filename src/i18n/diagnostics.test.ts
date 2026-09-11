import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import english from "../../messages/en-US/diagnostics.json";
import portuguese from "../../messages/pt-BR/diagnostics.json";
import { localizeDiagnostic, safeOriginalDetails } from "./diagnostics";
import { AppError, describeError } from "./error";
import { parseExport } from "@/features/import/parse-export";

const en = createTranslator<Record<string, string>>({
  locale: "en-US",
  messages: english,
});
const pt = createTranslator<Record<string, string>>({
  locale: "pt-BR",
  messages: portuguese,
});

describe("diagnostic localization", () => {
  it("translates relay recovery failures and cooldowns in both languages", () => {
    for (const code of [
      "warmaneTimeout",
      "warmaneAccessDenied",
      "warmaneNetwork",
      "warmaneRelayUnavailable",
      "warmaneNoSavedProfile",
    ] as const) {
      expect(localizeDiagnostic({ code }, en)).toBe(english[code]);
      expect(localizeDiagnostic({ code }, pt)).toBe(portuguese[code]);
    }
    expect(
      localizeDiagnostic(
        { code: "warmaneRateLimited", params: { seconds: 30 } },
        en,
      ),
    ).toBe(
      "Warmane is limiting requests. Please wait 30 seconds before trying again.",
    );
    expect(
      localizeDiagnostic({ code: "warmaneBusy", params: { seconds: 10 } }, pt),
    ).toBe("Aguarde 10 segundos antes de atualizar este perfil novamente.");
  });
  it("translates structured Armory lookup errors and preserves the gem ID", () => {
    expect(
      localizeDiagnostic(
        { code: "warmaneNotFound", error: "Character not found." },
        pt,
      ),
    ).toBe("Personagem não encontrado. Confira o nome e o reino.");
    expect(
      localizeDiagnostic(
        { code: "warmaneUnknownGem", params: { id: 9999 } },
        pt,
      ),
    ).toBe(
      "A gema 9999 do Armory não pôde ser identificada. Use uma exportação do addon para preservar suas gemas.",
    );
  });
  it("keeps parser errors language-neutral while rendering each language", () => {
    let error: unknown;
    try {
      parseExport('{"level": 70}', "character");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AppError);
    expect(describeError(error).code).toBe("wrathLevel");
    expect(localizeDiagnostic(error, en)).toBe(
      "This importer supports level 80 Wrath characters",
    );
    expect(localizeDiagnostic(error, pt)).toBe(
      "Este importador aceita personagens de nível 80 de Wrath",
    );
  });
  it("translates known legacy and additive API errors without changing item names", () => {
    expect(
      localizeDiagnostic("Enchant 123 is not legal on Shadowmourne", pt),
    ).toBe("O encantamento 123 não pode ser aplicado a Shadowmourne");
    expect(
      localizeDiagnostic(
        { error: "legacy fallback", code: "unknownGem", params: { id: 123 } },
        pt,
      ),
    ).toBe("Gema desconhecida: 123");
    expect(
      localizeDiagnostic(
        {
          code: "unknown-item",
          message: "Item 123 is not in the pinned simulator catalog",
        },
        pt,
      ),
    ).toContain("O item 123");
    expect(localizeDiagnostic("Equipped gear: Unique gem conflict", pt)).toBe(
      "Equipamentos em uso: Conflito entre gemas únicas",
    );
  });
  it("translates known enchant warnings and canonical slot identifiers", () => {
    expect(
      localizeDiagnostic(
        "Shadowmourne: no compatible equipped enchant could be copied; simulated without an enchant.",
        pt,
      ),
    ).toBe(
      "Shadowmourne: nenhum encantamento compatível dos equipamentos em uso pôde ser copiado; simulado sem encantamento.",
    );
    expect(localizeDiagnostic("Shadowmourne cannot occupy offHand", pt)).toBe(
      "Shadowmourne não pode ocupar o espaço Mão secundária",
    );
  });
  it("translates custom picker and settings validation", () => {
    expect(localizeDiagnostic("Use a JSON object", pt)).toBe(
      "Use um objeto JSON",
    );
    expect(
      localizeDiagnostic(
        "Item 123 is not eligible for this slot and character",
        pt,
      ),
    ).toContain("O item 123 não pode ser usado");
    expect(
      localizeDiagnostic(
        "You can add up to 100 custom items. Remove a custom item to make room.",
        pt,
      ),
    ).toContain("até 100 itens personalizados");
  });
  it("retains only bounded original text for unknown historical errors", () => {
    const error = {
      message: "Old engine\nmessage",
      stack: "hidden stack",
      secret: "never serialize",
    };
    expect(localizeDiagnostic(error, pt)).toBe(
      "Algo deu errado. Detalhes originais: Old engine message",
    );
    expect(localizeDiagnostic({ secret: "never serialize" }, pt)).toBe(
      "Algo deu errado.",
    );
    expect(safeOriginalDetails("x".repeat(1000))).toHaveLength(600);
    expect(
      localizeDiagnostic(
        { code: "unknownGem", message: "Historical message" },
        pt,
      ),
    ).toContain("Historical message");
  });
  it("keeps matching diagnostic keys and interpolation parameters", () => {
    expect(Object.keys(portuguese).sort()).toEqual(Object.keys(english).sort());
    for (const [key, value] of Object.entries(english)) {
      const variables = (message: string) =>
        [...message.matchAll(/\{(\w+)(?:,|\})/g)]
          .map((match) => match[1])
          .sort();
      expect(
        variables(portuguese[key as keyof typeof portuguese]),
        key,
      ).toEqual(variables(value));
    }
  });
});

it.each(["constructor", "toString", "__proto__"])(
  "treats inherited name %s as unknown error text",
  (message) => {
    expect(localizeDiagnostic(message, pt)).toBe(
      pt("unknownDetails", { details: message }),
    );
  },
);
