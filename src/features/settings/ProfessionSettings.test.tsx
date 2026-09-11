import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { fixtureRequest } from "../../../tests/support/fixtures";
import { Profession } from "@/generated/wotlk/common";
import { applySettingsPatch } from "@/features/import/parse-export";
import { ProfessionSettings } from "./ProfessionSettings";
import settings from "../../../messages/en-US/settings.json";
import inventory from "../../../messages/en-US/inventory.json";
import common from "../../../messages/en-US/common.json";

it("preserves incompatible overrides until explicitly reset and disables duplicate professions", async () => {
  const initial = fixtureRequest().snapshot;
  const hands = initial.inventory.find(
    (item) => item.equippedSlot === "hands",
  )!;
  const legs = initial.inventory.find((item) => item.equippedSlot === "legs")!;
  initial.settings.player!.profession1 = Profession.Engineering;
  initial.settings.player!.profession2 = Profession.Jewelcrafting;
  initial.professionLevels = {
    [Profession.Engineering]: 450,
    [Profession.Jewelcrafting]: 450,
  };
  initial.itemEnhancements = {
    [hands.instanceId]: { enchantId: 3604 },
    [legs.instanceId]: { enchantId: 0 },
  };
  function Harness() {
    const [snapshot, setSnapshot] = useState(initial);
    return (
      <>
        <ProfessionSettings
          snapshot={snapshot}
          onChange={setSnapshot}
          onPatch={(patch) => setSnapshot(applySettingsPatch(snapshot, patch))}
        />
        <output data-testid="overrides">
          {JSON.stringify(snapshot.itemEnhancements)}
        </output>
      </>
    );
  }
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={{ settings, inventory, common }}
    >
      <Harness />
    </NextIntlClientProvider>,
  );
  await userEvent.click(screen.getByRole("combobox", { name: "Profession 1" }));
  const list = await screen.findByRole("listbox");
  expect(
    list.querySelector(`[data-select-value="${Profession.Jewelcrafting}"]`),
  ).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(list.querySelector('[data-select-value="0"]')!);
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("1 item needs attention")).toBeVisible();
  expect(JSON.parse(screen.getByTestId("overrides").textContent!)).toEqual(
    initial.itemEnhancements,
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: "Use automatic enhancements for affected items",
    }),
  );
  expect(JSON.parse(screen.getByTestId("overrides").textContent!)).toEqual({
    [legs.instanceId]: { enchantId: 0 },
  });
  expect(
    initial.inventory.find((item) => item.instanceId === hands.instanceId),
  ).toEqual(hands);
});
