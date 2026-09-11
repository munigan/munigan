import { NextIntlClientProvider } from "next-intl";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import englishImport from "../../../messages/en-US/import.json";
import portugueseImport from "../../../messages/pt-BR/import.json";
import englishDiagnostics from "../../../messages/en-US/diagnostics.json";
import portugueseDiagnostics from "../../../messages/pt-BR/diagnostics.json";
import { ImportPanel, type ImportPanelHandle } from "./ImportPanel";
import { importFormDraftKey, loadImportFormDraft } from "./import-form-draft";

const character = {
  name: "Armorytester",
  class: "Warrior",
  race: "Human",
  level: 80,
  gear: { items: [] },
  professions: [
    { name: "Engineering", level: 408 },
    { name: "Jewelcrafting", level: 400 },
  ],
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function view(
  locale: "en-US" | "pt-BR" = "en-US",
  ref?: ReturnType<typeof createRef<ImportPanelHandle | null>>,
) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{
        import: locale === "pt-BR" ? portugueseImport : englishImport,
        diagnostics:
          locale === "pt-BR" ? portugueseDiagnostics : englishDiagnostics,
      }}
    >
      <ImportPanel ref={ref} onResolved={vi.fn()} />
    </NextIntlClientProvider>
  );
}

function chooseWarmane(name = "Armorytester") {
  fireEvent.click(screen.getByRole("button", { name: /^Warmane Armory$/ }));
  fireEvent.change(screen.getByLabelText("Character name"), {
    target: { value: name },
  });
}

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

it("offers a saved profile after a failed live import and only applies it on explicit use", async () => {
  const retrievedAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      if (requests.length === 1)
        return Response.json(
          {
            code: "warmaneTimeout",
            message: "Warmane took too long to respond.",
            requestId: "request-live",
            saved: { retrievedAt },
          },
          { status: 504 },
        );
      return Response.json({
        character,
        meta: {
          retrievedAt,
          source: "saved",
          requestId: "request-saved",
        },
      });
    }),
  );
  render(view());
  chooseWarmane();
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));

  expect(
    await screen.findByText(/Warmane took too long to respond/i),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Armorytester" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use saved profile" }));

  expect(
    await screen.findByRole("heading", { name: "Armorytester" }),
  ).toBeVisible();
  expect(screen.getByText("Saved profile")).toBeVisible();
  expect(requests[0]).not.toContain("mode=saved");
  expect(requests[1]).toContain("mode=saved");
});

it("clears a saved-profile offer when the character lookup changes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          code: "warmaneNetwork",
          message: "Could not connect to Warmane.",
          requestId: "request-a",
          saved: { retrievedAt: new Date().toISOString() },
        },
        { status: 503 },
      ),
    ),
  );
  render(view());
  chooseWarmane();
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(
    await screen.findByRole("button", { name: "Use saved profile" }),
  ).toBeVisible();

  fireEvent.change(screen.getByLabelText("Character name"), {
    target: { value: "Different" },
  });
  expect(
    screen.queryByRole("button", { name: "Use saved profile" }),
  ).not.toBeInTheDocument();
});

it("shows cached retrieval time and age in both supported locales", async () => {
  const retrievedAt = new Date(Date.now() - 5 * 60_000).toISOString();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        character,
        meta: { retrievedAt, source: "cache", requestId: "request-cache" },
      }),
    ),
  );
  const { rerender } = render(view());
  chooseWarmane();
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(await screen.findByText("Recent Armory profile")).toBeVisible();
  expect(screen.getByText(/Retrieved .+ · 5 minutes ago/)).toBeVisible();

  rerender(view("pt-BR"));
  expect(screen.getByText("Perfil recente do Armory")).toBeVisible();
  expect(screen.getByText(/Obtido .+ · há 5 minutos/)).toBeVisible();
});

