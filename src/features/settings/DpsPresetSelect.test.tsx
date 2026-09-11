import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { DpsPresetSelect } from "./DpsPresetSelect";
import { listSpecs } from "./registry";
import english from "../../../messages/en-US/settings.json";
import portuguese from "../../../messages/pt-BR/settings.json";

function Harness({ portugueseLocale = false }: { portugueseLocale?: boolean }) {
  const [value, setValue] = useState("deathknight:FrostTalents");
  return (
    <NextIntlClientProvider
      locale={portugueseLocale ? "pt-BR" : "en-US"}
      messages={{ settings: portugueseLocale ? portuguese : english }}
    >
      <form aria-label="Character settings">
        <DpsPresetSelect
          aria-label="DPS preset"
          name="preset"
          value={value}
          onValueChange={setValue}
          options={listSpecs().filter((spec) => spec.module === "deathknight")}
          placeholder={{ value: "", label: "Choose your specialization" }}
        />
      </form>
    </NextIntlClientProvider>
  );
}

it("keeps icons and readable labels separate from descriptions and stable form values", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole("combobox", { name: "DPS preset" });
  expect(trigger).toHaveTextContent("Frost/Blood (15/56/0)");
  expect(trigger.querySelector("img")).toHaveAttribute(
    "src",
    expect.stringContaining("frostpresence"),
  );
  expect(trigger).toHaveAccessibleDescription(
    "Talent points: Blood / Frost / Unholy.",
  );
  await user.click(trigger);
  const unholy = screen.getByRole("option", { name: "Frost/Unholy (1/52/18)" });
  expect(unholy).toHaveAccessibleDescription(
    "Dual wield with Unholy support talents.",
  );
  expect(unholy.querySelector("img")).toHaveAttribute("alt", "");
  await user.click(unholy);
  expect(trigger).toHaveTextContent(/^Frost\/Unholy \(1\/52\/18\)$/);
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).get("preset"),
  ).toBe("deathknight:FrostUnholyTalents");
  await user.click(trigger);
  await user.keyboard("blood{Enter}");
  await waitFor(() => expect(trigger).toHaveTextContent("Blood DPS (51/0/20)"));
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).get("preset"),
  ).toBe("deathknight:BloodTalents");
});

it("translates explanations without changing the selected build", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Harness />);
  rerender(<Harness portugueseLocale />);
  const trigger = screen.getByRole("combobox", { name: "DPS preset" });
  expect(trigger).toHaveTextContent("Frost/Blood (15/56/0)");
  expect(trigger).toHaveAccessibleDescription(
    "Pontos de talento: Blood / Frost / Unholy.",
  );
  await user.click(trigger);
  expect(
    screen.getByRole("option", { name: "Frost/Blood (15/56/0)" }),
  ).toHaveAccessibleDescription("Duas armas com talentos de apoio em Blood.");
});
