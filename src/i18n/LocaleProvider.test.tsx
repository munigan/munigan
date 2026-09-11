import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LocaleProvider, useAppLocale } from "./LocaleProvider";
import { loadMessages, type Messages } from "./messages";
vi.mock("./messages", () => ({
  loadMessages: vi.fn(async () => ({
    common: { close: "Fechar", languageFailed: "Falhou" },
    shell: { reportTitle: "Relatório" },
  })),
}));
function Probe() {
  const [value, setValue] = useState("");
  const { switchLocale } = useAppLocale();
  const t = useTranslations("common");
  return (
    <>
      <textarea
        aria-label="Draft"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button onClick={() => void switchLocale("pt-BR")}>Português</button>
      <button onClick={() => void switchLocale("en-US")}>English</button>
      <span>{t("close")}</span>
    </>
  );
}
it("switches without remounting unsaved state and persists preference", async () => {
  render(
    <LocaleProvider
      initialLocale="en-US"
      initialMessages={{ common: { close: "Close", languageFailed: "Failed" } }}
      area="workbench"
    >
      <Probe />
    </LocaleProvider>,
  );
  fireEvent.change(screen.getByLabelText("Draft"), {
    target: { value: "unsaved export" },
  });
  fireEvent.click(screen.getByText("Português"));
  await screen.findByText("Fechar");
  expect(screen.getByLabelText("Draft")).toHaveValue("unsaved export");
  await waitFor(() => expect(document.documentElement.lang).toBe("pt-BR"));
  expect(document.cookie).toContain("munigan.locale=pt-BR");
});

function renderProbe() {
  return render(
    <LocaleProvider
      initialLocale="en-US"
      initialMessages={{ common: { close: "Close", languageFailed: "Failed" } }}
      area="workbench"
    >
      <Probe />
    </LocaleProvider>,
  );
}

it("keeps the current language and draft when a dictionary fails to load", async () => {
  vi.mocked(loadMessages).mockRejectedValueOnce(new Error("offline"));
  renderProbe();
  const draft = screen.getByLabelText("Draft");
  fireEvent.change(draft, { target: { value: "keep this" } });
  fireEvent.click(screen.getByText("Português"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Failed");
  expect(screen.getByText("Close")).toBeVisible();
  expect(screen.getByLabelText("Draft")).toBe(draft);
  expect(draft).toHaveValue("keep this");
  expect(document.documentElement.lang).toBe("en-US");
});

it("ignores an older dictionary response after the user chooses English again", async () => {
  let resolve!: (messages: Messages) => void;
  vi.mocked(loadMessages).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  renderProbe();
  fireEvent.click(screen.getByText("Português"));
  fireEvent.click(screen.getByText("English"));
  await act(async () => resolve({ common: { close: "Fechar" } }));
  expect(screen.getByText("Close")).toBeVisible();
  expect(document.documentElement.lang).toBe("en-US");
  expect(document.cookie).toContain("munigan.locale=en-US");
});
