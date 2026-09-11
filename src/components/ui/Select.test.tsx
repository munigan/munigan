import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Select, SelectOption } from "./Select";

function Harness() {
  const [value, setValue] = useState("original");
  return (
    <form aria-label="Settings">
      <label htmlFor="version">Item version</label>
      <Select
        id="version"
        name="version"
        value={value}
        onValueChange={setValue}
      >
        <SelectOption
          value="original"
          description="Original Ulduar item levels"
        >
          Original WotLK
        </SelectOption>
        <>
          <SelectOption value="retired" disabled>
            Retired version
          </SelectOption>
          <SelectOption value="classic">Wrath Classic</SelectOption>
        </>
      </Select>
    </form>
  );
}

it("renders the selected label before opening and submits its underlying value", () => {
  render(<Harness />);
  expect(
    screen.getByRole("combobox", { name: "Item version" }),
  ).toHaveTextContent("Original WotLK");
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).get("version"),
  ).toBe("original");
});

it("describes an option without adding its description to the selected label", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole("combobox", { name: "Item version" });
  await user.click(trigger);
  const option = await screen.findByRole("option", { name: /Original Wotlk/i });
  expect(option).toHaveAccessibleDescription("Original Ulduar item levels");
  await user.click(option);
  expect(trigger).toHaveTextContent(/^Original WotLK$/);
});

it("supports keyboard selection, skips disabled choices, and restores focus after Escape", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole("combobox", { name: "Item version" });
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await screen.findByRole("listbox");
  expect(
    screen.getByRole("option", { name: "Retired version" }),
  ).toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{End}{Enter}");
  await waitFor(() => expect(trigger).toHaveTextContent("Wrath Classic"));
  expect(
    new FormData(screen.getByRole("form") as HTMLFormElement).get("version"),
  ).toBe("classic");
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
  await user.click(trigger);
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "Wrath Classic" })).toHaveFocus(),
  );
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});
