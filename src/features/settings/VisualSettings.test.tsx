import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
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
const current = () => JSON.parse(screen.getByTestId("snapshot").textContent!);
it("turns off one buff while retaining numeric imported buffs", async () => {
  render(<Harness kind="buffs" />);
  await userEvent.click(screen.getByRole("checkbox", { name: "Bloodlust" }));
  expect(current().raidBuffs.bloodlust).toBe(false);
  expect(current().raidBuffs.demonicPactSp).toBe(321);
});
it("clears elixirs when selecting a flask and preserves food", async () => {
  render(<Harness kind="consumes" />);
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Flask" }),
    String(Flask.FlaskOfEndlessRage),
  );
  expect(current().player.consumes.flask).toBe(Flask.FlaskOfEndlessRage);
  expect(current().player.consumes.battleElixir).toBe(0);
  expect(current().player.consumes.guardianElixir).toBe(0);
  expect(current().player.consumes.food).toBe(Food.FoodDragonfinFilet);
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Battle elixir" }),
    String(BattleElixir.ElixirOfMightyStrength),
  );
  expect(current().player.consumes.flask).toBe(0);
});
it("edits one glyph without changing the other slots and prevents duplicate picks", async () => {
  render(<Harness kind="glyphs" />);
  const first = screen.getByRole("combobox", { name: "Major glyph 1" });
  await userEvent.selectOptions(first, "43547");
  expect(current().player.glyphs).toMatchObject({
    major1: 43547,
    major2: 43543,
    minor1: 43671,
  });
  const second = screen.getByRole("combobox", { name: "Major glyph 2" });
  expect(second.querySelector('option[value="43547"]')).toBeDisabled();
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
it("does not offer rogue-only Thistle Tea to a death knight", () => {
  render(<Harness kind="consumes" />);
  expect(
    screen.queryByRole("option", { name: "Thistle Tea" }),
  ).not.toBeInTheDocument();
});
