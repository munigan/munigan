import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ToastProvider } from "@/components/ui/Toast";
import { fixtureRequest } from "../../../../tests/support/fixtures";
import enInventory from "../../../../messages/en-US/inventory.json";
import ptInventory from "../../../../messages/pt-BR/inventory.json";
import enCommon from "../../../../messages/en-US/common.json";
import ptCommon from "../../../../messages/pt-BR/common.json";
import enDiagnostics from "../../../../messages/en-US/diagnostics.json";
import ptDiagnostics from "../../../../messages/pt-BR/diagnostics.json";
import { AddCustomItem } from "./CustomItemPicker";

it("preserves an open picker, filters and selected candidates across locale changes", async () => {
  const request = fixtureRequest();
  const initial = JSON.stringify(request);
  const onChange = vi.fn();
  function View({ locale }: { locale: "en-US" | "pt-BR" }) {
    const messages =
      locale === "en-US"
        ? {
            inventory: enInventory,
            common: enCommon,
            diagnostics: enDiagnostics,
          }
        : {
            inventory: ptInventory,
            common: ptCommon,
            diagnostics: ptDiagnostics,
          };
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ToastProvider>
          <AddCustomItem request={request} slot="head" onAdd={onChange} />
        </ToastProvider>
      </NextIntlClientProvider>
    );
  }
  const { rerender } = render(<View locale="en-US" />);
  await userEvent.click(
    screen.getByRole("button", { name: "Add custom item to Head" }),
  );
  const dialog = screen.getByRole("dialog");
  const checkbox = dialog.querySelector<HTMLInputElement>(
    'input[type="checkbox"]:not(:disabled)',
  )!;
  const row = checkbox.closest<HTMLElement>("[data-item-id]")!;
  const id = row.dataset.itemId!;
  await userEvent.click(checkbox);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search items" }), {
    target: { value: id },
  });
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Minimum item level" }),
    { target: { value: "100" } },
  );
  expect(screen.getByRole("button", { name: "Add 1 item" })).toBeEnabled();
  rerender(<View locale="pt-BR" />);
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(
    screen.getByRole("searchbox", { name: "Pesquisar itens" }),
  ).toHaveValue(id);
  expect(
    screen.getByRole("spinbutton", { name: "Nível mínimo do item" }),
  ).toHaveValue(100);
  expect(
    screen.getByRole("button", { name: "Adicionar 1 item" }),
  ).toBeEnabled();
  expect(dialog.querySelector(`[data-item-id="${id}"] input`)).toBeChecked();
  expect(onChange).not.toHaveBeenCalled();
  expect(JSON.stringify(request)).toBe(initial);
  await userEvent.click(
    screen.getByRole("button", { name: "Adicionar 1 item" }),
  );
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith("head", [Number(id)]);
});
