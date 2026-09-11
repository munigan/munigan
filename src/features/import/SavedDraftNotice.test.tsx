import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import { reportFixture } from "../../../tests/support/report-fixture";
import versions from "../../../data/wotlk/versions.json";
import en from "../../../messages/en-US/import.json";
import pt from "../../../messages/pt-BR/import.json";
import { draftKey } from "./draft-store";
import { importFormDraftKey } from "./import-form-draft";
import { SavedDraftNotice } from "./SavedDraftNotice";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
function show(locale: "en-US" | "pt-BR" = "en-US") {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ import: locale === "en-US" ? en : pt }}
    >
      <SavedDraftNotice onRestore={vi.fn()} onDiscard={vi.fn()} />
    </NextIntlClientProvider>,
  );
}
function equipmentDraft() {
  const { report } = reportFixture();
  report.snapshot.versions = versions;
  report.snapshot.inventory.push({
    ...report.snapshot.inventory.find((i) => i.source === "bag")!,
    source: "custom",
    instanceId: "custom-preview",
  });
  localStorage.setItem(
    draftKey,
    JSON.stringify({
      tool: "top-gear",
      precision: "standard",
      snapshot: report.snapshot,
      selection: report.selection,
    }),
  );
  return report;
}
it("identifies the saved character and counts inventory sources independently", () => {
  const report = equipmentDraft();
  show();
  expect(screen.getByText("Report preview")).toBeVisible();
  expect(screen.getByText(/Fury.*Warrior.*Level 80/)).toBeVisible();
  expect(
    screen.getByText(
      `${report.snapshot.inventory.filter((i) => i.source === "equipped").length} equipped`,
    ),
  ).toBeVisible();
  expect(screen.getByText("1 bag item")).toBeVisible();
  expect(screen.getByText("1 custom item")).toBeVisible();
  expect(document.querySelector(".character-class-image")).toHaveAttribute(
    "src",
    expect.stringContaining("classicon_warrior"),
  );
});
it("shows the pending import instead of an older equipment draft without inventing a spec", () => {
  const report = equipmentDraft();
  localStorage.setItem(
    importFormDraftKey,
    JSON.stringify({
      kind: "warmane",
      character: JSON.stringify({
        name: "Munigan",
        class: "warrior",
        race: "orc",
        level: 80,
        gear: report.snapshot.settings.player!.equipment,
      }),
      bags: "",
      armory: { name: "Munigan", realm: "Icecrown" },
      preset: "",
      reviewing: true,
    }),
  );
  show();
  expect(screen.getByText("Munigan")).toBeVisible();
  expect(screen.queryByText("Report preview")).not.toBeInTheDocument();
  expect(screen.getByText("Import review")).toBeVisible();
  expect(screen.getByText("Choose a DPS preset")).toBeVisible();
  expect(document.querySelector(".character-spec-image")).toBeNull();
});
it("localizes the draft summary", () => {
  equipmentDraft();
  show("pt-BR");
  expect(screen.getByText("1 item nas bolsas")).toBeVisible();
  expect(screen.getByText("1 item personalizado")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Restaurar rascunho" }),
  ).toBeVisible();
});
it("keeps restore and discard available when a saved draft cannot be read", () => {
  localStorage.setItem(draftKey, "{broken");
  show();
  expect(screen.getByRole("button", { name: "Restore draft" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Discard" })).toBeVisible();
});
