import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import englishImport from "../../../messages/en-US/import.json";
import portugueseImport from "../../../messages/pt-BR/import.json";
import englishDiagnostics from "../../../messages/en-US/diagnostics.json";
import portugueseDiagnostics from "../../../messages/pt-BR/diagnostics.json";
import { ImportPanel } from "./ImportPanel";

it("preserves raw unsaved exports and translates visible errors when locale changes", () => {
  const onResolved = vi.fn();
  const view = (portuguese: boolean) => (
    <NextIntlClientProvider
      locale={portuguese ? "pt-BR" : "en-US"}
      messages={{
        import: portuguese ? portugueseImport : englishImport,
        diagnostics: portuguese ? portugueseDiagnostics : englishDiagnostics,
      }}
    >
      <ImportPanel onResolved={onResolved} />
    </NextIntlClientProvider>
  );
  const { rerender } = render(view(false));
  const raw = '{"level": 70}';
  fireEvent.change(screen.getByLabelText("Character export"), {
    target: { value: raw },
  });
  fireEvent.change(screen.getByLabelText("Bag export"), {
    target: { value: '{"items": []}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "This importer supports level 80 Wrath characters",
  );
  rerender(view(true));
  expect(screen.getByLabelText("Exportação do personagem")).toHaveValue(raw);
  expect(screen.getByLabelText("Exportação das bolsas")).toHaveValue(
    '{"items": []}',
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Este importador aceita personagens de nível 80 de Wrath",
  );
  expect(onResolved).not.toHaveBeenCalled();
});
