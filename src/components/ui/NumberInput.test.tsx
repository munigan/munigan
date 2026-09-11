import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { expect, it } from "vitest";
import { NumberInput } from "./NumberInput";
import common from "../../../messages/en-US/common.json";
it("supports bounded steps, direct editing and restoring incomplete input", () => {
  function Harness() {
    const [n, setN] = useState(0);
    return (
      <NextIntlClientProvider locale="en-US" messages={{ common }}>
        <NumberInput
          label="Sources"
          value={n}
          min={0}
          max={2}
          onValueChange={setN}
        />
        <output>{n}</output>
      </NextIntlClientProvider>
    );
  }
  render(<Harness />);
  const input = screen.getByRole("spinbutton", { name: "Sources" });
  expect(
    screen.getByRole("button", { name: "Decrease Sources" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Increase Sources" }));
  expect(input).toHaveValue(1);
  fireEvent.change(input, { target: { value: "2" } });
  expect(
    screen.getByRole("button", { name: "Increase Sources" }),
  ).toBeDisabled();
  fireEvent.change(input, { target: { value: "" } });
  expect(screen.getByRole("status")).toHaveTextContent("2");
  fireEvent.blur(input);
  expect(input).toHaveValue(2);
  fireEvent.change(input, { target: { value: "3" } });
  fireEvent.blur(input);
  expect(input).toHaveValue(2);
});
