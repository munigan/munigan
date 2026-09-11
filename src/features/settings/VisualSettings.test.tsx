import ptInventory from "../../../messages/pt-BR/inventory.json";
import ptSettings from "../../../messages/pt-BR/settings.json";
import ptCommon from "../../../messages/pt-BR/common.json";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import inventory from "../../../messages/en-US/inventory.json";
import settings from "../../../messages/en-US/settings.json";
import common from "../../../messages/en-US/common.json";
function EnglishProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en-US"
      messages={{ inventory, settings, common }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
const render = (ui: ReactNode) => rtlRender(ui, { wrapper: EnglishProvider });
import { useState } from "react";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, beforeAll, vi } from "vitest";
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
import { BuffControls, ConsumeControls, GlyphControls } from "./VisualSettings";
import { defaultSettings, listSpecs } from "./registry";
import { applySettingsPatch } from "@/features/import/parse-export";
import type { Snapshot } from "@/domain/top-gear/model";
import { emptyLoadout } from "@/domain/top-gear/slots";
import {
  Flask,
  BattleElixir,
  GuardianElixir,
  Food,
  Glyphs,
} from "@/generated/wotlk/common";

const spec = listSpecs().find((s) => s.className === "Deathknight")!;
function Harness({ kind }: { kind: "buffs" | "consumes" | "glyphs" }) {
  const settings = defaultSettings(spec.id);
  settings.raidBuffs!.bloodlust = true;
  settings.raidBuffs!.demonicPactSp = 321;
  settings.player!.consumes!.food = Food.FoodDragonfinFilet;
  settings.player!.consumes!.flask = Flask.FlaskUnknown;
  settings.player!.consumes!.battleElixir = BattleElixir.ElixirOfMightyStrength;
  settings.player!.consumes!.guardianElixir =
    GuardianElixir.ElixirOfMightyFortitude;
  settings.player!.glyphs = Glyphs.create({
    major1: 43542,
    major2: 43543,
    minor1: 43671,
  });
  const [snapshot, setSnapshot] = useState<Snapshot>({
    id: "test",
    specId: spec.id,
    settings,
    inventory: [],
    equipped: emptyLoadout(),
    provenance: {},
    versions: {
      engine: "test",
      schema: "test",
      presets: "test",
      catalog: "test",
      optimizer: "test",
    },
  });
  const patch = (value: Parameters<typeof applySettingsPatch>[1]) =>
    setSnapshot(applySettingsPatch(snapshot, value));
  return (
    <>
      <div>
        {kind === "buffs" ? (
          <BuffControls snapshot={snapshot} onPatch={patch} />
        ) : kind === "consumes" ? (
          <ConsumeControls snapshot={snapshot} onPatch={patch} />
        ) : (
          <GlyphControls snapshot={snapshot} onPatch={patch} />
        )}
      </div>
      <output data-testid="snapshot">
        {JSON.stringify(snapshot.settings)}
      </output>
    </>
  );
}
async function chooseOption(trigger: HTMLElement, value: string) {
  await userEvent.click(trigger);
  const list = await screen.findByRole("listbox");
  await userEvent.click(
    list.querySelector(`[role="option"][data-select-value="${value}"]`)!,
  );
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(trigger).toHaveFocus());
}
const current = () => JSON.parse(screen.getByTestId("snapshot").textContent!);
it("turns off one buff while retaining numeric imported buffs", async () => {
  render(<Harness kind="buffs" />);
  await userEvent.click(screen.getByRole("checkbox", { name: "Bloodlust" }));
  expect(current().raidBuffs.bloodlust).toBe(false);
  expect(current().raidBuffs.demonicPactSp).toBe(321);
});
it("clears elixirs when selecting a flask and preserves food", async () => {
  render(<Harness kind="consumes" />);
  await userEvent.click(screen.getByRole("tab", { name: "Flask" }));
  await chooseOption(
    screen.getByRole("combobox", { name: "Flask" }),
    String(Flask.FlaskOfEndlessRage),
  );
  expect(current().player.consumes.flask).toBe(Flask.FlaskOfEndlessRage);
  expect(current().player.consumes.battleElixir).toBe(0);
  expect(current().player.consumes.guardianElixir).toBe(0);
  expect(current().player.consumes.food).toBe(Food.FoodDragonfinFilet);
  await userEvent.click(
    screen.getByRole("tab", { name: "Battle + guardian elixirs" }),
  );
  await chooseOption(
    screen.getByRole("combobox", { name: "Battle elixir" }),
    String(BattleElixir.ElixirOfMightyStrength),
  );
  expect(current().player.consumes.flask).toBe(0);
});
it("edits one glyph without changing the other slots and prevents duplicate picks", async () => {
  render(<Harness kind="glyphs" />);
  const first = screen.getByRole("combobox", { name: "Major glyph 1" });
  await chooseOption(first, "43547");
  expect(current().player.glyphs).toMatchObject({
    major1: 43547,
    major2: 43543,
    minor1: 43671,
  });
  const second = screen.getByRole("combobox", { name: "Major glyph 2" });
  await userEvent.click(second);
  const options = await screen.findByRole("listbox");
  expect(
    options.querySelector('[role="option"][data-select-value="43547"]'),
  ).toHaveAttribute("aria-disabled", "true");
});

it("limits Revitalize edits to whole uptime percentages", async () => {
  render(<Harness kind="buffs" />);
  await userEvent.type(screen.getByRole("searchbox"), "Revitalize");
  const input = screen.getByRole("spinbutton", {
    name: "Revitalize: Rejuvenation uptime (%)",
  });
  fireEvent.change(input, { target: { value: "50" } });
  expect(current().player.buffs.revitalizeRejuvination).toBe(50);
  for (const value of ["101", "-1", "1.5"]) {
    fireEvent.change(input, { target: { value } });
    expect(current().player.buffs.revitalizeRejuvination).toBe(50);
  }
});
it("does not offer rogue-only Thistle Tea to a death knight", async () => {
  render(<Harness kind="consumes" />);
  await userEvent.click(
    screen.getByRole("combobox", { name: /Conjured item/ }),
  );
  expect(
    screen.queryByRole("option", { name: "Thistle Tea" }),
  ).not.toBeInTheDocument();
});

it("preserves buff filters and numeric settings while switching language", async () => {
  const englishMessages = { inventory, settings, common };
  const portugueseMessages = {
    inventory: ptInventory,
    settings: ptSettings,
    common: ptCommon,
  };
  const { rerender } = rtlRender(
    <NextIntlClientProvider locale="en-US" messages={englishMessages}>
      <Harness kind="buffs" />
    </NextIntlClientProvider>,
  );
  await userEvent.type(screen.getByRole("searchbox"), "Revitalize");
  fireEvent.change(
    screen.getByRole("spinbutton", {
      name: "Revitalize: Rejuvenation uptime (%)",
    }),
    { target: { value: "50" } },
  );
  const before = screen.getByTestId("snapshot").textContent;
  rerender(
    <NextIntlClientProvider locale="pt-BR" messages={portugueseMessages}>
      <Harness kind="buffs" />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("searchbox", { name: "Buscar buff" })).toHaveValue(
    "Revitalize",
  );
  const input = screen.getByRole("spinbutton", {
    name: "Revitalize: tempo ativo de Rejuvenation (%)",
  });
  expect(input).toHaveValue(50);
  expect(screen.getByTestId("snapshot").textContent).toBe(before);
  fireEvent.change(input, { target: { value: "60" } });
  expect(current().player.buffs.revitalizeRejuvination).toBe(60);
});
