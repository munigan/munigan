import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import enCommon from "../../../../messages/en-US/common.json";
import enDiagnostics from "../../../../messages/en-US/diagnostics.json";
import enInventory from "../../../../messages/en-US/inventory.json";
import ptCommon from "../../../../messages/pt-BR/common.json";
import ptDiagnostics from "../../../../messages/pt-BR/diagnostics.json";
import ptInventory from "../../../../messages/pt-BR/inventory.json";
import { purchaseFixture } from "../../../../tests/support/purchase-fixtures";
import { ResourceDialog } from "./ResourceDialog";

type Locale = "en-US" | "pt-BR";

function Messages({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const messages =
    locale === "en-US"
      ? { inventory: enInventory, common: enCommon, diagnostics: enDiagnostics }
      : {
          inventory: ptInventory,
          common: ptCommon,
          diagnostics: ptDiagnostics,
        };
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

it("keeps an edited quantity local and replaces the existing balance on Save", async () => {
  const request = purchaseFixture({ frost: 100, triumph: 30 });
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <Messages locale="en-US">
      <ResourceDialog
        request={request}
        resourceId="frost"
        open
        onOpenChange={onOpenChange}
        onChange={onChange}
      />
    </Messages>,
  );

  const quantity = screen.getByRole("spinbutton", { name: "Quantity" });
  expect(quantity).toHaveValue(100);
  await userEvent.click(quantity);
  await userEvent.clear(quantity);
  await userEvent.type(quantity, "60");
  await userEvent.tab();
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Save resource" }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].purchases.balances).toEqual({
    frost: 60,
    triumph: 30,
  });
  expect(request.purchases?.balances.frost).toBe(100);
  expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
});

it("preserves persisted purchase metadata when replacing the sole balance", async () => {
  const request = purchaseFixture({ frost: 100 });
  request.purchases = {
    ...request.purchases!,
    recipeRevision: "retired-recipe-revision",
    excludedItemIds: {
      original: [50098],
      classic: [51125],
    },
    itemEnhancements: {
      original: { "50098": { enchantId: 0 } },
      classic: { "51125": { gemIds: [null, 40111] } },
    },
  };
  const original = structuredClone(request);
  const onChange = vi.fn();
  render(
    <Messages locale="en-US">
      <ResourceDialog
        request={request}
        resourceId="frost"
        open
        onOpenChange={vi.fn()}
        onChange={onChange}
      />
    </Messages>,
  );

  await userEvent.click(
    screen.getByRole("radio", {
      name: /Normal · 264.*Mark of Sanctification/i,
    }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Save resource" }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].purchases).toEqual({
    ...original.purchases,
    gearVariant: "dk-dps",
    balances: { "mark:normal:vanquisher": 1 },
  });
  expect(request).toEqual(original);
});

it("discards unsaved edits on Cancel and Escape", async () => {
  const request = purchaseFixture({ frost: 100 });
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const { rerender } = render(
    <Messages locale="en-US">
      <ResourceDialog
        request={request}
        resourceId="frost"
        open
        onOpenChange={onOpenChange}
        onChange={onChange}
      />
    </Messages>,
  );
  const quantity = screen.getByRole("spinbutton", { name: "Quantity" });
  await userEvent.clear(quantity);
  await userEvent.type(quantity, "40");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onChange).not.toHaveBeenCalled();
  expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);

  rerender(
    <Messages locale="en-US">
      <ResourceDialog
        request={request}
        resourceId="frost"
        open
        onOpenChange={onOpenChange}
        onChange={onChange}
      />
    </Messages>,
  );
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onChange).not.toHaveBeenCalled();
  expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
});