it("keeps the accepted profile, bags, preset and lookup after refresh fails", async () => {
  const user = userEvent.setup();
  const requests: string[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const retrievedAt = new Date().toISOString();
  const responses = [
    Response.json({
      character,
      meta: { retrievedAt, source: "live", requestId: "request-live" },
    }),
    Response.json(
      {
        code: "warmaneBusy",
        message: "Please wait before refreshing.",
        requestId: "request-refresh",
        retryAfterSeconds: 10,
      },
      { status: 429 },
    ),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return responses.shift()!;
    }),
  );
  render(view());
  chooseWarmane();
  fireEvent.change(screen.getByLabelText("Bag export"), {
    target: { value: JSON.stringify({ items: [{ id: 40528 }] }) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(
    await screen.findByRole("heading", { name: "Armorytester" }),
  ).toBeVisible();

  await user.click(screen.getByLabelText("DPS preset"));
  await user.click(
    await screen.findByRole("option", { name: "Warrior · Fury" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("DPS preset")).toHaveTextContent(
      "Warrior · Fury",
    ),
  );
  expect(screen.getByLabelText("Bag compatibility")).toHaveTextContent(
    "1 bag item",
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh from Armory" }));

  expect(await screen.findByText(/wait 10 seconds/i)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Armorytester" })).toBeVisible();
  expect(screen.getByLabelText("DPS preset")).toHaveTextContent(
    "Warrior · Fury",
  );
  expect(screen.getByLabelText("Bag compatibility")).toHaveTextContent(
    "1 bag item",
  );
  fireEvent.click(screen.getByRole("button", { name: "Back to import" }));
  expect(screen.getByLabelText("Character name")).toHaveValue("Armorytester");
  expect(screen.getByLabelText("Bag export")).toHaveValue(
    JSON.stringify({ items: [{ id: 40528 }] }),
  );
  expect(requests[0]).toContain("mode=auto");
  expect(requests[1]).toContain("mode=refresh");
});

it("preserves valid Armory metadata when a review draft is saved and restored", async () => {
  const retrievedAt = new Date(Date.now() - 60_000).toISOString();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        character,
        meta: { retrievedAt, source: "saved", requestId: "request-saved" },
      }),
    ),
  );
  const firstRef = createRef<ImportPanelHandle | null>();
  render(view("en-US", firstRef));
  chooseWarmane();
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(await screen.findByText("Saved profile")).toBeVisible();
  act(() => firstRef.current?.saveForLater());
  expect(JSON.parse(localStorage.getItem(importFormDraftKey)!)).toMatchObject({
    armoryMeta: { retrievedAt, source: "saved", requestId: "request-saved" },
  });

  cleanup();
  const restoredRef = createRef<ImportPanelHandle | null>();
  render(view("en-US", restoredRef));
  act(() => expect(restoredRef.current?.restoreDraft()).toBe(true));
  expect(await screen.findByText("Saved profile")).toBeVisible();
  expect(screen.getByText(/1 minute ago/)).toBeVisible();
});

it("rejects malformed optional Armory metadata in a saved draft", () => {
  localStorage.setItem(
    importFormDraftKey,
    JSON.stringify({
      kind: "warmane",
      character: JSON.stringify(character),
      bags: "",
      armory: { name: "Armorytester", realm: "Icecrown" },
      preset: "",
      reviewing: true,
      armoryMeta: {
        retrievedAt: "not-a-date",
        source: "cache",
        requestId: "request-cache",
      },
    }),
  );
  expect(() => loadImportFormDraft()).toThrow(/invalid saved import draft/i);
});

it("does not let a pending Armory response overwrite a restored review", async () => {
  let finishLookup!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finishLookup = resolve;
        }),
    ),
  );
  const restoredCharacter = { ...character, name: "Restoredone" };
  const retrievedAt = new Date(Date.now() - 60_000).toISOString();
  localStorage.setItem(
    importFormDraftKey,
    JSON.stringify({
      kind: "warmane",
      character: JSON.stringify(restoredCharacter),
      bags: "",
      armory: { name: "Restoredone", realm: "Lordaeron" },
      preset: "",
      reviewing: true,
      armoryMeta: {
        retrievedAt,
        source: "saved",
        requestId: "restored-request",
      },
    }),
  );
  const ref = createRef<ImportPanelHandle | null>();
  render(view("en-US", ref));
  chooseWarmane();
  fireEvent.click(screen.getByRole("button", { name: "Review import" }));
  expect(await screen.findByText("Fetching character…")).toBeVisible();

  act(() => expect(ref.current?.restoreDraft()).toBe(true));
  expect(
    await screen.findByRole("heading", { name: "Restoredone" }),
  ).toBeVisible();
  expect(screen.getByText("Saved profile")).toBeVisible();
  await act(async () => {
    finishLookup(
      Response.json({
        character,
        meta: {
          retrievedAt: new Date().toISOString(),
          source: "live",
          requestId: "late-request",
        },
      }),
    );
    await Promise.resolve();
  });

  expect(screen.getByRole("heading", { name: "Restoredone" })).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Armorytester" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Saved profile")).toBeVisible();
});
