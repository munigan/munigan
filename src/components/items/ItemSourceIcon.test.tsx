import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ItemSourceIcon } from "./ItemSourceIcon";
import english from "../../../messages/en-US/inventory.json";
import portuguese from "../../../messages/pt-BR/inventory.json";

it.each(["equipped", "bag", "custom"] as const)(
  "explains %s on keyboard focus and dismisses with Escape",
  async (source) => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en-US" messages={{ inventory: english }}>
        <ItemSourceIcon source={source} />
      </NextIntlClientProvider>,
    );
    const icon = screen.getByRole("img", { name: english.sources[source] });
    await user.tab();
    expect(icon).toHaveFocus();
    expect(
      await screen.findByText(english.sources[source], {
        selector: ".app-tooltip-popup",
      }),
    ).toHaveTextContent(english.sources[source]);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByText(english.sources[source], {
          selector: ".app-tooltip-popup",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(icon).toHaveFocus();
  },
);

it("opens on click without activating a surrounding checkbox label and translates while open", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  function View({ pt = false }) {
    return (
      <NextIntlClientProvider
        locale={pt ? "pt-BR" : "en-US"}
        messages={{ inventory: pt ? portuguese : english }}
      >
        <label>
          <input type="checkbox" onChange={onChange} />
          Item
          <ItemSourceIcon source="bag" />
        </label>
      </NextIntlClientProvider>
    );
  }
  const { rerender } = render(<View />);
  await user.click(screen.getByRole("img", { name: "Bags" }));
  expect(
    await screen.findByText("Bags", { selector: ".app-tooltip-popup" }),
  ).toHaveTextContent("Bags");
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  rerender(<View pt />);
  expect(
    screen.getByRole("img", { name: portuguese.sources.bag }),
  ).toBeVisible();
  expect(
    screen.getByText(portuguese.sources.bag, {
      selector: ".app-tooltip-popup",
    }),
  ).toHaveTextContent(portuguese.sources.bag);
});