it("shows the six tier qualities and only the character-compatible token family", async () => {
  render(
    <Messages locale="en-US">
      <ResourceDialog
        request={purchaseFixture()}
        open
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
      />
    </Messages>,
  );

  expect(
    screen.getByRole("radio", { name: /Base · 251.*Emblems of Frost/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", {
      name: /Normal · 264.*Mark of Sanctification/i,
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", {
      name: /Heroic · 277.*Heroic .*Mark of Sanctification/i,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Vanquisher.*Death Knight/i)).toBeInTheDocument();
  expect(screen.queryByText(/Protector/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Conqueror/i)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Tier 9" }));
  expect(
    screen.getByRole("radio", { name: /Base · 232.*Emblems of Triumph/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", { name: /Normal · 245.*Trophy of the Crusade/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radio", {
      name: /Heroic · 258.*Regalia of the Grand Vanquisher/i,
    }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("Emblems of Triumph")).toHaveLength(1);
  expect(
    screen.getByText("Also requires Emblems of Triumph."),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Redeems directly for one tier piece."),
  ).toBeInTheDocument();
});

it("does not restore an incompatible family resource when opened for editing", () => {
  const request = purchaseFixture({
    frost: 2,
    "mark:normal:protector": 5,
  });
  render(
    <Messages locale="en-US">
      <ResourceDialog
        request={request}
        resourceId="mark:normal:protector"
        open
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
      />
    </Messages>,
  );

  expect(
    screen.getByRole("radio", { name: /Base · 251.*Emblems of Frost/i }),
  ).toBeChecked();
  expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(2);
  expect(screen.queryByText(/Protector/i)).not.toBeInTheDocument();
});

it("loads an already-present selected resource and saves zero as an explicit balance", async () => {
  const onChange = vi.fn();
  render(
    <Messages locale="en-US">
      <ResourceDialog
        request={purchaseFixture({ frost: 25, "mark:normal:vanquisher": 3 })}
        open
        onOpenChange={vi.fn()}
        onChange={onChange}
      />
    </Messages>,
  );

  await userEvent.click(
    screen.getByRole("radio", {
      name: /Normal · 264.*Mark of Sanctification/i,
    }),
  );
  const quantity = screen.getByRole("spinbutton", { name: "Quantity" });
  expect(quantity).toHaveValue(3);
  await userEvent.clear(quantity);
  await userEvent.type(quantity, "0");
  await userEvent.tab();
  await userEvent.click(screen.getByRole("button", { name: "Add resource" }));

  expect(onChange.mock.calls[0][0].purchases.balances).toEqual({
    frost: 25,
    "mark:normal:vanquisher": 0,
  });
});

it("does not apply a fractional draft to the integer quantity", async () => {
  const onChange = vi.fn();
  render(
    <Messages locale="en-US">
      <ResourceDialog
        request={purchaseFixture({ frost: 7 })}
        resourceId="frost"
        open
        onOpenChange={vi.fn()}
        onChange={onChange}
      />
    </Messages>,
  );
  const quantity = screen.getByRole("spinbutton", { name: "Quantity" });
  fireEvent.change(quantity, {
    target: { value: "1.5" },
  });
  fireEvent.blur(quantity);
  expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(7);
  await userEvent.click(screen.getByRole("button", { name: "Save resource" }));
  expect(onChange.mock.calls[0][0].purchases.balances.frost).toBe(7);
});

it("preserves the open dialog selection and quantity across locale changes", async () => {
  const request = purchaseFixture({ "regalia:vanquisher": 4 });
  const onChange = vi.fn();
  function View({ locale }: { locale: Locale }) {
    return (
      <Messages locale={locale}>
        <ResourceDialog
          request={request}
          open
          onOpenChange={vi.fn()}
          onChange={onChange}
        />
      </Messages>
    );
  }
  const { rerender } = render(<View locale="en-US" />);
  await userEvent.click(screen.getByRole("button", { name: "Tier 9" }));
  await userEvent.click(
    screen.getByRole("radio", { name: /Heroic · 258.*Regalia/i }),
  );
  const dialog = screen.getByRole("dialog");
  expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(4);
  rerender(<View locale="pt-BR" />);

  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(
    screen.getByRole("radio", { name: /Heroico · 258.*Insígnia/i }),
  ).toBeChecked();
  expect(screen.getByRole("spinbutton", { name: "Quantidade" })).toHaveValue(4);
  expect(
    within(dialog).getByText(/Aniquilador.*Cavaleiro da Morte/i),
  ).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it("defaults to detected DPS gear and persists an explicit tank choice", async () => {
  const request = purchaseFixture({ frost: 100 });
  const onChange = vi.fn();
  render(
    <Messages locale="en-US">
      <ResourceDialog
        request={request}
        resourceId="frost"
        open
        onOpenChange={vi.fn()}
        onChange={onChange}
      />
    </Messages>,
  );
  const selector = screen.getByRole("combobox", {
    name: "Gear specialization",
  });
  expect(selector).toHaveTextContent("Death Knight · DPS");
  await userEvent.click(selector);
  await userEvent.click(
    await screen.findByRole("option", { name: "Death Knight · Tank" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Save resource" }));
  expect(onChange.mock.calls[0][0].purchases).toMatchObject({
    gearVariant: "dk-tank",
    balances: { frost: 100 },
  });
});
